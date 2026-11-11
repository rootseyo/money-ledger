import test from 'node:test';
import assert from 'node:assert/strict';
import { applyListOrder, moveListItem, validListOrder } from '../src/lib/card-list-order';
import { NextRequest } from 'next/server';
import { signAdminToken } from '../src/lib/auth';
import { GET, PATCH } from '../src/app/api/card-transactions/list-order/route';
import { prisma } from '../src/lib/db';

test('moving rows works in both directions and leaves filtered-out slots in place', () => {
  const ids = ['a', 'hidden', 'b', 'c'];
  assert.deepEqual(moveListItem(ids, ids, ['a', 'b', 'c'], 'a', 'c'), ['b', 'hidden', 'c', 'a']);
  assert.deepEqual(moveListItem(ids, ids, ['a', 'b', 'c'], 'c', 'a'), ['c', 'hidden', 'a', 'b']);
  assert.deepEqual(moveListItem([], ids, ids, 'a', 'b'), ['hidden', 'b', 'a', 'c']);
  assert.deepEqual(moveListItem(ids, ids, ['a', 'b'], 'a', 'missing'), ids);
  assert.deepEqual(moveListItem(ids, ids, ['a', 'b'], 'a', 'a'), ids);
});

test('saved order survives new/deleted rows without mutating financial data', () => {
  const rows = ['new', 'b', 'a'].map((id) => ({ id, notifiedAt: '2026-10-01T03:00:00Z', amount: 100 }));
  const before = structuredClone(rows);
  assert.deepEqual(applyListOrder(rows, ['deleted', 'a', 'b']).map((row) => row.id), ['a', 'b', 'new']);
  assert.deepEqual(applyListOrder(rows, []).map((row) => row.id), ['new', 'b', 'a']);
  assert.deepEqual(rows, before);
  assert.deepEqual(moveListItem(['a', 'old'], ['a', 'new'], ['a', 'new'], 'new', 'a'), ['new', 'old', 'a']);
});

test('order payload rejects duplicates, invalid IDs, and oversized lists', () => {
  for (const invalid of [null, {}, ['a', 'a'], [''], [123], ['a'.repeat(101)], Array.from({ length: 20001 }, (_, i) => String(i))]) {
    assert.equal(validListOrder(invalid), false);
  }
  assert.ok(validListOrder([]));
  assert.ok(validListOrder(['a', 'b']));
});

test('order API persists and resets each admin/list independently and rejects invalid requests', async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'list-order-test-secret';
  t.after(() => { if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret; });
  const originalFindUser = prisma.user.findUnique;
  t.after(() => { Object.assign(prisma.user, { findUnique: originalFindUser }); });
  Object.assign(prisma.user, { findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, role: 'OWNER', isActive: true }) });
  const stored = new Map<string, { value: string }>();
  const originalMethods = { findUnique: prisma.systemSetting.findUnique, upsert: prisma.systemSetting.upsert };
  t.after(() => { Object.assign(prisma.systemSetting, originalMethods); });
  Object.assign(prisma.systemSetting, { findUnique: async ({ where }: { where: { key: string } }) => stored.get(where.key) ?? null });
  Object.assign(prisma.systemSetting, { upsert: async ({ where, create, update }: {
    where: { key: string }; create: { value: string }; update: { value: string };
  }) => {
    const value = stored.has(where.key) ? update.value : create.value;
    stored.set(where.key, { value });
    return { key: where.key, value };
  } });
  const request = (admin: string | null, list = 'ledger', ids?: unknown) => new NextRequest(
    `https://example.test/api/card-transactions/list-order?list=${list}`, {
      method: ids === undefined ? 'GET' : 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(admin ? { cookie: `admin_token=${signAdminToken({ id: admin, role: 'OWNER' })}` } : {}) },
      ...(ids === undefined ? {} : { body: JSON.stringify({ list, ids }) }),
    });
  assert.equal((await GET(request(null))).status, 401);
  assert.equal((await PATCH(request(null, 'ledger', ['a']))).status, 401);
  assert.equal((await GET(request('one', 'invalid'))).status, 400);
  assert.equal((await PATCH(request('one', 'ledger', ['a', 'a']))).status, 400);
  assert.equal((await PATCH(request('one', 'ledger', ['b', 'a']))).status, 200);
  assert.deepEqual(await (await GET(request('one'))).json(), { ids: ['b', 'a'] });
  assert.deepEqual(await (await GET(request('two'))).json(), { ids: [] });
  assert.deepEqual(await (await GET(request('one', 'fixed-expenses'))).json(), { ids: [] });
  assert.equal((await PATCH(request('one', 'fixed-expenses', ['fixed']))).status, 200);
  assert.equal((await PATCH(request('one', 'ledger', []))).status, 200);
  assert.deepEqual(await (await GET(request('one'))).json(), { ids: [] });
  assert.deepEqual(await (await GET(request('one', 'fixed-expenses'))).json(), { ids: ['fixed'] });
  Object.assign(prisma.systemSetting, { upsert: async () => { throw new Error('Database unavailable'); } });
  assert.equal((await PATCH(request('one', 'ledger', ['a']))).status, 500);
});
