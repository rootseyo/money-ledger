import { withLedgerScope } from '@/lib/ledger-scope';
import { fixedExpenseEdit, SCHEDULED_FIXED_PACKAGE, recognizedTransactionsWhere } from '@/lib/fixed-expense-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { saveCardTransaction, CardTransactionInput } from '@/lib/card-service';
import { authenticateRequest } from '@/lib/api-token-auth';
import { ledgerOrderBy, type LedgerSortField } from '@/lib/card-ledger-display';
import { validateDuesEdit, ClubLedgerError } from '@/lib/club-ledger-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handlePOST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();

    // 필수 필드 검증: 금액(amount)과 (내용/가맹점/제목 중 하나)
    if (body.amount === undefined || (!body.content && !body.title && !body.merchant)) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다. (금액(amount)과 내용/가맹점/제목 중 하나가 필요합니다.)" },
        { status: 400 }
      );
    }

    const title = String(body.title || body.merchant || body.content || "거래 내역").trim();
    const content = String(body.rawData?.manual && typeof body.content === "string" ? body.content : body.content || body.title || body.merchant || "").trim();
    const sourceApp = String(body.sourceApp || body.paymentMethod || "MANUAL").trim();

    const packageName = body.packageName ? String(body.packageName).trim() : null;
    if (packageName === SCHEDULED_FIXED_PACKAGE) return NextResponse.json({ error: '예약 고정비는 고정비 추가 기능으로 등록해 주세요.' }, { status: 400 });
    const merchant = body.merchant ? String(body.merchant).replace(/^세요\)\s*/, '').trim() : null;

    const input: CardTransactionInput = {
      sourceApp,
      type: String(body.type || "PAYMENT").trim().toUpperCase(),
      amount: Math.round(Math.abs(Number(body.amount) || 0)),
      merchant,
      category: body.category ? String(body.category).trim() : null,
      title,
      content,
      balance: body.balance !== undefined && body.balance !== null ? Number(body.balance) : null,
      cardOrAccount: body.cardOrAccount ? String(body.cardOrAccount).trim() : (body.paymentMethod ? String(body.paymentMethod).trim() : null),
      packageName,
      notifiedAt: body.notifiedAt ? new Date(body.notifiedAt) : new Date(),
      isReported: body.isReported !== undefined ? Boolean(body.isReported) : false,
      reportedAt: body.reportedAt ? new Date(body.reportedAt) : null,
      rawData: body.rawData || (body.memo || body.tags ? { memo: body.memo, tags: body.tags } : null),
    };

    const result = await saveCardTransaction(input);

    return NextResponse.json({
      success: true,
      message: result.isDuplicate ? '이미 등록된 내역(중복 무시)' : '등록 완료',
      isDuplicate: result.isDuplicate,
      transaction: result.transaction,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions] Error:', error);
    return NextResponse.json(
      { error: error?.message || '트랜잭션 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function handleGET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));
    const skip = (page - 1) * limit;

    const sourceApp = searchParams.get('sourceApp');
    const category = searchParams.get('category');
    const type = searchParams.get('type');
    const query = searchParams.get('query')?.trim();
    const isReported = searchParams.get('isReported');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const month = searchParams.get('month')?.trim(); // YYYY-MM
    const year = searchParams.get('year')?.trim(); // YYYY
    const date = searchParams.get('date')?.trim(); // YYYY-MM-DD
    const sort = searchParams.get('sort')?.trim(); // asc | desc

    const sortByRaw = searchParams.get('sortBy');
    const sortField: LedgerSortField = (
      sortByRaw === 'merchant' || sortByRaw === 'category' || sortByRaw === 'content' || sortByRaw === 'amount' || sortByRaw === 'balance' || sortByRaw === 'received'
    ) ? sortByRaw : 'notified';
    const where: any = { AND: [recognizedTransactionsWhere()] };
    if (sourceApp && sourceApp !== 'ALL') where.sourceApp = sourceApp;
    if (category && category !== 'ALL') where.category = category;
    if (type && type !== 'ALL') where.type = type;
    if (isReported !== null && isReported !== undefined && isReported !== '' && isReported !== 'ALL') {
      where.isReported = isReported === 'true';
    }

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      where.notifiedAt = {
        gte: new Date(`${date}T00:00:00+09:00`),
        lte: new Date(`${date}T23:59:59.999+09:00`),
      };
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const lastDay = new Date(y, m, 0).getDate();
      const padM = String(m).padStart(2, '0');
      where.notifiedAt = {
        gte: new Date(`${y}-${padM}-01T00:00:00+09:00`),
        lte: new Date(`${y}-${padM}-${String(lastDay).padStart(2, '0')}T23:59:59.999+09:00`),
      };
    } else if (year && /^\d{4}$/.test(year)) {
      const y = parseInt(year, 10);
      where.notifiedAt = {
        gte: new Date(`${y}-01-01T00:00:00+09:00`),
        lte: new Date(`${y}-12-31T23:59:59.999+09:00`),
      };
    } else if (startDate || endDate) {
      where.notifiedAt = {};
      if (startDate) where.notifiedAt.gte = new Date(startDate);
      if (endDate) where.notifiedAt.lte = new Date(endDate);
    }

    if (query) {
      where.OR = [
        { merchant: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { cardOrAccount: { contains: query, mode: 'insensitive' } },
        { title: { contains: query, mode: 'insensitive' } },
      ];
    }

    const [total, transactions] = await Promise.all([
      prisma.cardTransaction.count({ where }),
      prisma.cardTransaction.findMany({
        where,
        include: { _count: { select: { receipts: true } }, duesPayment: { include: { member: { select: { name: true } } } } },
        orderBy: ledgerOrderBy(sortField, sort === 'asc' ? 'asc' : 'desc'),
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      transactions,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '트랜잭션 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function handlePATCH(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const body = await request.json();
    const { id, category, merchant, amount, type, cardOrAccount, content, notifiedAt, sourceApp, balance } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '유효한 거래 ID가 필요합니다.' }, { status: 400 });
    }

    const updateData: any = {};
    if (category !== undefined) updateData.category = category ? String(category).trim() : null;
    if (merchant !== undefined) updateData.merchant = merchant ? String(merchant).trim() : null;
    if (amount !== undefined) updateData.amount = Math.round(Number(amount)) || 0;
    if (type !== undefined) updateData.type = String(type).trim().toUpperCase();
    if (cardOrAccount !== undefined) updateData.cardOrAccount = cardOrAccount ? String(cardOrAccount).trim() : null;
    if (content !== undefined) updateData.content = String(content).trim();
    if (sourceApp !== undefined) updateData.sourceApp = String(sourceApp).trim().toUpperCase();
    if (notifiedAt !== undefined) updateData.notifiedAt = new Date(notifiedAt);
    if (balance !== undefined) updateData.balance = (balance === null || balance === '') ? null : Math.round(Number(balance));

    const existing = await prisma.cardTransaction.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
    await validateDuesEdit(id, updateData);
    try { Object.assign(updateData, fixedExpenseEdit(existing, updateData)); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '올바른 값을 입력해 주세요.' }, { status: 400 }); }
    const updated = await prisma.cardTransaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      transaction: updated,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions PATCH] Error:', error);
    return NextResponse.json(
      { error: error?.message || '거래 내역 수정 중 오류가 발생했습니다.' },
      { status: error instanceof ClubLedgerError ? error.status : 500 }
    );
  }
}

