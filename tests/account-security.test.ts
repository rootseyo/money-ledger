import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { validatePassword } from '../src/lib/password-policy';
import { signAccountIntent, readAccountIntent, signDeleteProof, verifyDeleteProof } from '../src/lib/kakao-auth';
import { setSession } from '../src/lib/auth-session';
import { NextResponse } from 'next/server';

const secret = 'account-security-test-secret';
process.env.JWT_SECRET = secret;

test('password policy rejects short passwords and UTF-8 values bcrypt would truncate', () => {
  assert.equal(validatePassword('new-password123'), null);
  assert.equal(validatePassword('한'.repeat(24)), null);
  for (const input of [null, {}, '', 'short', '한'.repeat(25), 'a'.repeat(73)]) assert.ok(validatePassword(input));
});

test('account OAuth intent binds action, user and state, rejects forged and expired tokens', () => {
  const intent = { userId: 'member-a', state: 'random-state', action: 'link' as const, credential: 'password-version' };
  const signed = signAccountIntent(intent);
  const decoded = readAccountIntent(signed)!;
  assert.equal(decoded.userId, intent.userId);
  assert.equal(decoded.state, intent.state);
  assert.equal(decoded.action, 'link');
  assert.equal(readAccountIntent(`${signed}tampered`), null);
  assert.equal(readAccountIntent(jwt.sign({ ...intent, purpose: 'kakao-account' }, secret, { expiresIn: -1 })), null);
  assert.equal(readAccountIntent(jwt.sign({ ...intent, purpose: 'kakao-signup' }, secret)), null);
});

test('Kakao deletion proof cannot be reused for a different user or purpose', () => {
  const proof = signDeleteProof('member-a');
  assert.equal(verifyDeleteProof(proof, 'member-a'), true);
  assert.equal(verifyDeleteProof(proof, 'member-b'), false);
  assert.equal(verifyDeleteProof(undefined, 'member-a'), false);
  assert.equal(verifyDeleteProof(jwt.sign({ userId: 'member-a', purpose: 'kakao-account-delete' }, secret, { expiresIn: -1 }), 'member-a'), false);
  assert.equal(verifyDeleteProof(signAccountIntent({ userId: 'member-a', state: 'state', action: 'delete', credential: 'hash' }), 'member-a'), false);
});

test('session cookies contain public identity only, never a password hash from database objects', () => {
  const user = { id: 'member-a', email: 'member@example.com', name: '회원', role: 'MEMBER', password: 'private-hash', isActive: true };
  const response = setSession(NextResponse.json({ success: true }), user);
  const token = response.cookies.get('money_token')!.value;
  const payload = jwt.verify(token, secret) as jwt.JwtPayload;
  assert.equal(payload.id, user.id);
  assert.equal('password' in payload, false);
  assert.equal('isActive' in payload, false);
});

