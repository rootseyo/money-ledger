import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withLedgerScope } from '@/lib/ledger-scope';
import { transactionBoundary } from '@/lib/data-scope';
import { clubWorkspace, ClubLedgerError } from '@/lib/club-ledger-server';
import { validDuesAmount, validDuesMonth } from '@/lib/club-ledger';
import { kstDate } from '@/lib/fixed-expense-schedule';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const transactionInclude = { transaction: { include: { _count: { select: { receipts: true } } } }, member: true } as const;

async function get(request: NextRequest) {
  try {
    const { scope, workspaceId, household } = await clubWorkspace();
    const month = request.nextUrl.searchParams.get('month');
    if (!validDuesMonth(month)) throw new ClubLedgerError('조회할 월을 확인해 주세요.');
    const memberId = request.nextUrl.searchParams.get('memberId');
    const boundary = { member: { workspaceId }, transaction: transactionBoundary(scope) };
    const [members, payments, history] = await Promise.all([
      prisma.ledgerMember.findMany({ where: { workspaceId }, orderBy: [{ archived: 'asc' }, { name: 'asc' }] }),
      prisma.duesPayment.findMany({ where: { ...boundary, month }, include: transactionInclude, orderBy: { transaction: { notifiedAt: 'desc' } } }),
      memberId ? prisma.duesPayment.findMany({ where: { ...boundary, memberId }, include: transactionInclude, orderBy: { transaction: { notifiedAt: 'desc' } }, take: 200 }) : Promise.resolve([]),
    ]);
    return json({ members, payments, history, monthlyDues: household.monthlyDues || 0, canEdit: scope.householdRole !== 'VIEWER' });
  } catch (error) {
    if (error instanceof ClubLedgerError) return json({ error: error.message }, error.status);
    console.error('Club dues GET failed', error);
    return json({ error: '회비 내역을 불러오지 못했습니다.' }, 500);
  }
}

async function post(request: NextRequest) {
  try {
    const { scope, workspaceId } = await clubWorkspace();
    const body = await request.json();
    if (body.action === 'add-member' || body.action === 'rename-member') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 40) throw new ClubLedgerError('구성원 이름을 1~40자로 입력해 주세요.');
      if (body.action === 'rename-member') {
        const result = await prisma.ledgerMember.updateMany({ where: { id: String(body.memberId || ''), workspaceId }, data: { name } });
        if (!result.count) throw new ClubLedgerError('구성원을 찾을 수 없습니다.', 404);
      } else {
        await prisma.ledgerMember.create({ data: { workspaceId, name } });
      }
      return json({ success: true });
    }
    if (body.action === 'import-members') {
      const users = await prisma.user.findMany({ where: { id: { in: scope.memberIds || [] } }, select: { id: true, name: true } });
      await prisma.ledgerMember.createMany({ data: users.map(user => ({ workspaceId, userId: user.id, name: user.name })), skipDuplicates: true });
      return json({ success: true });
    }
    if (body.action === 'archive-member') {
      if (typeof body.archived !== 'boolean') throw new ClubLedgerError('활동 상태를 확인해 주세요.');
      const result = await prisma.ledgerMember.updateMany({ where: { id: String(body.memberId || ''), workspaceId }, data: { archived: body.archived } });
      if (!result.count) throw new ClubLedgerError('구성원을 찾을 수 없습니다.', 404);
      return json({ success: true });
    }
    if (body.action === 'unlink') {
      const transaction = await prisma.cardTransaction.findUnique({ where: { id: String(body.transactionId || '') } });
      if (!transaction) throw new ClubLedgerError('거래를 찾을 수 없습니다.', 404);
      await prisma.duesPayment.deleteMany({ where: { transactionId: transaction.id, member: { workspaceId } } });
      return json({ success: true });
    }
    if (body.action !== 'payment' && body.action !== 'link') throw new ClubLedgerError('요청을 확인해 주세요.');
    if (!validDuesMonth(body.month)) throw new ClubLedgerError('회비 대상 월을 확인해 주세요.');
    const member = await prisma.ledgerMember.findFirst({ where: { id: String(body.memberId || ''), workspaceId, archived: false } });
    if (!member) throw new ClubLedgerError('활동 중인 구성원을 선택해 주세요.');

    if (body.action === 'link') {
      const transaction = await prisma.cardTransaction.findUnique({ where: { id: String(body.transactionId || '') } });
      if (!transaction || transaction.type !== 'DEPOSIT' || transaction.amount <= 0 || transaction.fixedExpenseId || transaction.scheduledFor) throw new ClubLedgerError('일반 수입 거래를 선택해 주세요.');
      const existing = await prisma.duesPayment.findUnique({ where: { transactionId: transaction.id }, include: { member: true } });
      if (existing && existing.member.workspaceId !== workspaceId) throw new ClubLedgerError('다른 가계부의 회비 연결은 변경할 수 없습니다.', 403);
      await prisma.duesPayment.upsert({ where: { transactionId: transaction.id }, create: { transactionId: transaction.id, memberId: member.id, month: body.month }, update: { memberId: member.id, month: body.month } });
      return json({ success: true });
    }
    const amount = Number(body.amount);
    const date = typeof body.date === 'string' ? body.date : '';
    const paidAt = new Date(`${date}T12:00:00+09:00`);
    if (!validDuesAmount(amount)) throw new ClubLedgerError('0원보다 큰 올바른 금액을 입력해 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(paidAt.getTime()) || kstDate(paidAt) !== date) throw new ClubLedgerError('입금일을 확인해 주세요.');
    const id = typeof body.entryId === 'string' && /^[0-9a-f-]{36}$/i.test(body.entryId) ? body.entryId : randomUUID();
    const transaction = await prisma.$transaction(async db => {
      const previous = await db.cardTransaction.findUnique({ where: { id }, include: { duesPayment: true } });
      if (previous) {
        if (previous.duesPayment?.memberId !== member.id || previous.duesPayment.month !== body.month || previous.amount !== amount) throw new ClubLedgerError('이미 사용된 거래 번호입니다.', 409);
        return previous;
      }
      return db.cardTransaction.create({ data: {
        id, sourceApp: 'MANUAL', type: 'DEPOSIT', amount, merchant: member.name,
        category: '정기 회비', title: `${member.name} 회비`, content: typeof body.memo === 'string' ? body.memo.trim().slice(0, 2000) : '', notifiedAt: paidAt,
        rawData: { manual: true, entryId: id }, duesPayment: { create: { memberId: member.id, month: body.month } },
      } });
    });
    return json({ success: true, transaction }, 201);
  } catch (error) {
    if (error instanceof ClubLedgerError) return json({ error: error.message }, error.status);
    console.error('Club dues POST failed', error);
    return json({ error: '회비 정보를 저장하지 못했습니다.' }, 500);
  }
}

export const GET = withLedgerScope(get);
export const POST = withLedgerScope(post);
