import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';
import { setSession } from '@/lib/auth-session';
import { kakaoConfig, KAKAO_STATE_COOKIE, KAKAO_PENDING_COOKIE, oauthCookie, signKakaoPending, KAKAO_ACCOUNT_INTENT_COOKIE, KAKAO_DELETE_PROOF_COOKIE, readAccountIntent, signDeleteProof } from '@/lib/kakao-auth';
export async function GET(request: NextRequest) {
  const baseUrl = process.env.KAKAO_REDIRECT_URI?.trim() || request.url;
  const intentCookie = request.cookies.get(KAKAO_ACCOUNT_INTENT_COOKIE)?.value;
  const intent = readAccountIntent(intentCookie);
  const finish = (response: NextResponse) => {
    response.cookies.set(KAKAO_STATE_COOKIE, '', { ...oauthCookie, maxAge: 0 });
    response.cookies.set(KAKAO_ACCOUNT_INTENT_COOKIE, '', { ...oauthCookie, maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const fail = () => finish(NextResponse.redirect(new URL(intentCookie ? '/mypage?kakao=error' : '/login?kakaoError=1', baseUrl)));
  const state = request.nextUrl.searchParams.get('state') || '';
  const expected = request.cookies.get(KAKAO_STATE_COOKIE)?.value || '';
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(state) || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return fail();
  if (intentCookie && (!intent || intent.state !== state || verifyUserToken(request)?.id !== intent.userId)) return fail();
  const code = request.nextUrl.searchParams.get('code');
  if (!code || request.nextUrl.searchParams.has('error')) return fail();
  try {
    const { clientId, redirectUri } = kakaoConfig();
    const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code });
    if (process.env.KAKAO_CLIENT_SECRET) params.set('client_secret', process.env.KAKAO_CLIENT_SECRET.trim());
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: params,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) {
      console.error('Kakao token exchange failed:', tokenResponse.status, await tokenResponse.text().catch(() => ''));
      return fail();
    }
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string') return fail();
    const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${token.access_token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!profileResponse.ok) {
      console.error('Kakao profile fetch failed:', profileResponse.status, await profileResponse.text().catch(() => ''));
      return fail();
    }
    const profile = await profileResponse.json();
    if (!Number.isSafeInteger(profile.id) || profile.id <= 0) return fail();
    const kakaoId = String(profile.id);
    if (intent) {
      const user = await prisma.user.findUnique({ where: { id: intent.userId } });
      if (!user?.isActive || user.role === 'DEMO' || createHash('sha256').update(user.password).digest('hex') !== intent.credential) return fail();
      if (intent.action === 'delete') {
        const identity = await prisma.systemSetting.findUnique({ where: { key: `kakao-identity:${kakaoId}` } });
        if (identity?.userId !== user.id || !user.email.endsWith('@users.invalid')) return fail();
        const response = NextResponse.redirect(new URL('/mypage?kakao=verified', baseUrl));
        response.cookies.set(KAKAO_DELETE_PROOF_COOKIE, signDeleteProof(user.id), { ...oauthCookie, maxAge: 300 });
        return finish(response);
      }
      try {
        await prisma.$transaction(async db => {
          // Serialize connections for one account; the unique key protects Kakao ownership.
          await db.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
          const currentUser = await db.user.findUnique({ where: { id: user.id } });
          if (!currentUser?.isActive || currentUser.password !== user.password) throw new Error('Account changed');
          if (await db.systemSetting.findFirst({ where: { userId: user.id, key: { startsWith: 'kakao-identity:' } } })) throw new Error('Already connected');
          await db.systemSetting.create({ data: { key: `kakao-identity:${kakaoId}`, userId: user.id, category: 'AUTH', value: kakaoId } });
        });
      } catch { return finish(NextResponse.redirect(new URL('/mypage?kakao=conflict', baseUrl))); }
      return finish(NextResponse.redirect(new URL('/mypage?kakao=linked', baseUrl)));
    }
    const identity = await prisma.systemSetting.findUnique({ where: { key: `kakao-identity:${kakaoId}` } });
    if (identity?.userId) {
      const user = await prisma.user.findUnique({ where: { id: identity.userId } });
      if (!user?.isActive) return fail();
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      return finish(setSession(NextResponse.redirect(new URL('/workspace', baseUrl)), user));
    }
    const response = NextResponse.redirect(new URL('/signup?kakao=1', baseUrl));
    response.cookies.set(KAKAO_PENDING_COOKIE, signKakaoPending(kakaoId), oauthCookie);
    return finish(response);
  } catch (err) { console.error('Kakao authentication failed:', err); return fail(); }
}
