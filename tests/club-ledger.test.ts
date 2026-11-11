import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOptionalGoalAmount, duesStatus, receiptMime, validDuesAmount, validDuesMonth } from '../src/lib/club-ledger';
import { projectWealth } from '../src/lib/wealth-goal';

test('dues status distinguishes split payments, overpayments and an unset monthly fee', () => {
  assert.equal(duesStatus(0, 30000), '미입금');
  assert.equal(duesStatus(10000 + 10000, 30000), '일부 입금');
  assert.equal(duesStatus(10000 + 20000, 30000), '납부 완료');
  assert.equal(duesStatus(60000, 30000), '납부 완료');
  assert.equal(duesStatus(0, 0), '내역 없음');
  assert.equal(duesStatus(10000, 0), '입금 있음');
});
test('dues inputs reject invalid months and values outside the transaction integer range', () => {
  for (const month of ['2026-00', '2026-13', '2026-1', '2026-10-15', '0000-01', null]) assert.equal(validDuesMonth(month), false);
  for (const month of ['2026-01', '2026-12', '2025-09']) assert.equal(validDuesMonth(month), true);
  for (const amount of [0, -1, 1.5, NaN, Infinity, '30000', 2_147_483_648]) assert.equal(validDuesAmount(amount), false);
  assert.equal(validDuesAmount(30000), true);
});
test('receipt content sniffing rejects executable content disguised as an image', () => {
  assert.equal(receiptMime(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(receiptMime(Buffer.from('<html><script>alert(1)</script>')), null);
  assert.equal(receiptMime(new Uint8Array()), null);
  assert.equal(receiptMime(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(receiptMime(Uint8Array.from([255, 216, 255, 224])), 'image/jpeg');
  assert.equal(receiptMime(Buffer.from('RIFF0000WEBP')), 'image/webp');
  assert.equal(receiptMime(Buffer.from('%PDF-1.7')), 'application/pdf');
});
test('changing the household target affects progress and arrival rather than retaining the default one billion won goal', () => {
  const result = projectWealth(1_000_000_000, 5_000_000, 2_000_000_000);
  assert.equal(result.progress, 50);
  assert.equal(result.months, 200);
  assert.equal(result.remaining, 1_000_000_000);
});

test('savings goals are optional, with safe bounds on supplied values', () => {
  for (const value of [null, undefined, '', '  ']) assert.equal(parseOptionalGoalAmount(value), null);
  for (const value of [0, -1, 0.5, NaN, Infinity, true, [], {}, 'wrong', 100_000_000_001]) assert.equal(parseOptionalGoalAmount(value), undefined);
  assert.equal(parseOptionalGoalAmount(1), 1);
  assert.equal(parseOptionalGoalAmount('10000000'), 10_000_000);
  assert.equal(parseOptionalGoalAmount(100_000_000_000), 100_000_000_000);
});
