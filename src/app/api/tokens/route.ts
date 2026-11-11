import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, writeAuditLog } from '@/lib/admin-api';
import { generateApiToken } from '@/lib/api-token-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const tokens = await prisma.apiToken.findMany({
      where: {
        userId: auth.user.id,
      },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      tokens,
    });
  } catch (err: unknown) {
    console.error('[API /api/admin/tokens GET] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '토큰 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const name = String(body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: '토큰 이름을 입력해주세요.' }, { status: 400 });
    }

    const expiresDays = body?.expiresDays != null ? Number(body.expiresDays) : null;
    let expiresAt: Date | null = null;
    if (expiresDays && expiresDays > 0) {
      expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
    }

    const { token, prefix } = generateApiToken();

    const created = await prisma.apiToken.create({
      data: {
        userId: auth.user.id,
        name,
        token,
        tokenPrefix: prefix,
        expiresAt,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        token: true,
        tokenPrefix: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
      },
    });

    await writeAuditLog(request, {
      admin: auth.admin,
      action: 'API_TOKEN_CREATE',
      resource: 'api_tokens',
      resourceId: created.id,
      result: 'SUCCESS',
      details: { name, tokenPrefix: prefix, expiresAt: expiresAt?.toISOString() || null },
    });

    return NextResponse.json({
      success: true,
      token: created,
      message: '새로운 API 토큰이 성공적으로 발행되었습니다.',
    });
  } catch (err: unknown) {
    console.error('[API /api/admin/tokens POST] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '토큰 발행 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
