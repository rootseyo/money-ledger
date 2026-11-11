import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin, writeAuditLog } from '@/lib/admin-api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;

    const existing = await prisma.apiToken.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: '존재하지 않는 토큰입니다.' }, { status: 404 });
    }

    if (existing.userId && existing.userId !== auth.user.id && auth.user.role !== 'OWNER') {
      return NextResponse.json({ error: '해당 토큰을 삭제할 권한이 없습니다.' }, { status: 403 });
    }

    await prisma.apiToken.delete({
      where: { id },
    });

    await writeAuditLog(request, {
      admin: auth.admin,
      action: 'API_TOKEN_DELETE',
      resource: 'api_tokens',
      resourceId: id,
      result: 'SUCCESS',
      details: { name: existing.name, tokenPrefix: existing.tokenPrefix },
    });

    return NextResponse.json({
      success: true,
      message: '토큰이 성공적으로 삭제되었습니다.',
    });
  } catch (err: unknown) {
    console.error('[API /api/admin/tokens/[id] DELETE] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '토큰 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