// Real request handlers with an in-memory repository: no production database or OAuth calls.
test('account handlers enforce reauthentication, session binding and unique Kakao ownership', async () => {
  const password = await bcrypt.hash('old-password123', 4);
  const user = { id: 'member-a', email: 'member@example.com', name: '회원', role: 'MEMBER', password, isActive: true };
  const settings = new Map<string, { key: string; userId: string; value: string; category: string }>();
  const repository = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === user.id ? user : null,
      updateMany: async ({ where, data }: { where: { id: string; password: string }; data: { password: string } }) => { if (where.id !== user.id || where.password !== user.password) return { count: 0 }; user.password = data.password; return { count: 1 }; },
    },
    systemSetting: {
      findFirst: async ({ where }: { where: { userId: string } }) => [...settings.values()].find(row => row.userId === where.userId) || null,
      findUnique: async ({ where }: { where: { key: string } }) => settings.get(where.key) || null,
      create: async ({ data }: { data: { key: string; userId: string; value: string; category: string } }) => { if (settings.has(data.key)) throw new Error('Unique identity'); settings.set(data.key, data); return data; },
    },
    $queryRaw: async () => [{ value: JSON.stringify({ count: 1, resetAt: Date.now() + 60000 }) }],
    $transaction: async (fn: (db: typeof repository) => unknown): Promise<unknown> => fn(repository),
    $extends() { return this; },
    $disconnect: async () => {},
  };
  (globalThis as unknown as { prisma: unknown }).prisma = repository;
  const { prisma } = await import('../src/lib/db');
  const { signUserToken } = await import('../src/lib/auth');
  const { POST: changePassword } = await import('../src/app/api/account/password/route');
  const { POST: startLink } = await import('../src/app/api/account/kakao/route');
  const { GET: callback } = await import('../src/app/api/auth/kakao/callback/route');
  const { POST: deleteAccount } = await import('../src/app/api/account/delete/route');
  process.env.KAKAO_REST_API_KEY = 'test-client';
  process.env.KAKAO_REDIRECT_URI = 'https://example.test/api/auth/kakao/callback';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ access_token: 'test-token', id: 123456 }));
  const cookie = () => `money_token=${signUserToken(user)}`;
  const request = (path: string, body?: unknown, cookies = cookie(), origin?: string) => new NextRequest(`https://example.test${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { cookie: cookies, 'Content-Type': 'application/json', ...(origin ? { origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  try {
    const passwordBody = { currentPassword: 'old-password123', newPassword: 'new-password123', confirmPassword: 'new-password123' };
    assert.equal((await changePassword(request('/api/account/password', passwordBody, ''))).status, 401);
    assert.equal((await changePassword(request('/api/account/password', passwordBody, cookie(), 'https://attacker.test'))).status, 403);
    assert.equal((await changePassword(request('/api/account/password', { ...passwordBody, currentPassword: 'wrong' }))).status, 401);
    assert.equal((await changePassword(request('/api/account/password', { ...passwordBody, confirmPassword: 'mismatch' }))).status, 400);
    assert.equal((await changePassword(request('/api/account/password', passwordBody))).status, 200);
    assert.ok(await bcrypt.compare('new-password123', user.password));
    assert.equal(await bcrypt.compare('old-password123', user.password), false);
    assert.equal((await startLink(request('/api/account/kakao', { action: 'link', password: 'wrong' }))).status, 401);
    const start = await startLink(request('/api/account/kakao', { action: 'link', password: 'new-password123' }));
    assert.equal(start.status, 200);
    const state = new URL((await start.json()).url).searchParams.get('state')!;
    const intent = start.cookies.get('money_kakao_account_intent')!.value;
    const oauthCookies = `money_kakao_state=${state}; money_kakao_account_intent=${intent}`;
    const path = `/api/auth/kakao/callback?state=${state}&code=test`;
    assert.match((await callback(request(path, undefined, oauthCookies))).headers.get('location')!, /mypage\?kakao=error/);
    assert.equal(settings.size, 0);
    const success = await callback(request(path, undefined, `${cookie()}; ${oauthCookies}`));
    assert.match(success.headers.get('location')!, /mypage\?kakao=linked/);
    assert.equal(settings.get('kakao-identity:123456')?.userId, user.id);
    assert.equal((await startLink(request('/api/account/kakao', { action: 'link', password: 'new-password123' }))).status, 409);
    settings.set('kakao-identity:123456', { key: 'kakao-identity:123456', userId: 'another-member', value: '123456', category: 'AUTH' });
    const conflict = await callback(request(path, undefined, `${cookie()}; ${oauthCookies}`));
    assert.match(conflict.headers.get('location')!, /mypage\?kakao=conflict/);
    assert.equal(settings.get('kakao-identity:123456')?.userId, 'another-member');
    user.email = 'kakao-123456@users.invalid';
    assert.equal((await deleteAccount(request('/api/account/delete', { confirmation: '계정 삭제' }))).status, 401);
    const otherProof = signDeleteProof('another-member');
    assert.equal((await deleteAccount(request('/api/account/delete', { confirmation: '계정 삭제' }, `${cookie()}; money_kakao_delete_proof=${otherProof}`))).status, 401);
    const deletion = await startLink(request('/api/account/kakao', { action: 'delete' }));
    const deletionState = new URL((await deletion.json()).url).searchParams.get('state')!;
    const deletionCookies = `${cookie()}; money_kakao_state=${deletionState}; money_kakao_account_intent=${deletion.cookies.get('money_kakao_account_intent')!.value}`;
    assert.match((await callback(request(`/api/auth/kakao/callback?state=${deletionState}&code=test`, undefined, deletionCookies))).headers.get('location')!, /kakao=error/);
    settings.get('kakao-identity:123456')!.userId = user.id;
    const verified = await callback(request(`/api/auth/kakao/callback?state=${deletionState}&code=test`, undefined, deletionCookies));
    assert.match(verified.headers.get('location')!, /kakao=verified/);
    assert.ok(verifyDeleteProof(verified.cookies.get('money_kakao_delete_proof')?.value, user.id));
  } finally { globalThis.fetch = originalFetch; await prisma.$disconnect(); }
});
