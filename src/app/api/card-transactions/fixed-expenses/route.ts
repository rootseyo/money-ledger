import { withLedgerScope } from '@/lib/ledger-scope';
import { SCHEDULED_FIXED_PACKAGE } from '@/lib/fixed-expense-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  FixedExpenseItem,
  FixedExpenseWithStats,
  FixedExpenseHistoryItem,
  FIXED_EXPENSES_SETTING_KEY,
  calculateMonthlyNormalizedAmount,
} from '@/lib/fixed-expenses';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * 고정비용 목록 및 과거 결제 이력(총 결제액) 통계 조회
 */
async function handleGET(request: NextRequest) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
    });

    let items: FixedExpenseItem[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      } catch (e) {
        console.error('Failed to parse fixed expenses setting:', e);
      }
    }

    // 각 고정비용의 과거 실제 결제 내역(총 누적 결제액 및 히스토리) 매칭 집계
    const itemsWithStats: FixedExpenseWithStats[] = await Promise.all(
      items.map(async (item) => {
        const keyword = (item.merchantKeyword || item.name || '').trim();
        let history: FixedExpenseHistoryItem[] = [];
        let totalPaidAmount = 0;
        let lastPaidAt: string | null = null;

        if (keyword) {
          const matchingTxs = await prisma.cardTransaction.findMany({
            where: {
              AND: [{ OR: [{ packageName: null }, { packageName: { not: SCHEDULED_FIXED_PACKAGE } }] }],
              OR: [
                { merchant: { contains: keyword, mode: 'insensitive' } },
                { content: { contains: keyword, mode: 'insensitive' } },
                { title: { contains: keyword, mode: 'insensitive' } },
              ],
              type: { in: ['PAYMENT', 'WITHDRAWAL'] },
            },
            orderBy: { notifiedAt: 'desc' },
            take: 100,
          });

          history = matchingTxs.map((tx) => ({
            id: tx.id,
            date: tx.notifiedAt.toISOString().slice(0, 10),
            amount: tx.amount,
            merchant: tx.merchant || tx.title,
            content: tx.content,
            sourceApp: tx.sourceApp,
            cardOrAccount: tx.cardOrAccount,
          }));

          totalPaidAmount = history.reduce((sum, h) => sum + h.amount, 0);
          lastPaidAt = history.length > 0 ? history[0].date : null;
        }

        const monthlyNormalizedAmount = calculateMonthlyNormalizedAmount(item.amount, item.cycle);

        return {
          ...item,
          totalPaidAmount,
          paidCount: history.length,
          lastPaidAt,
          monthlyNormalizedAmount,
          history,
        };
      })
    );

    // 전체 고정비 요약 집계
    const activeItems = itemsWithStats.filter((i) => i.isActive);
    const summary = {
      totalCount: itemsWithStats.length,
      activeCount: activeItems.length,
      totalMonthlyAmount: activeItems.reduce((sum, i) => sum + i.monthlyNormalizedAmount, 0),
      totalYearlyAmount: activeItems.reduce((sum, i) => sum + i.monthlyNormalizedAmount * 12, 0),
      totalCumulativePaid: itemsWithStats.reduce((sum, i) => sum + i.totalPaidAmount, 0),
    };

    return NextResponse.json(
      {
        success: true,
        summary,
        items: itemsWithStats,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('[API /api/card-transactions/fixed-expenses GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '고정비용 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 신규 고정비용 등록 (단건 및 대량/벌크 등록 지원)
 */
async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const nowIso = new Date().toISOString();

    const setting = await prisma.systemSetting.findUnique({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
    });

    let items: FixedExpenseItem[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    // 1. 대량(벌크) 등록인 경우
    if (Array.isArray(body.items)) {
      const incomingList = body.items;
      if (incomingList.length === 0) {
        return NextResponse.json(
          { error: '등록할 고정비용 항목이 없습니다.' },
          { status: 400 }
        );
      }

      const validNewItems: FixedExpenseItem[] = [];
      for (const raw of incomingList) {
        const name = String(raw.name || '').trim();
        const amount = Math.round(Math.abs(Number(raw.amount) || 0));
        if (!name || amount <= 0) continue;

        validNewItems.push({
          id: `fe-${randomUUID().slice(0, 8)}`,
          name,
          amount,
          category: String(raw.category || '기타').trim(),
          subCategory: raw.subCategory ? String(raw.subCategory).trim() : undefined,
          paymentMethod: String(raw.paymentMethod || '우리카드').trim(),
          cycle: raw.cycle || 'MONTHLY',
          payDay: String(raw.payDay || '1').trim(),
          startDate: String(raw.startDate || nowIso.slice(0, 10)).trim(),
          endDate: raw.endDate ? String(raw.endDate).trim() : null,
          isAutoPay: Boolean(raw.isAutoPay ?? true),
          isActive: Boolean(raw.isActive ?? true),
          memo: raw.memo ? String(raw.memo).trim() : undefined,
          merchantKeyword: raw.merchantKeyword ? String(raw.merchantKeyword).trim() : name,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (validNewItems.length === 0) {
        return NextResponse.json(
          { error: '유효한 고정비용 항목이 없습니다. (이름 및 1원 이상의 금액 필요)' },
          { status: 400 }
        );
      }

      items = [...validNewItems, ...items];

      await prisma.systemSetting.upsert({
        where: { key: FIXED_EXPENSES_SETTING_KEY },
        create: {
          key: FIXED_EXPENSES_SETTING_KEY,
          value: JSON.stringify(items),
          description: '가계부 고정비용 및 정기구독 관리 설정',
          category: 'CARD_HISTORY',
        },
        update: {
          value: JSON.stringify(items),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${validNewItems.length}개의 고정비용이 일괄 등록되었습니다.`,
        count: validNewItems.length,
        items: validNewItems,
      });
    }

    // 2. 단건 등록인 경우
    const name = String(body.name || '').trim();
    const amount = Math.round(Math.abs(Number(body.amount) || 0));

    if (!name || amount <= 0) {
      return NextResponse.json(
        { error: '고정비용 이름과 올바른 금액(1원 이상)을 입력해주세요.' },
        { status: 400 }
      );
    }

    const newItem: FixedExpenseItem = {
      id: `fe-${randomUUID().slice(0, 8)}`,
      name,
      amount,
      category: String(body.category || '기타').trim(),
      subCategory: body.subCategory ? String(body.subCategory).trim() : undefined,
      paymentMethod: String(body.paymentMethod || '우리카드').trim(),
      cycle: body.cycle || 'MONTHLY',
      payDay: String(body.payDay || '1').trim(),
      startDate: String(body.startDate || nowIso.slice(0, 10)).trim(),
      endDate: body.endDate ? String(body.endDate).trim() : null,
      isAutoPay: Boolean(body.isAutoPay ?? true),
      isActive: Boolean(body.isActive ?? true),
      memo: body.memo ? String(body.memo).trim() : undefined,
      merchantKeyword: body.merchantKeyword ? String(body.merchantKeyword).trim() : name,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    items = [newItem, ...items];

    await prisma.systemSetting.upsert({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
      create: {
        key: FIXED_EXPENSES_SETTING_KEY,
        value: JSON.stringify(items),
        description: '가계부 고정비용 및 정기구독 관리 설정',
        category: 'CARD_HISTORY',
      },
      update: {
        value: JSON.stringify(items),
      },
    });

    return NextResponse.json({
      success: true,
      message: `고정비용 [${newItem.name}]이 등록되었습니다.`,
      item: newItem,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/fixed-expenses POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '고정비용 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 고정비용 수정
 */
async function handlePATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = String(body.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: '수정할 고정비용 ID가 필요합니다.' }, { status: 400 });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
    });

    let items: FixedExpenseItem[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const itemIdx = items.findIndex((i) => i.id === id);
    if (itemIdx === -1) {
      return NextResponse.json({ error: '해당 고정비용을 찾을 수 없습니다.' }, { status: 404 });
    }

    const existing = items[itemIdx];
    const nowIso = new Date().toISOString();

    const updatedItem: FixedExpenseItem = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      amount: body.amount !== undefined ? Math.round(Math.abs(Number(body.amount) || 0)) : existing.amount,
      category: body.category !== undefined ? String(body.category).trim() : existing.category,
      subCategory: body.subCategory !== undefined ? (body.subCategory ? String(body.subCategory).trim() : undefined) : existing.subCategory,
      paymentMethod: body.paymentMethod !== undefined ? String(body.paymentMethod).trim() : existing.paymentMethod,
      cycle: body.cycle !== undefined ? body.cycle : existing.cycle,
      payDay: body.payDay !== undefined ? String(body.payDay).trim() : existing.payDay,
      startDate: body.startDate !== undefined ? String(body.startDate).trim() : existing.startDate,
      endDate: body.endDate !== undefined ? (body.endDate ? String(body.endDate).trim() : null) : existing.endDate,
      isAutoPay: body.isAutoPay !== undefined ? Boolean(body.isAutoPay) : existing.isAutoPay,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      memo: body.memo !== undefined ? (body.memo ? String(body.memo).trim() : undefined) : existing.memo,
      merchantKeyword: body.merchantKeyword !== undefined ? (body.merchantKeyword ? String(body.merchantKeyword).trim() : undefined) : existing.merchantKeyword,
      updatedAt: nowIso,
    };

    items[itemIdx] = updatedItem;

    await prisma.systemSetting.upsert({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
      create: {
        key: FIXED_EXPENSES_SETTING_KEY,
        value: JSON.stringify(items),
        description: '가계부 고정비용 및 정기구독 관리 설정',
        category: 'CARD_HISTORY',
      },
      update: {
        value: JSON.stringify(items),
      },
    });

    return NextResponse.json({
      success: true,
      message: `고정비용 [${updatedItem.name}]이 수정되었습니다.`,
      item: updatedItem,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/fixed-expenses PATCH] Error:', error);
    return NextResponse.json(
      { error: error?.message || '고정비용 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 고정비용 삭제 (단건 및 다중 선택 삭제 지원)
 */
async function handleDELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    let idsToDelete: string[] = [];

    const idsParam = url.searchParams.get('ids');
    const idParam = url.searchParams.get('id');

    if (idsParam) {
      idsToDelete = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (idParam) {
      idsToDelete = [idParam.trim()];
    } else {
      try {
        const body = await request.json();
        if (Array.isArray(body?.ids)) {
          idsToDelete = body.ids.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (body?.id) {
          idsToDelete = [String(body.id).trim()];
        }
      } catch {
        // Body might not be JSON or empty
      }
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: '삭제할 고정비용 ID가 필요합니다.' }, { status: 400 });
    }

    const deleteSet = new Set(idsToDelete);

    const setting = await prisma.systemSetting.findUnique({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
    });

    let items: FixedExpenseItem[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) items = parsed;
      } catch {}
    }

    const prevCount = items.length;
    items = items.filter((i) => !deleteSet.has(i.id));
    const deletedCount = prevCount - items.length;

    await prisma.systemSetting.upsert({
      where: { key: FIXED_EXPENSES_SETTING_KEY },
      create: {
        key: FIXED_EXPENSES_SETTING_KEY,
        value: JSON.stringify(items),
        description: '가계부 고정비용 및 정기구독 관리 설정',
        category: 'CARD_HISTORY',
      },
      update: {
        value: JSON.stringify(items),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        deletedCount > 1
          ? `${deletedCount}개의 고정비용 항목이 삭제되었습니다.`
          : '고정비용 항목이 삭제되었습니다.',
      deletedCount,
      deletedIds: Array.from(deleteSet),
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/fixed-expenses DELETE] Error:', error);
    return NextResponse.json(
      { error: error?.message || '고정비용 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
export const PATCH = withLedgerScope(handlePATCH);
export const DELETE = withLedgerScope(handleDELETE);
