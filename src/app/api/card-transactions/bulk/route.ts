import { withLedgerScope } from '@/lib/ledger-scope';
import { kstDate, matchesFixedPayment, SCHEDULED_FIXED_PACKAGE } from '@/lib/fixed-expense-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { autoDetectCategory } from '@/lib/household-categories';
import { isTransactionDuplicate } from '@/lib/bulk-transaction-parser';
import { authenticateRequest } from '@/lib/api-token-auth';
import { randomUUID } from 'crypto';

interface CandidateRecord {
  id: string;
  sourceApp: string;
  type: string;
  amount: number;
  merchant: string | null;
  category: string;
  title: string;
  content: string;
  balance: number | null;
  cardOrAccount: string | null;
  packageName: string | null;
  notifiedAt: Date;
  isReported: boolean;
  reportedAt: Date | null;
  rawData: any;
  createdAt: Date;
  updatedAt: Date;
}

async function handlePOST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();
    const transactions = Array.isArray(body?.transactions) ? body.transactions : [];
    const skipFixedMatching = body?.skipFixedMatching === true;

    if (transactions.length === 0) {
      return NextResponse.json({ error: '등록할 거래 내역이 없습니다.' }, { status: 400 });
    }

    if (transactions.length > 2000) {
      return NextResponse.json({ error: '한 번에 최대 2,000건까지만 등록 가능합니다.' }, { status: 400 });
    }

    const now = new Date();
    const candidateRecords: CandidateRecord[] = transactions.map((t: any) => {
      const notifiedAtDate = t.notifiedAt ? new Date(t.notifiedAt) : now;
      const validDate = isNaN(notifiedAtDate.getTime()) ? now : notifiedAtDate;

      const merchant = t.merchant?.trim() || null;
      const title = String(t.title || `[가계부] ${merchant || t.category || '거래'}`).trim();
      const content = String(t.content || title).trim();
      const category = t.category?.trim() || autoDetectCategory(merchant, title, content) || '기타';

      return {
        id: randomUUID(),
        sourceApp: String(t.sourceApp || 'OTHER'),
        type: String(t.type || 'PAYMENT'),
        amount: Math.round(Math.abs(Number(t.amount) || 0)),
        merchant,
        category,
        title,
        content,
        balance: t.balance != null ? Math.round(Number(t.balance)) : null,
        cardOrAccount: t.cardOrAccount?.trim() || null,
        packageName: t.packageName === SCHEDULED_FIXED_PACKAGE ? null : t.packageName?.trim() || null,
        notifiedAt: validDate,
        isReported: false,
        reportedAt: null,
        rawData: t.rawData || { bulkImport: true, importedAt: now.toISOString() },
        createdAt: now,
        updatedAt: now,
      };
    });

    // Query existing DB transactions across the date window of candidate transactions
    const timestamps = candidateRecords.map((r: CandidateRecord) => r.notifiedAt.getTime());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    const searchStart = new Date(minTimestamp - 2 * 86400_000);
    const searchEnd = new Date(maxTimestamp + 2 * 86400_000);

    const existingDbTransactions = await prisma.cardTransaction.findMany({
      where: {
        OR: [{ packageName: null }, { packageName: { not: SCHEDULED_FIXED_PACKAGE } }],
        notifiedAt: {
          gte: searchStart,
          lte: searchEnd,
        },
      },
      select: {
        id: true,
        sourceApp: true,
        type: true,
        amount: true,
        merchant: true,
        category: true,
        title: true,
        content: true,
        notifiedAt: true,
      },
    });

    // Filter duplicates against DB records and within the batch
    const recordsToInsert: CandidateRecord[] = [];
    let duplicateCount = 0;

    for (const rec of candidateRecords) {
      // 1. Check against DB records
      const isDbDuplicate = existingDbTransactions.some((dbTx: any) =>
        isTransactionDuplicate(
          {
            notifiedAt: rec.notifiedAt,
            amount: rec.amount,
            type: rec.type,
            merchant: rec.merchant,
            content: rec.content,
            title: rec.title,
          },
          dbTx
        )
      );

      if (isDbDuplicate) {
        duplicateCount++;
        continue;
      }

      // 2. Check against already accepted records in this batch
      const isBatchDuplicate = recordsToInsert.some((prev: CandidateRecord) =>
        isTransactionDuplicate(
          {
            notifiedAt: rec.notifiedAt,
            amount: rec.amount,
            type: rec.type,
            merchant: rec.merchant,
            content: rec.content,
            title: rec.title,
          },
          prev
        )
      );

      if (isBatchDuplicate) {
        duplicateCount++;
        continue;
      }

      recordsToInsert.push(rec);
    }

    if (recordsToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        insertedCount: 0,
        duplicateCount,
        totalRequested: transactions.length,
        message: `모든 항목이 기존 거래 또는 입력 목록과 중복되어 등록되지 않았습니다 (중복 ${duplicateCount}건 제외).`,
      });
    }

    const result = await prisma.$transaction(async db => {
      const months = [...new Set(recordsToInsert.map(tx => kstDate(tx.notifiedAt).slice(0, 7)))].sort();
      for (const month of months) await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
      const current = await db.cardTransaction.findMany({ where: { notifiedAt: { gte: searchStart, lte: searchEnd } } });
      const pending = current.filter(tx => tx.packageName === SCHEDULED_FIXED_PACKAGE);
      const actual = current.filter(tx => tx.packageName !== SCHEDULED_FIXED_PACKAGE);
      const accepted = recordsToInsert.filter(rec => {
        if (actual.some(tx => isTransactionDuplicate(rec, tx))) { duplicateCount++; return false; }
        return true;
      });
      if (skipFixedMatching) {
        const inserted = accepted.length ? await db.cardTransaction.createMany({ data: accepted }) : { count: 0 };
        return { count: inserted.count };
      }
      const used = new Set<string>();
      const unmatched: CandidateRecord[] = [];
      let linked = 0;
      const matches = (planned: typeof pending[number], rec: CandidateRecord) => {
        const metadata = planned.rawData as { fixedExpenseKeyword?: string } | null;
        return !!planned.scheduledFor && matchesFixedPayment({ name: planned.merchant || planned.title, merchantKeyword: metadata?.fixedExpenseKeyword, amount: planned.amount }, kstDate(planned.scheduledFor), rec);
      };
      for (const rec of accepted) {
        const candidates = pending.filter(tx => !used.has(tx.id) && matches(tx, rec));
        if (candidates.length === 1 && accepted.filter(other => matches(candidates[0], other)).length === 1) {
          const planned = candidates[0]; used.add(planned.id);
          await db.cardTransaction.update({ where: { id: planned.id }, data: {
            sourceApp: rec.sourceApp, type: rec.type, amount: rec.amount, merchant: rec.merchant,
            category: rec.category, title: rec.title, content: rec.content, balance: rec.balance,
            cardOrAccount: rec.cardOrAccount, packageName: rec.packageName, notifiedAt: rec.notifiedAt,
            rawData: rec.rawData,
          } });
          linked++;
        } else unmatched.push(rec);
      }
      const inserted = unmatched.length ? await db.cardTransaction.createMany({ data: unmatched }) : { count: 0 };
      return { count: inserted.count + linked };
    }, { timeout: 30000 });

    const message =
      duplicateCount > 0
        ? `${result.count}건의 거래 내역이 등록되었습니다 (중복 ${duplicateCount}건 제외).`
        : `${result.count}건의 거래 내역이 성공적으로 일괄 등록되었습니다.`;

    return NextResponse.json({
      success: true,
      insertedCount: result.count,
      duplicateCount,
      totalRequested: transactions.length,
      message,
    });
  } catch (err: unknown) {
    console.error('Bulk transaction import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '대량 거래 등록 중 서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const POST = withLedgerScope(handlePOST);
