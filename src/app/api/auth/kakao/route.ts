import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { kakaoConfig, KAKAO_STATE_COOKIE, oauthCookie, KAKAO_ACCOUNT_INTENT_COOKIE } from '@/lib/kakao-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/user-api';
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`kakao:${getClientIp(request)}`, { limit: 20, windowMs: 15 * 60000 });
  if (!limit.allowed) return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  try {
    const { clientId, redirectUri } = kakaoConfig();
    const state = randomBytes(32).toString('hex');
    const url = new URL('https://kauth.kakao.com/oauth/authorize');
    url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state }).toString();
    const response = NextResponse.json({ url: url.toString() });
    response.cookies.set(KAKAO_STATE_COOKIE, state, oauthCookie);
    response.cookies.set(KAKAO_ACCOUNT_INTENT_COOKIE, '', { ...oauthCookie, maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '카카오 로그인을 시작하지 못했습니다.' }, { status: 503 }); }
}
