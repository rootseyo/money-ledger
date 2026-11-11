import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from './api-token-auth';
import { prisma } from './db';
import { dataScope } from './data-scope';
export function withLedgerScope<A extends unknown[]>(handler: (request: NextRequest, ...args: A) => Promise<Response>) {
  return async (request: NextRequest, ...args: A): Promise<Response> => {
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: auth.status || 401 });
    if (!auth.admin?.id) {
      // The legacy device key can ingest into the original workspace only.
      if (auth.authType !== 'API_KEY' || request.method !== 'POST' || !['/api/card-transactions', '/api/card-transactions/bulk'].includes(request.nextUrl.pathname)) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
      return dataScope.run({ id: 'legacy-device', role: 'OWNER' }, () => handler(request, ...args));
    }
    const user = await prisma.user.findUnique({ where: { id: auth.admin.id } });
    if (!user?.isActive) return NextResponse.json({ error: '사용할 수 없는 계정입니다.' }, { status: 403 });
    const membership = await prisma.systemSetting.findUnique({ where: { key: `household-member:${user.id}` } });
    let householdId: string | undefined;
    let memberIds: string[] | undefined;
    let householdRole: import('./data-scope').HouseholdRole | undefined;
    if (membership?.value) {
      householdId = membership.value;
      const [members, householdRecord, roleSetting] = await Promise.all([
        prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_MEMBER', value: householdId } }),
        prisma.systemSetting.findUnique({ where: { key: `household:${householdId}` } }),
        prisma.systemSetting.findUnique({ where: { key: `household-member-role:${householdId}:${user.id}` } }),
      ]);
      memberIds = members.map(member => member.userId).filter((id): id is string => Boolean(id));
      const household = householdRecord?.value ? JSON.parse(householdRecord.value) : null;
      if (household?.ownerId === user.id) {
        householdRole = 'ADMIN';
      } else if (roleSetting?.value && ['ADMIN', 'EDITOR', 'VIEWER'].includes(roleSetting.value)) {
        householdRole = roleSetting.value as import('./data-scope').HouseholdRole;
      } else {
        householdRole = 'EDITOR'; // 기본값은 호환성을 위해 EDITOR
      }
    }
    if (householdRole === 'VIEWER' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return NextResponse.json({ error: '뷰어 권한은 조회만 가능합니다.' }, { status: 403 });
    }
    return dataScope.run({ ...user, householdId, memberIds, householdRole }, () => handler(request, ...args));
  };
}
