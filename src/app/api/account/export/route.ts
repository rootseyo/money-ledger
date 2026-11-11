import { NextRequest, NextResponse } from 'next/server';
import { dataScope } from '@/lib/data-scope';
import { prisma } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';
import { withLedgerScope } from '@/lib/ledger-scope';

export const GET = withLedgerScope(async (request: NextRequest) => {
  // Personal API tokens are for device ingestion and must not authorize a full account export.
  const session = verifyUserToken(request);
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 });

  const scope = dataScope.getStore();
  const [transactions, settings, apiTokens, auditLogs] = await Promise.all([
    prisma.cardTransaction.findMany({ orderBy: { notifiedAt: 'asc' } }),
    prisma.systemSetting.findMany({
      where: scope?.householdId
        ? { OR: [{ userId: user.id }, { key: { startsWith: `${scope.householdId}:` } }] }
        : { userId: user.id },
      select: { key: true, value: true, category: true, updatedAt: true },
    }),
    prisma.apiToken.findMany({ where: { userId: user.id }, select: { id: true, name: true, tokenPrefix: true, expiresAt: true, lastUsedAt: true, isActive: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' }, select: { action: true, target: true, metadata: true, ipAddress: true, userAgent: true, createdAt: true } }),
  ]);

  const response = NextResponse.json({
    exportedAt: new Date().toISOString(),
    account: user,
    householdId: scope?.householdId ?? null,
    transactions,
    settings,
    apiTokens,
    auditLogs,
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Content-Disposition', 'attachment; filename="money-ledger-export.json"');
  return response;
});
