import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAccountSession } from '@/lib/account-security';
import { KAKAO_DELETE_PROOF_COOKIE, verifyDeleteProof } from '@/lib/kakao-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAccountSession(request);
  if (auth.error) return auth.error;
  const { user } = auth;
  const [identity, membership] = await Promise.all([
    prisma.systemSetting.findFirst({ where: { userId: user.id, key: { startsWith: 'kakao-identity:' } }, select: { key: true } }),
    prisma.systemSetting.findUnique({ where: { key: `household-member:${user.id}` }, select: { key: true } }),
  ]);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email.endsWith('@users.invalid') ? null : user.email, isDemo: user.role === 'DEMO', createdAt: user.createdAt, kakaoLinked: Boolean(identity), hasPassword: !user.email.endsWith('@users.invalid') && user.role !== 'DEMO', hasHousehold: Boolean(membership), deletionVerified: verifyDeleteProof(request.cookies.get(KAKAO_DELETE_PROOF_COOKIE)?.value, user.id) } }, { headers: { 'Cache-Control': 'no-store' } });
}
