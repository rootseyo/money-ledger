import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth-session';
import { KAKAO_PENDING_COOKIE, oauthCookie, readKakaoPending } from '@/lib/kakao-auth';
import { POLICY_VERSION } from '@/lib/signup';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/user-api';
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`kakao-register:${getClientIp(request)}`, { limit: 5, windowMs: 15 * 60000 });
  if (!limit.allowed) return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  const kakaoId = readKakaoPending(request.cookies.get(KAKAO_PENDING_COOKIE)?.value);
  if (!kakaoId) return NextResponse.json({ error: '카카오 인증이 만료되었습니다. 다시 로그인해주세요.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.termsAccepted !== true || body?.privacyAccepted !== true) return NextResponse.json({ error: '서비스 이용약관과 개인정보 처리방침에 동의해주세요.' }, { status: 400 });
  try {
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const user = await prisma.$transaction(async db => {
      const user = await db.user.create({ data: { email: `kakao-${kakaoId}@users.invalid`, password, name: '카카오 회원', role: 'MEMBER', lastLoginAt: new Date() } });
      await db.systemSetting.createMany({ data: [
        { key: `kakao-identity:${kakaoId}`, userId: user.id, category: 'AUTH', value: kakaoId },
        { key: `${user.id}:policy-consent`, userId: user.id, category: 'AUTH', value: JSON.stringify({ terms: POLICY_VERSION, privacy: POLICY_VERSION, acceptedAt: new Date().toISOString(), provider: 'kakao' }) },
      ] });
      return user;
    });
    const response = setSession(NextResponse.json({ success: true }, { status: 201 }), user);
    response.cookies.set(KAKAO_PENDING_COOKIE, '', { ...oauthCookie, maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ error: '가입 처리에 실패했습니다. 카카오 로그인을 다시 시도해주세요.' }, { status: 409 }); }
}
