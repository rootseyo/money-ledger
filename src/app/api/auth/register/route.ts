import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth-session';
import { POLICY_VERSION, validateSignup } from '@/lib/signup';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/user-api';
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`signup:${getClientIp(request)}`, { limit: 5, windowMs: 15 * 60000 });
  if (!limit.allowed) return NextResponse.json({ error: '가입 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: '올바른 가입 정보를 입력해주세요.' }, { status: 400 });
  const error = validateSignup(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  try {
    const email = body.email.trim().toLowerCase();
    const password = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async db => {
      const user = await db.user.create({ data: { email, password, name: email.split('@')[0], role: 'MEMBER', lastLoginAt: new Date() } });
      await db.systemSetting.create({ data: { key: `${user.id}:policy-consent`, userId: user.id, category: 'AUTH', value: JSON.stringify({ terms: POLICY_VERSION, privacy: POLICY_VERSION, acceptedAt: new Date().toISOString() }) } });
      return user;
    });
    return setSession(NextResponse.json({ success: true }, { status: 201 }), user);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') return NextResponse.json({ error: '이미 가입된 이메일입니다. 로그인해주세요.' }, { status: 409 });
    console.error('Signup failed:', error);
    return NextResponse.json({ error: '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
