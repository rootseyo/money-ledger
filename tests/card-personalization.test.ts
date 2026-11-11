import test from 'node:test';
import assert from 'node:assert/strict';
import { createFilterCookie, readFilterCookie } from '../src/lib/card-filter-cookies';
import { compareLedgerTransactions, formatLedgerTimestamp, hasImportedPlaceholderTime, ledgerOrderBy } from '../src/lib/card-ledger-display';

test('table cookies round-trip Korean search text, all filters, and reset values independently', () => {
  const defaults = { query: '', type: 'ALL', company: 'ALL' };
  const value = { query: '우리 카드; 커피=☕', type: 'CREDIT', company: '우리' };
  const cookie = createFilterCookie('cards', value, true)!;
  assert.match(cookie, /Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/);
  assert.deepEqual(readFilterCookie(`other=abc; ${cookie.split(';')[0]}`, 'cards', defaults), value);
  assert.deepEqual(readFilterCookie(cookie, 'accounts', defaults), defaults);
  const reset = createFilterCookie('cards', defaults, false)!;
  assert.deepEqual(readFilterCookie(reset, 'cards', defaults), defaults);
  assert.ok(!reset.includes('Secure'));
});

test('invalid cookies fall back safely and only known string fields are restored', () => {
  const defaults = { query: '', type: 'ALL' };
  for (const invalid of ['cards=%bad', 'cards=null', 'cards=[]', 'cards=invalid']) {
    assert.deepEqual(readFilterCookie(invalid, 'cards', defaults), defaults);
  }
  const cookie = createFilterCookie('cards', { query: 'saved', type: 123, extra: 'ignored' }, false)!;
  assert.deepEqual(readFilterCookie(cookie, 'cards', defaults), { query: 'saved', type: 'ALL' });
  assert.equal(createFilterCookie('cards', { query: '한'.repeat(1000) }, false), null);
});

test('received order differs from transaction order and is deterministic on tied timestamps', () => {
  const a = { id: 'a', notifiedAt: '2026-10-01T09:00:00Z', createdAt: '2026-10-01T10:00:00Z' };
  const b = { id: 'b', notifiedAt: '2026-10-01T08:00:00Z', createdAt: '2026-10-01T11:00:00Z' };
  assert.deepEqual([a, b].sort((a, b) => compareLedgerTransactions(a, b, 'received', 'desc')), [b, a]);
  assert.deepEqual([a, b].sort((a, b) => compareLedgerTransactions(a, b, 'notified', 'desc')), [a, b]);
  assert.ok(compareLedgerTransactions(a, b, 'received', 'asc') < 0);
  assert.ok(compareLedgerTransactions(a, { ...a, id: 'b' }, 'received', 'asc') < 0);
  assert.deepEqual(ledgerOrderBy('received', 'desc'), [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.deepEqual(ledgerOrderBy('notified', 'asc'), [{ notifiedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
});

test('ledger shows Korean time to the minute and distinguishes imported noon placeholders', () => {
  assert.equal(formatLedgerTimestamp('2026-09-30T23:42:00Z').time, '08:42');
  const tx = { id: 'a', notifiedAt: '2026-10-01T03:00:00Z', createdAt: '2026-10-01T04:00:00Z', packageName: 'csv.household.import' };
  assert.ok(hasImportedPlaceholderTime(tx));
  assert.ok(!hasImportedPlaceholderTime({ ...tx, packageName: 'com.bank.app' }));
  assert.ok(!hasImportedPlaceholderTime({ ...tx, notifiedAt: '2026-10-01T03:01:00Z' }));
});
