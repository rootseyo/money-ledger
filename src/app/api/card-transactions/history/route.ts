import { withLedgerScope } from '@/lib/ledger-scope';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-token-auth';
import { fixedExpenseEdit } from '@/lib/fixed-expense-schedule';
import { Prisma, type CardTransaction } from '@/generated/client/client';
import { deleteLedgerRows, restoreLedgerRows, type BulkDeleteEntry } from '@/lib/ledger-bulk-delete';
import { captureRelated, restoreRelated, lockRelatedTransactions, type RelatedSnapshot } from '@/lib/ledger-related-history';
import { validateDuesEdit } from '@/lib/club-ledger-server';

type Entry = { before: CardTransaction | null; after: CardTransaction | null; fields: string[]; kind: 'update' | 'delete' | 'create'; related?: RelatedSnapshot };
const dates = ['notifiedAt', 'reportedAt', 'scheduledFor', 'createdAt', 'updatedAt'] as const;
const coreFields = ['sourceApp', 'type', 'amount', 'merchant', 'category', 'title', 'content', 'balance', 'cardOrAccount', 'notifiedAt', 'fixedExpenseId', 'fixedOccurrenceKey', 'scheduledFor'];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function revive(item: CardTransaction) {
  const restored = { ...item };
  for (const key of dates) if (restored[key]) Object.assign(restored, { [key]: new Date(restored[key]!) });
  return restored;
}

async function handlePOST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const actor = String(auth.admin?.id || auth.apiToken?.id || 'api-key');
  try {
    const body = await request.json();
    const result = await prisma.$transaction(async db => {
      if (body.action === 'undo') {
        if (typeof body.token !== 'string' || !/^[0-9a-f-]{36}$/.test(body.token)) throw new Error('되돌릴 작업을 선택해 주세요.');
        const key = `ledger-undo:${body.token}`;
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
        const saved = await db.systemSetting.findUnique({ where: { key } });
        if (!saved || saved.updatedBy !== actor || Date.now() - saved.createdAt.getTime() > 86400000) throw new Error('작업 취소 기록이 만료되었거나 이미 사용되었습니다.');
        const entry = JSON.parse(saved.value) as Entry | BulkDeleteEntry;
        if (entry.kind === 'delete-many') {
          await restoreLedgerRows(db, entry);
          await db.systemSetting.delete({ where: { key } });
          return { success: true };
        }
        const id = (entry.before || entry.after)!.id;
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger-edit:${id}`}))`;
        const current = await db.cardTransaction.findUnique({ where: { id } });
        if (entry.kind === 'delete') {
          if (current) throw new Error('같은 ID의 거래가 이미 존재합니다.');
          const previous = revive(entry.before!);
          await db.cardTransaction.create({ data: { ...previous, rawData: previous.rawData ?? Prisma.DbNull } });
          await restoreRelated(db, entry.related);
        } else {
          if (!current) throw new Error('거래가 삭제되어 작업을 취소할 수 없습니다.');
          const fields = entry.kind === 'create' ? coreFields : entry.fields;
          const live = current as unknown as Record<string, unknown>;
          const expected = entry.after as unknown as Record<string, unknown>;
          if (fields.some(field => !same(live[field], expected[field]))) throw new Error('거래가 다른 작업으로 변경되어 취소할 수 없습니다.');
          if (entry.kind === 'create') {
            if (await db.transactionReceipt.count({ where: { transactionId: id } }) || await db.duesPayment.count({ where: { transactionId: id } })) throw new Error('회비 또는 영수증이 연결된 거래입니다. 거래 삭제 기능을 사용해 주세요.');
            await db.cardTransaction.delete({ where: { id } });
          }
          else {
            const before = revive(entry.before!) as unknown as Record<string, unknown>;
            const changes = Object.fromEntries(entry.fields.map(field => [field, before[field]]));
            await validateDuesEdit(id, changes);
            await db.cardTransaction.update({ where: { id }, data: changes });
          }
        }
        await db.systemSetting.delete({ where: { key } });
        return { success: true };
      }
      if (body.action === 'delete-many') return deleteLedgerRows(db, body.ids, actor);
      if (typeof body.id !== 'string' || !body.id) throw new Error('거래를 선택해 주세요.');
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger-edit:${body.id}`}))`;
      let before = await db.cardTransaction.findUnique({ where: { id: body.id } });
      if (!before) throw new Error('거래를 찾을 수 없습니다.');
      await lockRelatedTransactions(db, [before.id]);
      before = await db.cardTransaction.findUnique({ where: { id: body.id } });
      if (!before) throw new Error('거래를 찾을 수 없습니다.');
      let entry: Entry;
      let transaction: CardTransaction | null = before;
      if (body.action === 'track-create') {
        const raw = before.rawData as Record<string, unknown> | null;
        if (raw?.manual !== true || raw.entryId !== body.entryId || Date.now() - before.createdAt.getTime() > 900000) throw new Error('새로 등록한 거래만 취소 기록에 추가할 수 있습니다.');
        entry = { before: null, after: before, fields: [], kind: 'create' };
      } else if (body.action === 'delete') {
        const related = await captureRelated(db, [before.id]);
        await db.cardTransaction.delete({ where: { id: before.id } });
        transaction = null;
        entry = { before, after: null, fields: [], kind: 'delete', related };
      } else if (body.action === 'update') {
        const input = body.changes || {};
        const changes: Prisma.CardTransactionUpdateInput = {};
        for (const field of ['merchant', 'category', 'content', 'cardOrAccount', 'sourceApp', 'type'] as const) {
          if (input[field] !== undefined) {
            const value = String(input[field] ?? '').trim();
            if (field === 'merchant' && !value) throw new Error('사용처를 입력해 주세요.');
            Object.assign(changes, { [field]: ['category', 'cardOrAccount'].includes(field) ? value || null : value });
          }
        }
        if (input.amount !== undefined) {
          const amount = Number(input.amount);
          if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('올바른 금액을 입력해 주세요.');
          changes.amount = amount;
        }
        const notifiedAt = input.notifiedAt !== undefined ? new Date(input.notifiedAt) : undefined;
        if (notifiedAt) changes.notifiedAt = notifiedAt;
        Object.assign(changes, fixedExpenseEdit(before, { notifiedAt, amount: typeof changes.amount === 'number' ? changes.amount : undefined, type: typeof changes.type === 'string' ? changes.type : undefined }));
        if (typeof changes.type === 'string' && !['PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'CANCEL', 'OTHER'].includes(changes.type)) throw new Error('올바른 거래 구분을 선택해 주세요.');
        await validateDuesEdit(before.id, changes);
        transaction = await db.cardTransaction.update({ where: { id: before.id }, data: changes });
        entry = { before, after: transaction, fields: Object.keys(changes), kind: 'update' };
      } else throw new Error('올바른 작업을 선택해 주세요.');
      const token = randomUUID();
      await db.systemSetting.create({ data: { key: `ledger-undo:${token}`, category: 'LEDGER_UNDO', updatedBy: actor, value: JSON.stringify(entry) } });
      // Undo snapshots contain financial data; keep them for at most one day.
      await db.systemSetting.deleteMany({ where: { category: 'LEDGER_UNDO', createdAt: { lt: new Date(Date.now() - 86400000) } } });
      return { success: true, transaction, undoToken: token, ...(body.action === 'delete' ? { deletedIds: [before.id] } : {}) };
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '작업을 처리하지 못했습니다.' }, { status: 409 });
  }
}

export const POST = withLedgerScope(handlePOST);
