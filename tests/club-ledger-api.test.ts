import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/db';
import { signUserToken } from '../src/lib/auth';
import { GET as receipts, POST as upload } from '../src/app/api/card-transactions/[id]/receipts/route';
import { GET as download, DELETE as remove } from '../src/app/api/card-transactions/[id]/receipts/[receiptId]/route';
import { POST as dues } from '../src/app/api/club-dues/route';
import { POST as household } from '../src/app/api/households/route';

test('receipt endpoints enforce authentication, workspace ownership, read-only roles and content limits', async t => {
  const viewer = { id: 'viewer', email: 'viewer@example.test', name: 'Viewer', role: 'MEMBER', isActive: true };
  const editor = { ...viewer, id: 'editor', name: 'Editor' };
  const restore: (() => void)[] = [];
  function stub(object: any, method: string, fn: any) { const original = object[method]; object[method] = fn; restore.push(() => { object[method] = original; }); }
  stub(prisma.user, 'findUnique', async ({ where }: any) => where.id === 'editor' ? editor : viewer);
  stub(prisma.systemSetting, 'findUnique', async ({ where }: any) => {
    if (where.key.startsWith('household-member-role:')) return { value: where.key.endsWith(':viewer') ? 'VIEWER' : 'EDITOR' };
    if (where.key.startsWith('household-member:')) return { value: 'club' };
    if (where.key === 'household:club') return { value: JSON.stringify({ type: 'CLUB', name: '테니스', ownerId: 'owner', monthlyDues: 30000 }) };
    return null;
  });
  stub(prisma.systemSetting, 'findMany', async () => [{ userId: 'editor' }, { userId: 'viewer' }]);
  let transactionAllowed = true;
  stub(prisma.cardTransaction, 'findUnique', async () => transactionAllowed ? { id: 'tx', type: 'DEPOSIT', amount: 30000 } : null);
  let receiptReads = 0;
  stub(prisma.transactionReceipt, 'findMany', async () => { receiptReads++; return []; });
  stub(prisma.transactionReceipt, 'findFirst', async () => { receiptReads++; return { id: 'receipt', name: '영수증.pdf', mimeType: 'application/pdf', size: 8, data: Buffer.from('%PDF-1.7') }; });
  const request = (path: string, method = 'GET', user = editor, body?: BodyInit, headers?: Record<string, string>) => new NextRequest(`https://ledger.example.test${path}`, { method, headers: { authorization: `Bearer ${signUserToken(user)}`, ...headers }, ...(body ? { body } : {}) });
  const context = { params: Promise.resolve({ id: 'tx', receiptId: 'receipt' }) };
  try {
    await t.test('anonymous requests cannot read attachments', async () => {
      assert.equal((await receipts(new NextRequest('https://ledger.example.test/api/card-transactions/tx/receipts'), context)).status, 401);
      assert.equal(receiptReads, 0);
    });
    await t.test('invisible transactions are rejected before reading receipt data', async () => {
      transactionAllowed = false;
      assert.equal((await download(request('/api/card-transactions/tx/receipts/receipt'), context)).status, 404);
      assert.equal(receiptReads, 0);
      transactionAllowed = true;
    });
    await t.test('viewers may download but cannot upload, delete, register dues or change settings', async () => {
      const response = await download(request('/api/card-transactions/tx/receipts/receipt', 'GET', viewer), context);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '%PDF-1.7');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await upload(request('/api/card-transactions/tx/receipts', 'POST', viewer), context)).status, 403);
      assert.equal((await remove(request('/api/card-transactions/tx/receipts/receipt', 'DELETE', viewer), context)).status, 403);
      assert.equal((await dues(request('/api/club-dues', 'POST', viewer))).status, 403);
      assert.equal((await household(request('/api/households', 'POST', viewer, JSON.stringify({ action: 'update-settings', name: 'changed', type: 'CLUB' }), { 'content-type': 'application/json' }))).status, 403);
    });
    await t.test('oversized and disguised files fail before database writes', async () => {
      assert.equal((await upload(request('/api/card-transactions/tx/receipts', 'POST', editor, 'x', { 'content-type': 'multipart/form-data; boundary=test', 'content-length': String(6 * 1024 * 1024) }), context)).status, 413);
      const form = new FormData(); form.append('file', new File(['<svg onload="alert(1)"></svg>'], 'image.png', { type: 'image/png' }));
      const response = await upload(request('/api/card-transactions/tx/receipts', 'POST', editor, form), context);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /JPG/);
    });
    await t.test('valid receipt uploads preserve original bytes and enforce the five-file limit', async () => {
      let count = 0;
      let stored: any;
      stub(prisma, '$transaction', async (callback: any) => callback({
        cardTransaction: { update: async ({ where }: any) => { assert.equal(where.id, 'tx'); } },
        transactionReceipt: { count: async () => count, create: async ({ data }: any) => { stored = data; const { data: _bytes, ...metadata } = data; return { id: 'receipt', ...metadata }; } },
      }));
      const bytes = Buffer.from('%PDF-1.7');
      const form = () => { const value = new FormData(); value.append('file', new File([bytes], 'receipt.pdf', { type: 'application/octet-stream' })); return value; };
      const response = await upload(request('/api/card-transactions/tx/receipts', 'POST', editor, form()), context);
      assert.equal(response.status, 201);
      assert.equal(stored.transactionId, 'tx'); assert.equal(stored.mimeType, 'application/pdf');
      assert.deepEqual([...stored.data], [...bytes]);
      assert.equal((await response.json()).receipt.data, undefined);
      stored = undefined; count = 5;
      assert.equal((await upload(request('/api/card-transactions/tx/receipts', 'POST', editor, form()), context)).status, 400);
      assert.equal(stored, undefined);
    });
    await t.test('dues registration rejects members of another club', async () => {
      stub(prisma.ledgerMember, 'findFirst', async ({ where }: any) => { assert.equal(where.workspaceId, 'club'); assert.equal(where.archived, false); return null; });
      const response = await dues(request('/api/club-dues', 'POST', editor, JSON.stringify({ action: 'payment', memberId: 'foreign-member', month: '2026-10', date: '2026-10-15', amount: 30000 }), { 'content-type': 'application/json' }));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /구성원/);
    });
    await t.test('an existing deposit is linked without creating a duplicate income transaction', async () => {
      stub(prisma.ledgerMember, 'findFirst', async () => ({ id: 'club-member', workspaceId: 'club', name: '회원', archived: false }));
      stub(prisma.duesPayment, 'findUnique', async () => null);
      let linked: any;
      stub(prisma.duesPayment, 'upsert', async (args: any) => { linked = args; return args.create; });
      const response = await dues(request('/api/club-dues', 'POST', editor, JSON.stringify({ action: 'link', transactionId: 'tx', memberId: 'club-member', month: '2026-09' }), { 'content-type': 'application/json' }));
      assert.equal(response.status, 200);
      assert.deepEqual(linked.create, { transactionId: 'tx', memberId: 'club-member', month: '2026-09' });
    });
  } finally { restore.reverse().forEach(fn => fn()); }
});

