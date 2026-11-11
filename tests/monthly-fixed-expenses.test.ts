import test from 'node:test';
import assert from 'node:assert/strict';
import {
  monthBounds,
  scheduledDates,
  fixedExpenseEdit,
  matchesFixedPayment,
  SCHEDULED_FIXED_PACKAGE,
  kstDate,
  isRecognized,
  recognizedTransactionsWhere,
} from '../src/lib/fixed-expense-schedule';
import type { FixedExpenseItem } from '../src/lib/fixed-expenses';

test('monthBounds correctly returns full month bounds in Korean time', () => {
  const bounds = monthBounds('2026-10');
  assert.equal(bounds.days, 31);
  assert.equal(kstDate(bounds.start), '2026-10-01');
  assert.equal(kstDate(bounds.end), '2026-10-31');
});

test('scheduledDates returns payDay within valid active range', () => {
  const item: FixedExpenseItem = {
    id: 'fe-test',
    name: '인터넷',
    amount: 30000,
    category: '통신비',
    paymentMethod: '우리카드',
    cycle: 'MONTHLY',
    payDay: '1',
    startDate: '2026-10-01',
    endDate: null,
    isAutoPay: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dates = scheduledDates(item, '2026-10');
  assert.deepEqual(dates, ['2026-10-01']);

  const nextMonthDates = scheduledDates(item, '2026-11');
  assert.deepEqual(nextMonthDates, ['2026-11-01']);
});

test('fixedExpenseEdit produces midday KST timestamp for scheduled fixed expenses', () => {
  const existing = {
    fixedExpenseId: 'fe-1',
    scheduledFor: new Date('2026-10-01T12:00:00+09:00'),
    packageName: SCHEDULED_FIXED_PACKAGE,
  };

  const edit = {
    notifiedAt: new Date('2026-10-05T09:30:00+09:00'),
  };

  const result = fixedExpenseEdit(existing, edit);
  assert.ok(result.scheduledFor);
  assert.equal(result.scheduledFor.toISOString(), '2026-10-05T03:00:00.000Z');
  assert.equal(kstDate(result.scheduledFor), '2026-10-05');

  // Allows DEPOSIT (fixed income)
  assert.doesNotThrow(() => fixedExpenseEdit(existing, { type: 'DEPOSIT' }));
  // Still rejects invalid types
  assert.throws(() => fixedExpenseEdit(existing, { type: 'CANCEL' }));
});

test('matchesFixedPayment matches fixed income (DEPOSIT) as well as expenses', () => {
  const salaryItem = { name: '급여', amount: 3500000 };
  assert.equal(matchesFixedPayment(salaryItem, '2026-10-25', {
    merchant: '급여',
    amount: 3500000,
    type: 'DEPOSIT',
    notifiedAt: '2026-10-25T09:00:00+09:00',
  }), true);
});

test('isRecognized distinguishes checked and unchecked fixed expenses, and always recognizes regular transactions', () => {
  // Regular transactions (scheduledFor: null or undefined) are always recognized
  assert.equal(isRecognized({ scheduledFor: null, rawData: null }), true);
  assert.equal(isRecognized({ scheduledFor: undefined }), true);

  // Unchecked fixed expense is NOT recognized (does not go out as expense)
  assert.equal(isRecognized({
    scheduledFor: new Date('2026-10-01T12:00:00+09:00'),
    rawData: { checked: false },
  }), false);
  assert.equal(isRecognized({
    scheduledFor: new Date('2026-10-01T12:00:00+09:00'),
    rawData: null,
  }), false);

  // Checked fixed expense IS recognized (goes out as expense in aggregation)
  assert.equal(isRecognized({
    scheduledFor: new Date('2026-10-01T12:00:00+09:00'),
    rawData: { checked: true },
  }), true);

  // Handles stringified rawData
  assert.equal(isRecognized({
    scheduledFor: new Date('2026-10-01T12:00:00+09:00'),
    rawData: JSON.stringify({ checked: true }),
  }), true);
});

test('recognizedTransactionsWhere filters scheduled expenses by checked flag', () => {
  const where = recognizedTransactionsWhere();
  assert.deepEqual(where, {
    OR: [
      { scheduledFor: null },
      {
        scheduledFor: { not: null },
        rawData: {
          path: ['checked'],
          equals: true,
        },
      },
    ],
  });
});
