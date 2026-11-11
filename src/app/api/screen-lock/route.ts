import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-api';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';
const LOCK_COOKIE = 'admin_screen_lock';
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: 8 * 60 * 60 };
function jwtSecret() { const value = process.env.JWT_SECRET; if (!value) throw new Error('JWT_SECRET is required'); return value; }
function settingKey(adminId: string) { return `admin-screen-passkeys:${adminId}`; }
async function getCredentials(adminId: string): Promise<Array<{ id: string; publicKey: string; counter: number; transports?: string[] }>> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: settingKey(adminId) }, select: { value: true } });
  if (!setting) return [];
  try { const value = JSON.parse(setting.value); return Array.isArray(value) ? value : []; } catch { return []; }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  let locked = false;
  try {
    const token = request.cookies.get(LOCK_COOKIE)?.value;
    if (token) {
      const decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as jwt.JwtPayload;
      locked = decoded.sub === auth.admin.id && decoded.purpose === 'admin-screen-lock';
    }
  } catch { locked = false; }
  const credentials = await getCredentials(auth.admin.id);
  return NextResponse.json({ locked, hasPasskey: credentials.length > 0, unlockMode: auth.user.role === 'DEMO' ? 'demo' : auth.user.email.endsWith('@users.invalid') ? 'kakao' : 'password' });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (body.action === 'unlock-demo' && auth.user.role === 'DEMO') {
    const response = NextResponse.json({ success: true });
    response.cookies.set(LOCK_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }
  if (body.action === 'lock') {
    const token = jwt.sign({ sub: auth.admin.id, purpose: 'admin-screen-lock' }, jwtSecret(), { expiresIn: '8h' });
    const response = NextResponse.json({ success: true });
    response.cookies.set(LOCK_COOKIE, token, cookieOptions);
    return response;
  }

  if (body.action === 'unlock-password') {
    const limit = await checkRateLimit(`screen-unlock:${auth.admin.id}:${getClientIp(request)}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    const admin = await prisma.user.findUnique({ where: { id: auth.admin.id }, select: { password: true, isActive: true } });
    const password = typeof body.password === 'string' ? body.password : '';
    if (!admin?.isActive || !password || !(await bcrypt.compare(password, admin.password))) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(LOCK_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return response;
  }

  if (body.action === 'unlock-passkey') {
    const credentials = await getCredentials(auth.admin.id);
    const challengeSetting = await prisma.systemSetting.findUnique({ where: { key: `${settingKey(auth.admin.id)}:authentication-challenge` }, select: { value: true } });
    if (!challengeSetting || credentials.length === 0) return NextResponse.json({ error: '등록된 패스키가 없습니다.' }, { status: 400 });
    try {
      const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
      const stored = JSON.parse(challengeSetting.value) as { challenge: string; expires: number };
      if (stored.expires < Date.now()) throw new Error('패스키 요청이 만료되었습니다.');
      const credentialResponse = body.credential;
      const saved = credentials.find(item => item.id === credentialResponse?.id);
      if (!saved) throw new Error('등록된 패스키를 찾을 수 없습니다.');
      const origin = process.env.WEBAUTHN_ORIGIN || request.headers.get('origin') || request.nextUrl.origin;
      const rpID = process.env.WEBAUTHN_RP_ID || new URL(origin).hostname;
      const result = await verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: stored.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: { id: saved.id, publicKey: new Uint8Array(Buffer.from(saved.publicKey, 'base64url')), counter: saved.counter, transports: saved.transports as never },
        requireUserVerification: true,
      });
      if (!result.verified) throw new Error('패스키 확인에 실패했습니다.');
      const updated = credentials.map(item => item.id === saved.id ? { ...item, counter: result.authenticationInfo.newCounter } : item);
      await prisma.systemSetting.update({ where: { key: settingKey(auth.admin.id) }, data: { value: JSON.stringify(updated) } });
      await prisma.systemSetting.delete({ where: { key: `${settingKey(auth.admin.id)}:authentication-challenge` } });
      const response = NextResponse.json({ success: true });
      response.cookies.set(LOCK_COOKIE, '', { ...cookieOptions, maxAge: 0 });
      return response;
    } catch (error) {
      console.warn('Screen lock passkey verification failed:', error instanceof Error ? error.message : 'unknown');
      return NextResponse.json({ error: '패스키 인증에 실패했습니다. 다시 시도해주세요.' }, { status: 401 });
    }
  }
  return NextResponse.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
}
