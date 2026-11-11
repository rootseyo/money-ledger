import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { accountRateLimit, requireAccountSession } from '@/lib/account-security';
import { kakaoConfig, KAKAO_ACCOUNT_INTENT_COOKIE, KAKAO_STATE_COOKIE, oauthCookie, signAccountIntent } from '@/lib/kakao-auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const auth = await requireAccountSession(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  const limited = await accountRateLimit(request, user.id, 'kakao');
  if (limited) return limited;
  if (user.role === 'DEMO') return NextResponse.json({ error: '데모 계정에는 카카오 계정을 연결할 수 없습니다.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!['link', 'delete'].includes(body?.action)) return NextResponse.json({ error: '요청을 확인해 주세요.' }, { status: 400 });
  if (body.action === 'link') {
    if (user.email.endsWith('@users.invalid')) return NextResponse.json({ error: '이미 카카오로 가입한 계정입니다.' }, { status: 409 });
    if (typeof body.password !== 'string' || !(await bcrypt.compare(body.password, user.password))) return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    if (await prisma.systemSetting.findFirst({ where: { userId: user.id, key: { startsWith: 'kakao-identity:' } } })) return NextResponse.json({ error: '이미 카카오 계정이 연결되어 있습니다.' }, { status: 409 });
  } else if (!user.email.endsWith('@users.invalid')) return NextResponse.json({ error: '이메일 계정은 현재 비밀번호로 탈퇴를 확인해 주세요.' }, { status: 400 });
  try {
    const { clientId, redirectUri } = kakaoConfig();
    const state = randomBytes(32).toString('hex');
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state, prompt: 'login' }).toString();
    const response = NextResponse.json({ url: url.toString() }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(KAKAO_STATE_COOKIE, state, oauthCookie);
    response.cookies.set(KAKAO_ACCOUNT_INTENT_COOKIE, signAccountIntent({ userId: user.id, state, action: body.action, credential: createHash('sha256').update(user.password).digest('hex') }), oauthCookie);
    return response;
  } catch { return NextResponse.json({ error: '카카오 연결을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 503 }); }
}