async function handleDELETE(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const queryId = searchParams.get('id');

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const ids: string[] = [];
    if (queryId) ids.push(queryId);
    if (body?.id) ids.push(String(body.id));
    if (Array.isArray(body?.ids)) ids.push(...body.ids.map(String));

    const deleteAll = body?.deleteAll === true || searchParams.get('all') === 'true';

    if (deleteAll) {
      const deleteResult = await prisma.cardTransaction.deleteMany({});
      return NextResponse.json({
        success: true,
        count: deleteResult.count,
        message: `전체 ${deleteResult.count}건의 사용 이력이 삭제되었습니다.`,
      });
    }

    if (ids.length === 0) {
      return NextResponse.json(
        { error: '삭제할 대상 ID가 지정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const uniqueIds = Array.from(new Set(ids));
    const deleteResult = await prisma.cardTransaction.deleteMany({
      where: { id: { in: uniqueIds } },
    });

    return NextResponse.json({
      success: true,
      count: deleteResult.count,
      message: `${deleteResult.count}건의 사용 이력이 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions DELETE] Error:', error);
    return NextResponse.json(
      { error: error?.message || '트랜잭션 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const POST = withLedgerScope(handlePOST);
export const GET = withLedgerScope(handleGET);
export const PATCH = withLedgerScope(handlePATCH);
export const DELETE = withLedgerScope(handleDELETE);
