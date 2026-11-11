import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyUserToken, type UserPayload } from '@/lib/auth';

export interface UserContext {
  id: string;
  email: string;
  name: string;
  role: string;
}

export type UserAuthResult =
  | { ok: true; user: UserContext; admin: UserContext }
  | { ok: false; response: NextResponse };

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function requireUser(request: NextRequest): Promise<UserAuthResult> {
  const payload = verifyUserToken(request);
  if (!payload) {
    return {
      ok: false,
      response: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user?.isActive) {
    return {
      ok: false,
      response: NextResponse.json({ error: '비활성화된 계정입니다.' }, { status: 403 }),
    };
  }

  const ctx: UserContext = { id: user.id, email: user.email, name: user.name, role: user.role };

  return {
    ok: true,
    user: ctx,
    admin: ctx,
  };
}

export const requireAdmin = requireUser;
export type AdminContext = UserContext;
export type AdminAuthResult = UserAuthResult;

export async function writeAuditLog(
  request: NextRequest,
  input: {
    admin?: UserContext | null;
    user?: UserContext | null;
    email?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    result?: 'SUCCESS' | 'FAILURE';
    reason?: string;
    details?: Record<string, unknown>;
  }
) {
  try {
    const actor = input.user || input.admin;
    await prisma.auditLog.create({
      data: {
        userId: actor?.id || null,
        action: input.action,
        target: input.resource ? `${input.resource}${input.resourceId ? `:${input.resourceId}` : ''}` : null,
        metadata: input.details ? (input.details as any) : undefined,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
