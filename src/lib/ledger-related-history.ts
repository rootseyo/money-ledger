import { dataScope } from './data-scope';
import type { prisma } from './db';

type Database = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
export type RelatedSnapshot = {
  workspaceId: string;
  dues: { transactionId: string; memberId: string; month: string }[];
  receipts: { id: string; transactionId: string; name: string; mimeType: string; size: number; data: string; createdAt: string }[];
};
// Call after verifying these transaction IDs with the scoped Prisma client.
export async function lockRelatedTransactions(db: Database, ids: string[]) {
  await db.$queryRaw`SELECT "id" FROM "card_transactions" WHERE "id" IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)) ORDER BY "id" FOR UPDATE`;
}
export async function captureRelated(db: Database, ids: string[]): Promise<RelatedSnapshot> {
  const scope = dataScope.getStore();
  const [dues, receipts] = await Promise.all([
    db.duesPayment.findMany({ where: { transactionId: { in: ids } } }),
    db.transactionReceipt.findMany({ where: { transactionId: { in: ids } } }),
  ]);
  return { workspaceId: scope?.householdId || scope?.id || '', dues, receipts: receipts.map(receipt => ({ ...receipt, data: Buffer.from(receipt.data).toString('base64'), createdAt: receipt.createdAt.toISOString() })) };
}
export async function restoreRelated(db: Database, snapshot?: RelatedSnapshot) {
  if (!snapshot) return;
  const scope = dataScope.getStore();
  if (snapshot.workspaceId !== (scope?.householdId || scope?.id || '')) throw new Error('원래 가계부에서만 회비와 영수증을 복원할 수 있습니다.');
  if (snapshot.dues.length) await db.duesPayment.createMany({ data: snapshot.dues });
  if (snapshot.receipts.length) await db.transactionReceipt.createMany({ data: snapshot.receipts.map(receipt => ({ ...receipt, data: Buffer.from(receipt.data, 'base64'), createdAt: new Date(receipt.createdAt) })) });
}
