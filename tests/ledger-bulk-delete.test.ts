import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteLedgerRows, ledgerDeleteIds, restoreLedgerRows, type BulkDeleteEntry } from '../src/lib/ledger-bulk-delete';
import type { CardTransaction } from '../src/generated/client/client';
import { dataScope } from '../src/lib/data-scope';
import { captureRelated, restoreRelated } from '../src/lib/ledger-related-history';

const record = (id: string) => ({ id, type: 'PAYMENT', amount: 1000, merchant: '카페', category: '식비', title: '카페', content: '메모',
  notifiedAt: new Date('2026-09-30T15:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
  sourceApp: 'MANUAL', userId: 'member', balance: null, cardOrAccount: null, packageName: null, reportedAt: null, isReported: false,
  scheduledFor: null, fixedExpenseId: null, fixedOccurrenceKey: null, rawData: null } as CardTransaction);

function fixture(rows: CardTransaction[]) {
  const state = { rows: [...rows], snapshots: [] as any[], locks: [] as string[], deletedCalls: 0 };
  const db = {
    $queryRaw: async () => [],
    $executeRaw: async (_strings: TemplateStringsArray, ids: string) => { state.locks.push(ids); return 1; },
    cardTransaction: {
      findMany: async ({ where }: any) => state.rows.filter(row => where.id.in.includes(row.id)),
      count: async ({ where }: any) => state.rows.filter(row => where.id.in.includes(row.id)).length,
      deleteMany: async ({ where }: any) => { state.deletedCalls++; const old = state.rows.length; state.rows = state.rows.filter(row => !where.id.in.includes(row.id)); return { count: old - state.rows.length }; },
      createMany: async ({ data }: any) => { state.rows.push(...data); return { count: data.length }; },
    },
    systemSetting: { create: async ({ data }: any) => { state.snapshots.push(data); return data; }, deleteMany: async () => ({ count: 0 }) },
    duesPayment: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
    transactionReceipt: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
  } as unknown as Parameters<typeof deleteLedgerRows>[0];
  return { state, db };
}

test('bulk delete validates IDs, deduplicates rows and stores one undo record for the entire selection', async () => {
  for (const input of [null, [], [''], ['one', null], Array(10001).fill('one')]) assert.throws(() => ledgerDeleteIds(input));
  assert.deepEqual(ledgerDeleteIds(['b', 'a', 'b']), ['a', 'b']);
  const { db, state } = fixture([record('a'), record('b'), record('c')]);
  const result = await deleteLedgerRows(db, ['b', 'a', 'b'], 'actor');
  assert.deepEqual(result.deletedIds, ['a', 'b']);
  assert.deepEqual(state.rows.map(row => row.id), ['c']);
  assert.equal(state.snapshots.length, 1); assert.equal(state.snapshots[0].updatedBy, 'actor');
  assert.equal(state.locks[0], JSON.stringify(['a', 'b']));
  const snapshot = JSON.parse(state.snapshots[0].value) as BulkDeleteEntry;
  assert.equal(snapshot.kind, 'delete-many'); assert.equal(snapshot.before.length, 2);
  await restoreLedgerRows(db, snapshot);
  assert.deepEqual(state.rows.map(row => row.id).sort(), ['a', 'b', 'c']);
  assert.equal(state.rows.find(row => row.id === 'a')!.notifiedAt.toISOString(), '2026-09-30T15:00:00.000Z');
});

test('a stale or unauthorized ID prevents any selected row from being deleted', async () => {
  const { db, state } = fixture([record('a')]);
  await assert.rejects(deleteLedgerRows(db, ['a', 'not-visible'], 'actor'));
  assert.equal(state.deletedCalls, 0); assert.equal(state.snapshots.length, 0);
  assert.equal(state.rows.length, 1);
});

test('undo refuses the entire restoration if any original ID is already present', async () => {
  const { db, state } = fixture([record('a')]);
  await assert.rejects(restoreLedgerRows(db, { kind: 'delete-many', before: [record('a'), record('b')] }));
  assert.deepEqual(state.rows.map(row => row.id), ['a']);
});

test('deletion snapshots preserve binary receipts and dues, and cannot restore into another workspace', async () => {
  const restored: any = {};
  const receipt = { id: 'receipt', transactionId: 'a', name: '영수증.png', mimeType: 'image/png', size: 4, data: Uint8Array.from([0, 255, 13, 10]), createdAt: new Date('2026-10-15T00:00:00Z') };
  const due = { transactionId: 'a', memberId: 'member', month: '2026-09' };
  const db = {
    duesPayment: { findMany: async () => [due], createMany: async ({ data }: any) => { restored.dues = data; } },
    transactionReceipt: { findMany: async () => [receipt], createMany: async ({ data }: any) => { restored.receipts = data; } },
  } as unknown as Parameters<typeof captureRelated>[0];
  const snapshot = await dataScope.run({ id: 'user', role: 'MEMBER', householdId: 'club' }, () => captureRelated(db, ['a']));
  const serialized = JSON.parse(JSON.stringify(snapshot));
  await dataScope.run({ id: 'user', role: 'MEMBER', householdId: 'other-club' }, () => assert.rejects(restoreRelated(db, serialized), /원래 가계부/));
  assert.equal(restored.receipts, undefined);
  await dataScope.run({ id: 'user', role: 'MEMBER', householdId: 'club' }, () => restoreRelated(db, serialized));
  assert.deepEqual(restored.dues, [due]);
  assert.deepEqual([...restored.receipts[0].data], [...receipt.data]);
  assert.equal(restored.receipts[0].createdAt.toISOString(), receipt.createdAt.toISOString());
});
