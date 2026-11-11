import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultTransactionDate, kstDatetime, transactionDraft, transactionEntryPayload } from '../src/lib/transaction-entry';
import type { Transaction } from '../src/components/ledger/ledger-types';
import { prisma } from '../src/lib/db';
import { saveCardTransaction, type CardTransactionInput } from '../src/lib/card-service';

const original: Transaction = {
  id: 'original', merchant: '카페', title: '카페', content: '커피', amount: 5000,
  sourceApp: 'CASH', cardOrAccount: '현금', category: '식비', type: 'PAYMENT',
  notifiedAt: '2026-09-30T15:01:32.123Z', createdAt: '2026-09-30T15:01:32.123Z',
  balance: 20000, packageName: 'import', isReported: true, reportedAt: '2026-10-01T00:00:00Z',
  fixedExpenseId: 'fixed',
};

test('copy starts today in Korea and retains editable values without original metadata', () => {
  const copy = transactionDraft(original, true);
  assert.equal(copy.notifiedAt.slice(0, 10), kstDatetime().slice(0, 10));
  assert.equal(copy.merchant, '카페');
  assert.equal(copy.amount, '5000');
  assert.equal(copy.cardOrAccount, '현금');
  const payload = transactionEntryPayload(copy);
  for (const field of ['id', 'fixedExpenseId', 'balance', 'isReported', 'reportedAt', 'packageName']) {
    assert.equal(field in payload, false);
  }
});

test('defaultTransactionDate resolves default date based on selected month and entry date', () => {
  const today = kstDatetime().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  assert.equal(defaultTransactionDate(), today);
  assert.equal(defaultTransactionDate('invalid-month'), today);
  assert.equal(defaultTransactionDate(currentMonth), today);
  assert.equal(defaultTransactionDate('2027-01'), '2027-01-01');
  assert.equal(defaultTransactionDate('2025-05'), '2025-05-01');
  assert.equal(defaultTransactionDate('2027-01', '2027-01-15'), '2027-01-15');
  assert.equal(defaultTransactionDate('2027-01', '2026-10-20'), '2027-01-01');

  const customDraft = transactionDraft(undefined, false, '2027-01-01');
  assert.equal(customDraft.notifiedAt, '2027-01-01');

  const customCopy = transactionDraft(original, true, '2027-01-01');
  assert.equal(customCopy.notifiedAt, '2027-01-01');
  assert.equal(customCopy.merchant, '카페');
});

test('editing uses date-only input, preserves an unchanged timestamp, and interprets changed dates in Korea', () => {
  const draft = transactionDraft(original);
  assert.equal(draft.notifiedAt, '2026-10-01');
  assert.equal(transactionEntryPayload({ ...draft, amount: '6,000' }, original).notifiedAt, original.notifiedAt);
  assert.equal(transactionEntryPayload({ ...draft, notifiedAt: '2026-10-02' }, original).notifiedAt, '2026-10-02T03:00:00.000Z');
  for (const amount of ['-100', 'abc', '0', '', '1.5', '9007199254740992']) {
    assert.throws(() => transactionEntryPayload({ ...draft, amount }));
  }
});

test('manual copies save independently; retries and notification duplicates remain deduplicated', async t => {
  const rows: Array<Record<string, any>> = [];
  const locks: string[] = [];
  const db = {
    $executeRaw: async (_strings: TemplateStringsArray, key: string) => { locks.push(key); },
    cardTransaction: {
      findFirst: async ({ where }: any) => rows.find(row => where.rawData
        ? row.rawData?.entryId === where.rawData.equals
        : row.sourceApp === where.sourceApp && row.amount === where.amount && row.content === where.content) || null,
      findMany: async () => [],
      create: async ({ data }: any) => { const row = { id: String(rows.length + 1), ...data }; rows.push(row); return row; },
    },
  };
  const originalTransaction = prisma.$transaction;
  t.after(() => { Object.assign(prisma, { $transaction: originalTransaction }); });
  Object.assign(prisma, { $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback(db) });
  const input: CardTransactionInput = {
    sourceApp: 'CASH', type: 'PAYMENT', amount: 5000, merchant: '카페', title: '카페', content: '커피',
    notifiedAt: '2026-10-02T06:00:00Z',
    rawData: { manual: true, entryId: 'a0000000-0000-4000-8000-000000000001' },
  };
  const first = await saveCardTransaction(input);
  const retry = await saveCardTransaction(input);
  assert.equal(retry.isDuplicate, true);
  assert.equal(first.transaction.id, retry.transaction.id);
  const copy = await saveCardTransaction({ ...input, rawData: { manual: true, entryId: 'a0000000-0000-4000-8000-000000000002' } });
  assert.equal(copy.isDuplicate, false);
  assert.notEqual(first.transaction.id, copy.transaction.id);
  assert.equal(rows.length, 2);
  assert.ok(locks[0].startsWith('manual-entry:'));
  const notification = await saveCardTransaction({ ...input, rawData: null });
  assert.equal(notification.isDuplicate, true);
  assert.equal(rows.length, 2);
});

test('copying notification text never replaces an explicitly edited amount with its old amount', async t => {
  const originalTransaction = prisma.$transaction;
  t.after(() => { Object.assign(prisma, { $transaction: originalTransaction }); });
  Object.assign(prisma, { $transaction: async (callback: (db: unknown) => Promise<unknown>) => callback({
    $executeRaw: async () => {},
    cardTransaction: { findFirst: async () => null, findMany: async () => [], create: async ({ data }: any) => data },
  }) });
  const result = await saveCardTransaction({
    sourceApp: 'CASH', type: 'PAYMENT', amount: 6000, merchant: '카페', title: '카페',
    content: '결제 5,000원 잔액 6,000원', notifiedAt: '2026-10-02T06:00:00Z',
    rawData: { manual: true, entryId: 'a0000000-0000-4000-8000-000000000003' },
  });
  assert.equal(result.transaction.amount, 6000);
});
