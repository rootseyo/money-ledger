import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGridPosition, transactionCellPatch, formatCellAmount, formatNumberWithCommas } from '../src/lib/ledger-cell';
import type { Transaction } from '../src/components/ledger/ledger-types';
import type { HouseholdCategory } from '../src/lib/household-categories';

const item = { id: 'one', notifiedAt: '2026-10-02T03:04:59.123Z', type: 'PAYMENT' } as Transaction;

test('cell saves patch only the selected field and validate amounts', () => {
  assert.deepEqual(transactionCellPatch(item, 'amount', '12,300'), { id: 'one', amount: 12300 });
  assert.deepEqual(transactionCellPatch(item, 'merchant', ' 카페 '), { id: 'one', merchant: '카페' });
  assert.deepEqual(transactionCellPatch(item, 'content', ''), { id: 'one', content: '' });
  assert.deepEqual(transactionCellPatch(item, 'cardOrAccount', ''), { id: 'one', cardOrAccount: null });
  for (const amount of ['', '0', '-1', '1.5', 'NaN', '1e3', '9007199254740992']) assert.throws(() => transactionCellPatch(item, 'amount', amount));
  assert.throws(() => transactionCellPatch(item, 'merchant', '  '));
});

test('dates use Korea time, reject rollover dates and constrain fixed expenses to their month', () => {
  assert.equal(transactionCellPatch(item, 'notifiedAt', '2026-10-03T00:01').notifiedAt, '2026-10-02T15:01:00.000Z');
  assert.throws(() => transactionCellPatch(item, 'notifiedAt', '2026-02-30T12:00'));
  assert.throws(() => transactionCellPatch(item, 'notifiedAt', ''));
  const fixed = { ...item, fixedExpenseId: 'fixed', scheduledFor: '2026-10-10T03:00:00Z' };
  assert.equal(transactionCellPatch(fixed, 'notifiedAt', '2026-10-20').notifiedAt, '2026-10-20T03:00:00.000Z');
  assert.throws(() => transactionCellPatch(fixed, 'notifiedAt', '2026-11-01'));
});

test('category changes retain income/expense behavior without changing unrelated fields', () => {
  const categories = [{ name: '급여', type: 'INCOME' }, { name: '식비', type: 'EXPENSE' }] as HouseholdCategory[];
  assert.deepEqual(transactionCellPatch(item, 'category', '급여', categories), { id: 'one', category: '급여', type: 'DEPOSIT' });
  assert.equal(transactionCellPatch({ ...item, type: 'DEPOSIT' }, 'category', '식비', categories).type, 'PAYMENT');
  assert.equal(transactionCellPatch({ ...item, type: 'CANCEL' }, 'category', '식비', categories).type, undefined);

  // Fixed expense rows also switch to DEPOSIT when an income category is selected
  const fixedItem: Transaction = { ...item, fixedExpenseId: 'fe-1', scheduledFor: '2026-10-01T03:00:00.000Z' };
  assert.equal(transactionCellPatch(fixedItem, 'category', '급여', categories).type, 'DEPOSIT');
  assert.equal(transactionCellPatch({ ...fixedItem, type: 'DEPOSIT' }, 'category', '식비', categories).type, 'PAYMENT');
});

test('keyboard navigation respects edges, wraps Tab, and allows exiting the grid', () => {
  assert.deepEqual(nextGridPosition(0, 1, 3, 4, 'ArrowDown'), [1, 1]);
  assert.deepEqual(nextGridPosition(0, 0, 3, 4, 'ArrowLeft'), [0, 0]);
  assert.deepEqual(nextGridPosition(2, 3, 3, 4, 'ArrowDown'), [2, 3]);
  assert.deepEqual(nextGridPosition(0, 3, 3, 4, 'Tab'), [1, 0]);
  assert.deepEqual(nextGridPosition(1, 0, 3, 4, 'Tab', true), [0, 3]);
  assert.equal(nextGridPosition(0, 0, 3, 4, 'Tab', true), null);
  assert.equal(nextGridPosition(2, 3, 3, 4, 'Tab'), null);
  assert.deepEqual(nextGridPosition(1, 2, 3, 4, 'Home', false, true), [0, 0]);
  assert.deepEqual(nextGridPosition(1, 2, 3, 4, 'End', false, true), [2, 3]);
});

test('formatCellAmount and formatNumberWithCommas add commas every three digits', () => {
  // formatCellAmount tests
  assert.equal(formatCellAmount(''), '');
  assert.equal(formatCellAmount('0'), '0');
  assert.equal(formatCellAmount('500'), '500');
  assert.equal(formatCellAmount('1000'), '1,000');
  assert.equal(formatCellAmount('12345'), '12,345');
  assert.equal(formatCellAmount('1000000'), '1,000,000');
  assert.equal(formatCellAmount('1000000000'), '1,000,000,000');
  assert.equal(formatCellAmount('1,000,000'), '1,000,000');

  // formatNumberWithCommas tests for settings inputs
  assert.equal(formatNumberWithCommas(''), '');
  assert.equal(formatNumberWithCommas(null), '');
  assert.equal(formatNumberWithCommas(undefined), '');
  assert.equal(formatNumberWithCommas('0'), '0');
  assert.equal(formatNumberWithCommas(0), '0');
  assert.equal(formatNumberWithCommas('500'), '500');
  assert.equal(formatNumberWithCommas(500), '500');
  assert.equal(formatNumberWithCommas('1000'), '1,000');
  assert.equal(formatNumberWithCommas(1000), '1,000');
  assert.equal(formatNumberWithCommas('1000000000'), '1,000,000,000');
  assert.equal(formatNumberWithCommas(1000000000), '1,000,000,000');
  assert.equal(formatNumberWithCommas('1,000,000'), '1,000,000');
  assert.equal(formatNumberWithCommas('12a34'), '1,234');
  assert.equal(formatNumberWithCommas('05'), '5');
  assert.equal(formatNumberWithCommas('00'), '0');
  assert.equal(formatNumberWithCommas('01000'), '1,000');
  assert.equal(formatNumberWithCommas('-5000', true), '-5,000');
  assert.equal(formatNumberWithCommas('-0', true), '0');
  assert.equal(formatNumberWithCommas('-1000000', true), '-1,000,000');
});
