import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';
const key = (id: string) => `admin-screen-passkeys:${id}`;
async function credentials(id: string): Promise<Array<{ id: string; publicKey: string; counter: number; transports?: string[]; name?: string }>> {
  const saved = await prisma.systemSetting.findUnique({ where: { key: key(id) }, select: { value: true } });
  if (!saved) return [];
  try { const value = JSON.parse(saved.value); return Array.isArray(value) ? value : []; } catch { return []; }
}
function originAndRp(request: NextRequest) {
  const origin = process.env.WEBAUTHN_ORIGIN || request.headers.get('origin') || request.nextUrl.origin;
  return { origin, rpID: process.env.WEBAUTHN_RP_ID || new URL(origin).hostname };
}
async function saveChallenge(id: string, kind: string, challenge: string) {
  await prisma.systemSetting.upsert({ where: { key: `${key(id)}:${kind}-challenge` }, create: { key: `${key(id)}:${kind}-challenge`, value: JSON.stringify({ challenge, expires: Date.now() + 5 * 60_000 }), category: 'AUTH' }, update: { value: JSON.stringify({ challenge, expires: Date.now() + 5 * 60_000 }) } });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const action = request.nextUrl.searchParams.get('action');
  try {
    const { origin, rpID } = originAndRp(request);
    const savedCredentials = await credentials(auth.admin.id);
    if (action === 'register-options') {
      const body = await request.json().catch(() => ({}));
      const admin = await prisma.user.findUnique({ where: { id: auth.admin.id }, select: { password: true, isActive: true } });
      if (!admin?.isActive || typeof body.password !== 'string' || !(await bcrypt.compare(body.password, admin.password))) {
        return NextResponse.json({ error: '패스키 등록을 위해 계정 비밀번호를 확인해주세요.' }, { status: 401 });
      }
      const options = await generateRegistrationOptions({
        rpName: '10억 가계부', rpID, userName: auth.admin.email, userDisplayName: auth.admin.name,
        userID: new TextEncoder().encode(auth.admin.id), attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        excludeCredentials: savedCredentials.map(credential => ({ id: credential.id, transports: credential.transports as never })),
      });
      await saveChallenge(auth.admin.id, 'registration', options.challenge);
      return NextResponse.json(options);
    }
    if (action === 'register-verify') {
      const { credential } = await request.json();
      const challenge = await prisma.systemSetting.findUnique({ where: { key: `${key(auth.admin.id)}:registration-challenge` }, select: { value: true } });
      if (!challenge) return NextResponse.json({ error: '패스키 등록 요청이 만료되었습니다.' }, { status: 400 });
      const saved = JSON.parse(challenge.value) as { challenge: string; expires: number };
      if (saved.expires < Date.now()) return NextResponse.json({ error: '패스키 등록 요청이 만료되었습니다.' }, { status: 400 });
      const result = await verifyRegistrationResponse({ response: credential, expectedChallenge: saved.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!result.verified || !result.registrationInfo) return NextResponse.json({ error: '패스키를 확인하지 못했습니다.' }, { status: 400 });
      const info = result.registrationInfo;
      const item = { id: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString('base64url'), counter: info.credential.counter, transports: credential.response?.transports || [], name: '화면 잠금 패스키' };
      const existing = await credentials(auth.admin.id);
      const next = [...existing.filter(record => record.id !== item.id), item];
      await prisma.systemSetting.upsert({ where: { key: key(auth.admin.id) }, create: { key: key(auth.admin.id), value: JSON.stringify(next), category: 'AUTH', description: '관리자 화면 잠금 패스키' }, update: { value: JSON.stringify(next) } });
      await prisma.systemSetting.delete({ where: { key: `${key(auth.admin.id)}:registration-challenge` } });
      return NextResponse.json({ success: true });
    }
    if (action === 'authenticate-options') {
      if (!savedCredentials.length) return NextResponse.json({ error: '등록된 패스키가 없습니다.' }, { status: 400 });
      const options = await generateAuthenticationOptions({ rpID, allowCredentials: savedCredentials.map(credential => ({ id: credential.id, transports: credential.transports as never })), userVerification: 'required' });
      await saveChallenge(auth.admin.id, 'authentication', options.challenge);
      return NextResponse.json(options);
    }
    return NextResponse.json({ error: '지원하지 않는 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Screen lock passkey error:', error);
    return NextResponse.json({ error: '패스키 요청을 처리하지 못했습니다.' }, { status: 500 });
  }
}
