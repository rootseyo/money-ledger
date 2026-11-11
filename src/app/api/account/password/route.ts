import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { accountRateLimit, requireAccountSession, validatePassword } from '@/lib/account-security';
import { setSession } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  const auth = await requireAccountSession(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  const limited = await accountRateLimit(request, user.id, 'password');
  if (limited) return limited;
  if (user.role === 'DEMO' || user.email.endsWith('@users.invalid')) return NextResponse.json({ error: '이메일로 가입한 계정에서 비밀번호를 변경할 수 있습니다.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const error = validatePassword(body?.newPassword);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (body.newPassword !== body.confirmPassword) return NextResponse.json({ error: '새 비밀번호가 일치하지 않습니다.' }, { status: 400 });
  if (typeof body.currentPassword !== 'string' || !(await bcrypt.compare(body.currentPassword, user.password))) return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });
  if (await bcrypt.compare(body.newPassword, user.password)) return NextResponse.json({ error: '현재 비밀번호와 다른 비밀번호를 입력해 주세요.' }, { status: 400 });
  const password = await bcrypt.hash(body.newPassword, 12);
  const updated = await prisma.user.updateMany({ where: { id: user.id, password: user.password, isActive: true }, data: { password } });
  if (!updated.count) return NextResponse.json({ error: '계정 정보가 변경되었습니다. 다시 로그인해 주세요.' }, { status: 409 });
  return setSession(NextResponse.json({ success: true }), user);
}
