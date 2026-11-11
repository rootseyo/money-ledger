import { withLedgerScope } from '@/lib/ledger-scope';
import { fixedExpenseEdit } from '@/lib/fixed-expense-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-token-auth';
import { autoDetectCategory } from '@/lib/household-categories';
import { validateDuesEdit, ClubLedgerError } from '@/lib/club-ledger-server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/card-transactions/[id]
 * 단일 거래 상세 조회
 */
async function handleGET(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const { id } = await context.params;
    const transaction = await prisma.cardTransaction.findUnique({
      where: { id },
      include: { _count: { select: { receipts: true } }, duesPayment: { include: { member: { select: { name: true } } } } },
    });

    if (!transaction) {
      return NextResponse.json({ error: '해당 거래 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (err: unknown) {
    console.error('[API /api/card-transactions/[id] GET] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '거래 내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/card-transactions/[id]
 * 거래 내역 수정
 */
async function handlePUT(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.cardTransaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: '수정할 거래 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (body.amount !== undefined) {
      dataToUpdate.amount = Math.round(Math.abs(Number(body.amount) || 0));
    }
    if (body.type !== undefined) {
      dataToUpdate.type = String(body.type);
    }
    if (body.merchant !== undefined) {
      dataToUpdate.merchant = body.merchant ? String(body.merchant).trim() : null;
    }
    if (body.category !== undefined) {
      dataToUpdate.category = body.category ? String(body.category).trim() : null;
    }
    if (body.title !== undefined) {
      dataToUpdate.title = String(body.title).trim();
    }
    if (body.content !== undefined) {
      dataToUpdate.content = String(body.content).trim();
    }
    if (body.cardOrAccount !== undefined) {
      dataToUpdate.cardOrAccount = body.cardOrAccount ? String(body.cardOrAccount).trim() : null;
    }
    if (body.sourceApp !== undefined) {
      dataToUpdate.sourceApp = String(body.sourceApp);
    }
    if (body.notifiedAt !== undefined) {
      const parsedDate = new Date(body.notifiedAt);
      if (!isNaN(parsedDate.getTime())) {
        dataToUpdate.notifiedAt = parsedDate;
      }
    }
    if (body.isReported !== undefined) {
      dataToUpdate.isReported = Boolean(body.isReported);
    }

    // Auto detect category if merchant/title is updated and category is empty
    if (!dataToUpdate.category && !existing.category && (dataToUpdate.merchant || existing.merchant)) {
      dataToUpdate.category = autoDetectCategory(
        dataToUpdate.merchant || existing.merchant,
        dataToUpdate.title || existing.title,
        dataToUpdate.content || existing.content
      );
    }

    await validateDuesEdit(id, dataToUpdate);
    try { Object.assign(dataToUpdate, fixedExpenseEdit(existing, dataToUpdate)); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '올바른 값을 입력해 주세요.' }, { status: 400 }); }
    const updated = await prisma.cardTransaction.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      transaction: updated,
      message: '거래 내역이 성공적으로 수정되었습니다.',
    });
  } catch (err: unknown) {
    console.error('[API /api/card-transactions/[id] PUT] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '거래 내역 수정 중 오류가 발생했습니다.' },
      { status: err instanceof ClubLedgerError ? err.status : 500 }
    );
  }
}

/**
 * DELETE /api/card-transactions/[id]
 * 거래 내역 단건 삭제
 */
async function handleDELETE(request: NextRequest, context: RouteContext) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || '인증되지 않은 요청입니다.' }, { status: auth.status || 401 });
  }

  try {
    const { id } = await context.params;

    const existing = await prisma.cardTransaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: '삭제할 거래 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.cardTransaction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '거래 내역이 성공적으로 삭제되었습니다.',
      deletedId: id,
    });
  } catch (err: unknown) {
    console.error('[API /api/card-transactions/[id] DELETE] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '거래 내역 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const PUT = withLedgerScope(handlePUT);
export const DELETE = withLedgerScope(handleDELETE);
