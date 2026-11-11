import { setSession } from '@/lib/auth-session';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { signUserToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getClientIp, writeAuditLog } from '@/lib/user-api';
import { checkRateLimit } from '@/lib/rate-limit';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 모두 입력해주세요.' }, { status: 400 });
    }

    const rateLimit = await checkRateLimit(`login:${getClientIp(request)}:${email}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !user.isActive || !isMatch) {
      await writeAuditLog(request, {
        email,
        action: 'LOGIN',
        resource: 'auth',
        result: 'FAILURE',
      });
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const token = signUserToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const userContext = { id: user.id, email: user.email, name: user.name, role: user.role };
    await writeAuditLog(request, {
      user: userContext,
      action: 'LOGIN',
      resource: 'auth',
      result: 'SUCCESS',
    });

    const response = NextResponse.json({ success: true, user: userContext });

    // Host-only cookie without explicit domain
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return setSession(response, userContext);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
