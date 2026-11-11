import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './db';
import { verifyUserToken, SESSION_COOKIE_NAME } from './auth';
import { checkRateLimit } from './rate-limit';
import { getClientIp } from './user-api';
import { SITE_URL } from './seo';

export { validatePassword } from './password-policy';

export async function requireAccountSession(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== (process.env.NODE_ENV === 'production' ? SITE_URL : request.nextUrl.origin)) return { error: NextResponse.json({ error: '올바른 페이지에서 다시 요청해 주세요.' }, { status: 403 }) };
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  // Account changes require the browser session, never an integration API token.
  const sessionRequest = new NextRequest(request.url, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token || ''}` } });
  const session = verifyUserToken(sessionRequest);
  if (!session) return { error: NextResponse.json({ error: '다시 로그인해 주세요.' }, { status: 401 }) };
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.isActive) return { error: NextResponse.json({ error: '다시 로그인해 주세요.' }, { status: 401 }) };
  return { user };
}

export async function accountRateLimit(request: NextRequest, userId: string, action: string) {
  const limit = await checkRateLimit(`account:${action}:${userId}:${getClientIp(request)}`, { limit: 5, windowMs: 15 * 60000 });
  return limit.allowed ? null : NextResponse.json({ error: '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
}
