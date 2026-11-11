import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { monthBounds, validMonth } from '@/lib/fixed-expense-schedule';
import { createMonthlyFixedExpense, importMonthlyFixedExpenses, linkFixedPayment, removeMonthlyFixedExpense, toggleMonthlyFixedExpenseChecked, syncMonthlyFixedExpensesChecked } from '@/lib/monthly-fixed-expenses-server';
export const dynamic = 'force-dynamic';

async function handleGET(request: NextRequest) {
  if (!verifyAdminToken(request)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const month = request.nextUrl.searchParams.get('month');
  if (!validMonth(month)) return NextResponse.json({ error: '월을 선택해 주세요.' }, { status: 400 });
  try {
    const { start, end } = monthBounds(month);
    const [setting, transactions] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: `household-fixed-month:${month}` } }),
      prisma.cardTransaction.findMany({ where: { fixedExpenseId: { not: null }, scheduledFor: { gte: start, lte: end } }, orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }] }),
    ]);
    return NextResponse.json({ imported: !!setting, transactions, now: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: '고정비를 불러오지 못했습니다.' }, { status: 500 }); }
}
async function handlePOST(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const body = await request.json();
    const { month, force } = body;
    if (!validMonth(month)) return NextResponse.json({ error: '올바른 월을 선택해 주세요.' }, { status: 400 });
    if (body.action === 'create') {
      try { return NextResponse.json(await createMonthlyFixedExpense(month, admin.id, body)); }
      catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '고정비 등록에 실패했습니다.' }, { status: 400 }); }
    }
    return NextResponse.json(await importMonthlyFixedExpenses(month, admin.id, Boolean(force)));
  } catch (error) {
    console.error('Error importing monthly fixed expenses:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '고정비 추가에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
  }
}
async function handlePATCH(request: NextRequest) {
  if (!verifyAdminToken(request)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const body = await request.json();
    if (body.action === 'toggleCheck' || typeof body.checked === 'boolean') {
      const { id, checked } = body;
      if (typeof id !== 'string' || !id) return NextResponse.json({ error: '고정비를 선택해 주세요.' }, { status: 400 });
      return NextResponse.json(await toggleMonthlyFixedExpenseChecked(id, Boolean(checked)));
    }
    if (body.action === 'syncChecked') {
      const { month, checkedIds } = body;
      if (!validMonth(month) || !Array.isArray(checkedIds)) return NextResponse.json({ error: '올바른 동기화 요청이 아닙니다.' }, { status: 400 });
      return NextResponse.json(await syncMonthlyFixedExpensesChecked(month, checkedIds));
    }
    const { scheduledId, actualId } = body;
    if (typeof scheduledId !== 'string' || typeof actualId !== 'string' || scheduledId === actualId) return NextResponse.json({ error: '연결할 거래를 선택해 주세요.' }, { status: 400 });
    return NextResponse.json(await linkFixedPayment(scheduledId, actualId));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '요청 처리에 실패했습니다.' }, { status: 409 }); }
}

async function handleDELETE(request: NextRequest) {
  if (!verifyAdminToken(request)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !id) return NextResponse.json({ error: '고정비를 선택해 주세요.' }, { status: 400 });
    return NextResponse.json(await removeMonthlyFixedExpense(id));
  } catch { return NextResponse.json({ error: '고정비를 제외하지 못했습니다. 새로고침 후 다시 시도해 주세요.' }, { status: 409 }); }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
export const PATCH = withLedgerScope(handlePATCH);
export const DELETE = withLedgerScope(handleDELETE);
