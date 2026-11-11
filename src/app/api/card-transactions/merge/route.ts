import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-token-auth';
import { isTransactionDuplicate, formatToKSTDate } from '@/lib/bulk-transaction-parser';

/**
 * POST /api/card-transactions/merge
 * 중복 거래 내역 병합 REST API
 * 1) 특정 ID 병합: { keepId: string, removeIds: string[] }
 * 2) 월간 자동 병합: { month: "2026-09", dryRun?: boolean }
 */
async function handlePOST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();

    // Mode 1: Manual specific IDs merge
    if (body.keepId && Array.isArray(body.removeIds) && body.removeIds.length > 0) {
      const keepId = String(body.keepId);
      const removeIds = body.removeIds.map((id: any) => String(id));

      const primary = await prisma.cardTransaction.findUnique({ where: { id: keepId } });
      if (!primary) {
        return NextResponse.json({ error: '유지할 원본 거래를 찾을 수 없습니다.' }, { status: 404 });
      }

      const fixedCount = await prisma.cardTransaction.count({ where: { id: { in: [keepId, ...removeIds] }, fixedExpenseId: { not: null } } });
      if (fixedCount) return NextResponse.json({ error: '고정비가 포함되어 있습니다. 장부의 결제 연결 기능을 이용해 주세요.' }, { status: 400 });
      const deleted = await prisma.cardTransaction.deleteMany({
        where: { id: { in: removeIds } },
      });

      return NextResponse.json({
        success: true,
        message: `${deleted.count}건의 중복 거래를 ${keepId}로 성공적으로 병합 및 삭제하였습니다.`,
        keepId,
        mergedCount: deleted.count,
      });
    }

    // Mode 2: Month-based automatic duplicate detection & merge
    const targetMonth = body.month?.trim() || '2026-09';
    const dryRun = Boolean(body.dryRun);

    const [year, monthNum] = targetMonth.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00+09:00`);
    const nextMonth = Number(monthNum) === 12 ? 1 : Number(monthNum) + 1;
    const nextYear = Number(monthNum) === 12 ? Number(year) + 1 : Number(year);
    const endDate = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`);

    const transactions = await prisma.cardTransaction.findMany({
      where: {
        fixedExpenseId: null,
        notifiedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: { notifiedAt: 'asc' },
    });

    const duplicateGroups: Array<{
      primaryId: string;
      primaryTitle: string;
      primaryMerchant: string | null;
      amount: number;
      date: string;
      removeIds: string[];
    }> = [];

    const visited = new Set<string>();
    const allRemoveIds: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (visited.has(tx.id)) continue;

      const matchedDups: typeof transactions = [];

      for (let j = i + 1; j < transactions.length; j++) {
        const other = transactions[j];
        if (visited.has(other.id)) continue;

        if (isTransactionDuplicate(tx, other)) {
          matchedDups.push(other);
          visited.add(other.id);
          allRemoveIds.push(other.id);
        }
      }

      if (matchedDups.length > 0) {
        visited.add(tx.id);
        duplicateGroups.push({
          primaryId: tx.id,
          primaryTitle: tx.title,
          primaryMerchant: tx.merchant,
          amount: tx.amount,
          date: formatToKSTDate(tx.notifiedAt),
          removeIds: matchedDups.map((d) => d.id),
        });
      }
    }

    if (!dryRun && allRemoveIds.length > 0) {
      await prisma.cardTransaction.deleteMany({
        where: { id: { in: allRemoveIds } },
      });
    }

    return NextResponse.json({
      success: true,
      month: targetMonth,
      dryRun,
      totalTransactions: transactions.length,
      duplicateGroupsCount: duplicateGroups.length,
      duplicatesCount: allRemoveIds.length,
      remainingCount: transactions.length - allRemoveIds.length,
      message: dryRun
        ? `${duplicateGroups.length}개 그룹, 총 ${allRemoveIds.length}건의 중복 거래가 발견되었습니다.`
        : `${duplicateGroups.length}개 그룹에서 ${allRemoveIds.length}건의 중복 거래를 성공적으로 병합/삭제하였습니다.`,
      groups: duplicateGroups.slice(0, 50),
    });
  } catch (err: unknown) {
    console.error('[API /api/card-transactions/merge POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '중복 거래 병합 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const POST = withLedgerScope(handlePOST);