test('a household can start without a savings goal and set or clear it later', async () => {
  const user = { id: 'optional-goal-owner', email: 'goal@example.test', name: 'Goal owner', role: 'MEMBER', isActive: true };
  const restores: (() => void)[] = [];
  const stub = (object: any, method: string, replacement: any) => {
    const original = object[method]; object[method] = replacement;
    restores.push(() => { object[method] = original; });
  };
  let stored: any = null;
  let writes = 0;
  stub(prisma.user, 'findUnique', async () => user);
  stub(prisma.systemSetting, 'findUnique', async ({ where }: any) => {
    if (where.key === `household-member:${user.id}`) return stored ? { value: stored.id } : null;
    if (stored && where.key === `household:${stored.id}`) return { value: JSON.stringify(stored) };
    return null;
  });
  stub(prisma.systemSetting, 'updateMany', async ({ data }: any) => { stored = JSON.parse(data.value); writes++; return { count: 1 }; });
  stub(prisma, '$transaction', async (callback: any) => callback({ systemSetting: {
    createMany: async ({ data }: any) => { stored = JSON.parse(data.find((row: any) => row.key.startsWith('household:')).value); writes++; },
    findFirst: async () => null,
  } }));
  const request = (body: Record<string, unknown>) => new NextRequest('https://ledger.example.test/api/households', {
    method: 'POST', headers: { authorization: `Bearer ${signUserToken(user)}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  try {
    const response = await household(request({ action: 'create', name: '우리집', type: 'WEALTH' }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).household.goalAmount, null);
    assert.equal(stored.goalAmount, null);
    assert.equal((await household(request({ action: 'update-settings', name: '우리집', type: 'WEALTH', goalAmount: 10_000_000 }))).status, 200);
    assert.equal(stored.goalAmount, 10_000_000);
    const beforeInvalid = writes;
    assert.equal((await household(request({ action: 'update-settings', name: '우리집', type: 'WEALTH', goalAmount: -1 }))).status, 400);
    assert.equal(writes, beforeInvalid);
    assert.equal((await household(request({ action: 'update-settings', name: '우리집', type: 'WEALTH', goalAmount: null }))).status, 200);
    assert.equal(stored.goalAmount, null);
  } finally { restores.reverse().forEach(restore => restore()); }
});
