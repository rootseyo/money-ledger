import test from 'node:test';
import assert from 'node:assert/strict';
import { compareLedgerTransactions, ledgerOrderBy } from '../src/lib/card-ledger-display';

test('compareLedgerTransactions sorts by merchant asc/desc', () => {
  const itemA = { id: '1', notifiedAt: new Date(), createdAt: new Date(), merchant: '스타벅스' };
  const itemB = { id: '2', notifiedAt: new Date(), createdAt: new Date(), merchant: '이디야' };

  assert.ok(compareLedgerTransactions(itemA, itemB, 'merchant', 'asc') < 0);
  assert.ok(compareLedgerTransactions(itemA, itemB, 'merchant', 'desc') > 0);
});

test('compareLedgerTransactions sorts by amount asc/desc', () => {
  const itemA = { id: '1', notifiedAt: new Date(), createdAt: new Date(), amount: 5000 };
  const itemB = { id: '2', notifiedAt: new Date(), createdAt: new Date(), amount: 15000 };

  assert.ok(compareLedgerTransactions(itemA, itemB, 'amount', 'asc') < 0);
  assert.ok(compareLedgerTransactions(itemA, itemB, 'amount', 'desc') > 0);
});

test('compareLedgerTransactions sorts by balance asc/desc', () => {
  const itemA = { id: '1', notifiedAt: new Date(), createdAt: new Date(), balance: 100000 };
  const itemB = { id: '2', notifiedAt: new Date(), createdAt: new Date(), balance: 500000 };

  assert.ok(compareLedgerTransactions(itemA, itemB, 'balance', 'asc') < 0);
  assert.ok(compareLedgerTransactions(itemA, itemB, 'balance', 'desc') > 0);
});

test('ledgerOrderBy generates correct Prisma order clauses', () => {
  const merchantOrder = ledgerOrderBy('merchant', 'asc');
  assert.deepEqual(merchantOrder[0], { merchant: 'asc' });

  const amountOrder = ledgerOrderBy('amount', 'desc');
  assert.deepEqual(amountOrder[0], { amount: 'desc' });

  const balanceOrder = ledgerOrderBy('balance', 'asc');
  assert.deepEqual(balanceOrder[0], { balance: 'asc' });
});

test('compareLedgerTransactions sorts by notifiedAt asc/desc correctly', () => {
  const early = { id: '1', notifiedAt: new Date('2026-09-15T10:00:00Z'), createdAt: new Date('2026-10-01T00:00:00Z') };
  const late = { id: '2', notifiedAt: new Date('2026-10-01T15:00:00Z'), createdAt: new Date('2026-10-01T01:00:00Z') };

  // asc: early first (< 0)
  assert.ok(compareLedgerTransactions(early, late, 'notified', 'asc') < 0);
  // desc: late first (late should come before early, so compare(early, late) > 0)
  assert.ok(compareLedgerTransactions(early, late, 'notified', 'desc') > 0);
  assert.ok(compareLedgerTransactions(late, early, 'notified', 'desc') < 0);
});

test('formatLedgerMerchant displays merchants without the legacy prefix', () => {
  const { formatLedgerMerchant } = require('../src/lib/card-ledger-display');

  // App transaction with packageName
  assert.equal(
    formatLedgerMerchant({ merchant: '스타벅스', packageName: 'com.wooricard.smartapp' }),
    '스타벅스'
  );

  // App transaction with non-manual sourceApp
  assert.equal(
    formatLedgerMerchant({ merchant: '맥도날드', sourceApp: 'WOORI_CARD' }),
    '맥도날드'
  );

  // Remove a prefix already present in stored data
  assert.equal(
    formatLedgerMerchant({ merchant: '세요) 스타벅스', packageName: 'com.wooricard.smartapp' }),
    '스타벅스'
  );

  // Fallback to title when merchant is empty
  assert.equal(
    formatLedgerMerchant({ title: '카카오페이 결제', packageName: 'com.kakaopay' }),
    '카카오페이 결제'
  );

  // CSV household import - should NOT prefix
  assert.equal(
    formatLedgerMerchant({ merchant: '이마트', packageName: 'csv.household.import' }),
    '이마트'
  );

  // Manual transaction - should NOT prefix
  assert.equal(
    formatLedgerMerchant({ merchant: '동네마트', sourceApp: 'MANUAL' }),
    '동네마트'
  );
});
