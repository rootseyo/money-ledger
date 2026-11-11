import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { accountRateLimit, requireAccountSession } from '@/lib/account-security';
import { KAKAO_DELETE_PROOF_COOKIE, verifyDeleteProof } from '@/lib/kakao-auth';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { prisma } from '@/lib/db';

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, '', {
    httpOnly: name === SESSION_COOKIE_NAME,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAccountSession(request);
  if (auth.error) return auth.error;
  const limited = await accountRateLimit(request, auth.user.id, 'delete');
  if (limited) return limited;

  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown; confirmation?: unknown } | null;
  if (!body || body.confirmation !== '계정 삭제') {
    return NextResponse.json({ error: '확인 문구에 “계정 삭제”를 입력해 주세요.' }, { status: 400 });
  }

  const user = auth.user;
  if (!user?.isActive) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  if (!user.email.endsWith('@users.invalid') && (typeof body.email !== 'string' || body.email.trim().toLowerCase() !== user.email.toLowerCase())) {
    return NextResponse.json({ error: '가입 이메일이 일치하지 않습니다.' }, { status: 400 });
  }
  if (user.role !== 'DEMO') {
    if (user.email.endsWith('@users.invalid')) {
      if (!verifyDeleteProof(request.cookies.get(KAKAO_DELETE_PROOF_COOKIE)?.value, user.id)) return NextResponse.json({ error: '카카오로 본인 인증을 다시 진행해 주세요.' }, { status: 401 });
    }
    else if (typeof body.password !== 'string' || !(await bcrypt.compare(body.password, user.password))) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
  }

  const membership = await prisma.systemSetting.findUnique({ where: { key: `household-member:${user.id}` } });
  if (membership) {
    return NextResponse.json({ error: '계정 삭제 전에 가계부에서 나가 주세요. 소유자라면 먼저 가계부를 삭제하거나 소유권을 이전해야 합니다.' }, { status: 409 });
  }
  if (user.role === 'OWNER' && await prisma.cardTransaction.count({ where: { userId: null } })) {
    return NextResponse.json({ error: '계정에 연결되지 않은 기존 거래가 있습니다. 먼저 가계부를 만들어 기존 거래를 연결한 뒤 삭제해 주세요.' }, { status: 409 });
  }

  try {
    await prisma.$transaction(async db => {
      await db.cardTransaction.deleteMany({ where: { userId: user.id } });
      await db.systemSetting.deleteMany({ where: { OR: [
        { userId: user.id },
        { key: { startsWith: `${user.id}:` } },
        { key: `admin-screen-passkeys:${user.id}` },
        { key: { startsWith: `admin-screen-passkeys:${user.id}:` } },
        { key: { startsWith: `analytics-layout:v1:${user.id}` } },
        { key: { startsWith: `card-list-order:${user.id}:` } },
      ] } });
      await db.auditLog.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    });

    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store');
    for (const name of [SESSION_COOKIE_NAME, 'admin_token', 'admin_screen_lock', 'money_kakao_state', 'money_kakao_pending', 'money_kakao_account_intent', KAKAO_DELETE_PROOF_COOKIE]) clearCookie(response, name);
    return response;
  } catch (error) {
    console.error('Account deletion failed:', error);
    return NextResponse.json({ error: '계정 삭제를 완료하지 못했습니다. 개인정보 문의 이메일로 요청해 주세요.' }, { status: 500 });
  }
}
