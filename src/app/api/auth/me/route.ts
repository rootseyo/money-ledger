import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = verifyUserToken(request);
  if (!token) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: '계정을 찾을 수 없거나 비활성화되었습니다.' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user,
    admin: user, // compatibility
  });
}
