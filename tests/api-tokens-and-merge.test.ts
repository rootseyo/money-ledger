import test from 'node:test';
import assert from 'node:assert/strict';
import { generateApiToken } from '../src/lib/api-token-auth';
import { isTransactionDuplicate, normalizeMerchant, formatToKSTDate } from '../src/lib/bulk-transaction-parser';

test('generateApiToken generates tokens with ct_live_ prefix and valid structure', () => {
  const { token, prefix } = generateApiToken();

  assert.ok(token.startsWith('ct_live_'));
  assert.equal(token.length, 8 + 48); // ct_live_ (8) + 24 bytes hex (48) = 56
  assert.ok(prefix.startsWith('ct_live_'));
  assert.ok(prefix.endsWith('...'));
  assert.equal(prefix.length, 17); // 14 chars + ...
});

test('duplicate detection accurately matches transactions for 9월 merge', () => {
  const tx1 = {
    notifiedAt: '2026-09-28T03:00:00Z', // 12:00 KST
    amount: 10900,
    type: 'PAYMENT',
    merchant: '쿠팡 바디 워시',
    title: '쿠팡 바디 워시',
    content: '쿠팡 바디 워시 10,900원',
  };

  const tx2 = {
    notifiedAt: '2026-09-28T03:00:00Z',
    amount: 10900,
    type: 'PAYMENT',
    merchant: '쿠팡',
    title: '[가계부] 쿠팡 바디 워시',
    content: '[가계부 대량 등록] [소모품] 쿠팡 바디 워시',
  };

  assert.equal(isTransactionDuplicate(tx1, tx2), true);

  // Different day -> not duplicate
  const tx3 = {
    ...tx2,
    notifiedAt: '2026-09-29T03:00:00Z',
  };
  assert.equal(isTransactionDuplicate(tx1, tx3), false);

  // Different amount -> not duplicate
  const tx4 = {
    ...tx2,
    amount: 12000,
  };
  assert.equal(isTransactionDuplicate(tx1, tx4), false);
});
