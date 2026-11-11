import { randomUUID } from 'node:crypto';
import { Prisma, type CardTransaction } from '@/generated/client/client';
import type { prisma } from './db';
import { captureRelated, restoreRelated, lockRelatedTransactions, type RelatedSnapshot } from './ledger-related-history';

type Database = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
export interface BulkDeleteEntry { kind: 'delete-many'; before: CardTransaction[]; related?: RelatedSnapshot }

export function ledgerDeleteIds(input: unknown): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 10000 || input.some(id => typeof id !== 'string' || !id.trim() || id.length > 100)) {
    throw new Error('삭제할 거래를 1~10,000건 선택해 주세요.');
  }
  return [...new Set(input as string[])].sort();
}

async function lockRows(db: Database, ids: string[]) {
  // Shared with single-row edits. Lock in stable order, using one database round trip.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ledger-edit:' || id)) FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb) AS ids(id) ORDER BY id`;
}

/** Called inside the scoped interactive transaction, so snapshots and deletion commit together. */
export async function deleteLedgerRows(db: Database, input: unknown, actor: string) {
  const ids = ledgerDeleteIds(input);
  await lockRows(db, ids);
  let before = await db.cardTransaction.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  if (before.length !== ids.length) throw new Error('일부 거래가 변경되었거나 삭제 권한이 없습니다. 내역을 확인한 뒤 다시 선택해 주세요.');
  await lockRelatedTransactions(db, ids);
  before = await db.cardTransaction.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
  if (before.length !== ids.length) throw new Error('일부 거래가 변경되었습니다. 다시 선택해 주세요.');
  const related = await captureRelated(db, ids);
  const removed = await db.cardTransaction.deleteMany({ where: { id: { in: ids } } });
  if (removed.count !== ids.length) throw new Error('선택한 거래를 모두 삭제하지 못했습니다. 다시 시도해 주세요.');
  const token = randomUUID();
  const entry: BulkDeleteEntry = { kind: 'delete-many', before, related };
  await db.systemSetting.create({ data: { key: `ledger-undo:${token}`, category: 'LEDGER_UNDO', updatedBy: actor, value: JSON.stringify(entry) } });
  await db.systemSetting.deleteMany({ where: { category: 'LEDGER_UNDO', createdAt: { lt: new Date(Date.now() - 86400000) } } });
  return { success: true, transaction: null, deletedIds: ids, undoToken: token };
}

export async function restoreLedgerRows(db: Database, entry: BulkDeleteEntry) {
  const ids = ledgerDeleteIds(entry.before.map(row => row.id));
  await lockRows(db, ids);
  if (await db.cardTransaction.count({ where: { id: { in: ids } } })) throw new Error('같은 ID의 거래가 이미 존재하여 일괄 삭제를 취소할 수 없습니다.');
  await db.cardTransaction.createMany({ data: entry.before.map(row => ({ ...row,
    notifiedAt: new Date(row.notifiedAt), createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
    reportedAt: row.reportedAt ? new Date(row.reportedAt) : null,
    scheduledFor: row.scheduledFor ? new Date(row.scheduledFor) : null,
    rawData: row.rawData ?? Prisma.DbNull,
  })) });
  await restoreRelated(db, entry.related);
}
