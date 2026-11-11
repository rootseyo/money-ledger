import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-token-auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/user-api';
import { parseOptionalGoalAmount } from '@/lib/club-ledger';
import { COMPANY_CATEGORIES } from '@/lib/company-ledger';

const SHARED_KEYS = ['financial_assets_data', 'household_budget', 'household_categories', 'household_payment_methods', 'household_fixed_expenses'];
const CLUB_CATEGORIES = [
  { id: 'CLUB_DUES', name: '정기 회비', type: 'INCOME', emoji: '🧾', color: '#10b981', subcategories: ['월 회비', '분기 회비', '연 회비'] },
  { id: 'CLUB_EXTRA_INCOME', name: '기타 수입', type: 'INCOME', emoji: '💰', color: '#14b8a6', subcategories: ['찬조금', '이자', '기타'] },
  { id: 'CLUB_COURT', name: '코트·장소 대여', type: 'EXPENSE', emoji: '🎾', color: '#3b82f6', subcategories: ['코트 대관', '장소 대여'] },
  { id: 'CLUB_EQUIPMENT', name: '운동·모임 용품', type: 'EXPENSE', emoji: '🎽', color: '#8b5cf6', subcategories: ['공·장비', '소모품'] },
  { id: 'CLUB_EVENT', name: '행사·대회', type: 'EXPENSE', emoji: '🏆', color: '#f59e0b', subcategories: ['대회 참가', '회식', '행사'] },
  { id: 'CLUB_OTHER', name: '기타 지출', type: 'EXPENSE', emoji: '📌', color: '#64748b', subcategories: ['기타'] },
];
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function currentUser(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.authenticated || !auth.admin?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.admin.id } });
  return user?.isActive ? user : null;
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const membership = await prisma.systemSetting.findUnique({ where: { key: `household-member:${user.id}` } });
  if (!membership) return json({ household: null });
  const householdId = membership.value;
  const [record, memberSettings, inviteSettings] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: `household:${householdId}` } }),
    prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_MEMBER', value: householdId }, select: { userId: true } }),
    prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_INVITE', value: householdId } }),
  ]);
  if (!record) return json({ error: '가계부 정보를 찾을 수 없습니다.' }, 404);
  const household = JSON.parse(record.value);
  const ids = memberSettings.map(member => member.userId).filter((id): id is string => Boolean(id));
  const [users, roleRecords] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { id: true, name: true, email: true } }),
    prisma.systemSetting.findMany({ where: { key: { in: ids.map(id => `household-member-role:${householdId}:${id}`) } } }),
  ]);

  const roleMap = new Map<string, 'ADMIN' | 'EDITOR' | 'VIEWER'>();
  for (const r of roleRecords) {
    const parts = r.key.split(':');
    const memberId = parts[2];
    if (memberId && ['ADMIN', 'EDITOR', 'VIEWER'].includes(r.value)) {
      roleMap.set(memberId, r.value as 'ADMIN' | 'EDITOR' | 'VIEWER');
    }
  }

  const members = users.map(u => {
    const isOwner = u.id === household.ownerId;
    const role: 'ADMIN' | 'EDITOR' | 'VIEWER' = isOwner ? 'ADMIN' : (roleMap.get(u.id) || 'EDITOR');
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isOwner,
      role,
    };
  });

  const myMember = members.find(m => m.id === user.id);
  const myRole: 'ADMIN' | 'EDITOR' | 'VIEWER' = myMember ? myMember.role : (user.id === household.ownerId ? 'ADMIN' : 'VIEWER');

  // Load creator names for invites
  const creatorIds = Array.from(new Set(inviteSettings.map(inv => inv.userId).filter((id): id is string => Boolean(id))));
  const creators = creatorIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true } }) : [];
  const creatorMap = new Map(creators.map(c => [c.id, c.name]));

  const invites = inviteSettings.map(inv => {
    const code = inv.key.replace('household-invite:', '');
    let role: 'ADMIN' | 'EDITOR' | 'VIEWER' = 'EDITOR';
    let expiresAt = household.inviteExpiresAt;
    let createdAt = inv.createdAt.toISOString();
    if (inv.description) {
      try {
        const meta = JSON.parse(inv.description);
        if (meta.role) role = meta.role;
        if (meta.expiresAt) expiresAt = meta.expiresAt;
        if (meta.createdAt) createdAt = meta.createdAt;
      } catch {}
    }
    const isExpired = expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
    return {
      code,
      role,
      expiresAt,
      createdAt,
      createdByName: (inv.userId ? creatorMap.get(inv.userId) : null) || '관리자',
      isExpired,
      isDefault: code === household.inviteCode,
    };
  }).filter(inv => !inv.isExpired);

  // Find all households the user owns or belongs to
  const [ownedSettings, roleSettingsAll] = await Promise.all([
    prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD', value: { contains: `"ownerId":"${user.id}"` } } }),
    prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_MEMBER_ROLE', key: { endsWith: `:${user.id}` } } }),
  ]);

  const candidateIds = new Set<string>();
  for (const o of ownedSettings) {
    try { const parsed = JSON.parse(o.value); if (parsed.id) candidateIds.add(parsed.id); } catch {}
  }
  for (const r of roleSettingsAll) {
    const parts = r.key.split(':');
    if (parts[1]) candidateIds.add(parts[1]);
  }
  if (householdId) candidateIds.add(householdId);

  const allRecords = await prisma.systemSetting.findMany({
    where: { key: { in: Array.from(candidateIds).map(id => `household:${id}`) } },
  });

  const myHouseholds = allRecords.map(rec => {
    try {
      const h = JSON.parse(rec.value);
      return {
        id: h.id,
        name: h.name,
        type: h.type || 'WEALTH',
        isOwner: h.ownerId === user.id,
        isActive: h.id === householdId,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return json({
    household,
    memberCount: users.length,
    members,
    myRole,
    invites,
    myHouseholds,
  });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return json({ error: '로그인이 필요합니다.' }, 401);
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    name?: unknown;
    type?: unknown;
    goalAmount?: unknown;
    monthlyDues?: unknown;
    inviteCode?: unknown;
    targetUserId?: unknown;
    role?: unknown;
    householdId?: unknown;
  } | null;
  if (!body) return json({ error: '요청을 확인해 주세요.' }, 400);
  const existing = await prisma.systemSetting.findUnique({ where: { key: `household-member:${user.id}` } });

  // Helper to check admin permission
  const checkAdminPermission = async (householdId: string) => {
    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${householdId}` } });
    if (!record) return { ok: false, status: 404, error: '가계부 정보를 찾을 수 없습니다.' };
    const household = JSON.parse(record.value);
    if (household.ownerId === user.id) return { ok: true, household, isOwner: true };
    const roleSetting = await prisma.systemSetting.findUnique({ where: { key: `household-member-role:${householdId}:${user.id}` } });
    if (roleSetting?.value === 'ADMIN') return { ok: true, household, isOwner: false };
    return { ok: false, status: 403, error: '가계부 관리자 권한이 필요합니다.' };
  };

  if (body.action === 'update-settings') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type;
    const goalAmount = type === 'CLUB' || type === 'COMPANY' ? null : parseOptionalGoalAmount(body.goalAmount);
    const monthlyDues = Number(body.monthlyDues ?? 0);
    if (!name || name.length > 40) return json({ error: '가계부 이름을 1~40자로 입력해 주세요.' }, 400);
    if (type !== 'WEALTH' && type !== 'CLUB' && type !== 'COMPANY') return json({ error: '가계부 유형을 확인해 주세요.' }, 400);
    if (goalAmount === undefined) return json({ error: '목표 금액을 확인해 주세요.' }, 400);
    if (!Number.isSafeInteger(monthlyDues) || monthlyDues < 0 || monthlyDues > 2_147_483_647) return json({ error: '월 회비 금액을 확인해 주세요.' }, 400);
    const household = { ...adminCheck.household, name, type, goalAmount, monthlyDues };
    const result = await prisma.systemSetting.updateMany({ where: { key: `household:${existing.value}`, value: JSON.stringify(adminCheck.household) }, data: { value: JSON.stringify(household), updatedBy: user.id } });
    if (!result.count) return json({ error: '다른 관리자가 가계부를 변경했습니다. 새로고침한 뒤 다시 저장해 주세요.' }, 409);
    return json({ success: true, household });
  }

  if (body.action === 'create-invite') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);

    const role = (body.role === 'ADMIN' || body.role === 'VIEWER') ? body.role : 'EDITOR';
    const inviteCode = randomBytes(5).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const meta = {
      householdId: existing.value,
      role,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    await prisma.systemSetting.create({
      data: {
        key: `household-invite:${inviteCode}`,
        userId: user.id,
        category: 'HOUSEHOLD_INVITE',
        value: existing.value,
        description: JSON.stringify(meta),
      },
    });

    return json({
      success: true,
      invite: {
        code: inviteCode,
        role,
        expiresAt,
        createdAt: meta.createdAt,
        createdByName: user.name,
      },
    });
  }

  if (body.action === 'delete-invite') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);

    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
    if (!inviteCode) return json({ error: '취소할 초대 코드를 확인해 주세요.' }, 400);

    const invite = await prisma.systemSetting.findUnique({ where: { key: `household-invite:${inviteCode}` } });
    if (!invite || invite.value !== existing.value) return json({ error: '해당 초대 코드를 찾을 수 없습니다.' }, 404);

    await prisma.systemSetting.delete({ where: { key: `household-invite:${inviteCode}` } });
    return json({ success: true, deletedCode: inviteCode });
  }

  if (body.action === 'update-member-role') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);

    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    const newRole = body.role;
    if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(newRole as string)) {
      return json({ error: '올바른 권한을 선택해 주세요 (ADMIN, EDITOR, VIEWER).' }, 400);
    }
    if (!targetUserId) return json({ error: '대상을 지정해 주세요.' }, 400);

    const targetMembership = await prisma.systemSetting.findUnique({ where: { key: `household-member:${targetUserId}` } });
    if (!targetMembership || targetMembership.value !== existing.value) {
      return json({ error: '해당 구성원을 찾을 수 없습니다.' }, 404);
    }

    if (adminCheck.household?.ownerId === targetUserId) {
      return json({ error: '소유자의 권한은 변경할 수 없습니다.' }, 400);
    }

    await prisma.systemSetting.upsert({
      where: { key: `household-member-role:${existing.value}:${targetUserId}` },
      update: { value: newRole as string, userId: targetUserId, updatedBy: user.id },
      create: {
        key: `household-member-role:${existing.value}:${targetUserId}`,
        userId: targetUserId,
        category: 'HOUSEHOLD_MEMBER_ROLE',
        value: newRole as string,
        updatedBy: user.id,
      },
    });

    return json({ success: true, targetUserId, role: newRole });
  }

  if (body.action === 'rotate-invite') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);
    const household = adminCheck.household;

    const inviteCode = randomBytes(5).toString('hex').toUpperCase();
    const inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updated = { ...household, inviteCode, inviteExpiresAt };
    const defaultMeta = {
      householdId: existing.value,
      role: 'EDITOR',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: inviteExpiresAt,
    };
    await prisma.$transaction(async db => {
      await db.systemSetting.deleteMany({ where: { key: `household-invite:${household.inviteCode}` } });
      await db.systemSetting.update({ where: { key: `household:${existing.value}` }, data: { value: JSON.stringify(updated) } });
      await db.systemSetting.create({
        data: {
          key: `household-invite:${inviteCode}`,
          userId: user.id,
          category: 'HOUSEHOLD_INVITE',
          value: existing.value!,
          description: JSON.stringify(defaultMeta),
        },
      });
    });
    return json({ success: true, household: updated });
  }

  if (body.action === 'leave') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${existing.value}` } });
    const members = await prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_MEMBER', value: existing.value } });
    if (record && JSON.parse(record.value).ownerId === user.id) return json({ error: members.length > 1 ? '소유권을 다른 구성원에게 넘긴 뒤 나갈 수 있습니다.' : '가계부를 삭제한 뒤 나갈 수 있습니다.' }, 409);
    const ownerId = JSON.parse(record?.value || '{}').ownerId;
    await prisma.$transaction(async db => {
      if (ownerId && ownerId !== user.id) await db.cardTransaction.updateMany({ where: { userId: user.id }, data: { userId: ownerId } });
      await db.systemSetting.delete({ where: { key: `household-member:${user.id}` } });
      await db.systemSetting.deleteMany({ where: { key: `household-member-role:${existing.value}:${user.id}` } });
    });
    return json({ success: true, household: null });
  }

  if (body.action === 'transfer-owner') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${existing.value}` } });
    if (!record || JSON.parse(record.value).ownerId !== user.id) return json({ error: '가계부 소유자만 소유권을 이전할 수 있습니다.' }, 403);
    const targetMembership = targetUserId ? await prisma.systemSetting.findUnique({ where: { key: `household-member:${targetUserId}` } }) : null;
    if (!targetMembership || targetMembership.value !== existing.value || targetUserId === user.id) return json({ error: '소유권을 넘길 구성원을 확인해 주세요.' }, 400);
    const original = JSON.parse(record.value);
    const updated = { ...original, ownerId: targetUserId };
    await prisma.$transaction(async db => {
      await db.cardTransaction.updateMany({ where: { userId: user.id }, data: { userId: targetUserId } });
      await db.systemSetting.updateMany({
        where: { OR: [
          { key: `household:${existing.value}` },
          { key: `household-invite:${original.inviteCode}` },
          { key: { startsWith: `${existing.value}:` } },
        ] },
        data: { userId: targetUserId },
      });
      // 이전 소유자에게 ADMIN 역할 부여, 새 소유자 역할 정리
      await db.systemSetting.upsert({
        where: { key: `household-member-role:${existing.value}:${user.id}` },
        update: { value: 'ADMIN' },
        create: { key: `household-member-role:${existing.value}:${user.id}`, userId: user.id, category: 'HOUSEHOLD_MEMBER_ROLE', value: 'ADMIN' },
      });
      await db.systemSetting.deleteMany({ where: { key: `household-member-role:${existing.value}:${targetUserId}` } });
      await db.systemSetting.update({ where: { key: `household:${existing.value}` }, data: { value: JSON.stringify(updated) } });
    });
    return json({ success: true, household: updated });
  }

  if (body.action === 'remove-member') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
    const adminCheck = await checkAdminPermission(existing.value);
    if (!adminCheck.ok) return json({ error: adminCheck.error }, adminCheck.status);
    if (!targetUserId || targetUserId === user.id) return json({ error: '내보낼 구성원을 확인해 주세요.' }, 400);
    if (adminCheck.household?.ownerId === targetUserId) return json({ error: '소유자는 내보낼 수 없습니다.' }, 400);

    const membership = await prisma.systemSetting.findUnique({ where: { key: `household-member:${targetUserId}` } });
    if (membership?.value !== existing.value) return json({ error: '해당 구성원을 찾을 수 없습니다.' }, 404);
    await prisma.$transaction(async db => {
      await db.cardTransaction.updateMany({ where: { userId: targetUserId }, data: { userId: adminCheck.household.ownerId } });
      await db.systemSetting.delete({ where: { key: `household-member:${targetUserId}` } });
      await db.systemSetting.deleteMany({ where: { key: `household-member-role:${existing.value}:${targetUserId}` } });
    });
    return json({ success: true });
  }

  if (body.action === 'delete-household') {
    if (!existing?.value) return json({ error: '참여 중인 가계부가 없습니다.' }, 404);
    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${existing.value}` } });
    if (!record || JSON.parse(record.value).ownerId !== user.id) return json({ error: '가계부 소유자만 삭제할 수 있습니다.' }, 403);
    const members = await prisma.systemSetting.findMany({ where: { category: 'HOUSEHOLD_MEMBER', value: existing.value }, select: { userId: true } });
    if (members.length !== 1 || members[0]?.userId !== user.id) return json({ error: '다른 구성원이 있으면 먼저 소유권을 이전하거나 구성원을 내보내 주세요.' }, 409);
    await prisma.$transaction(async db => {
      await db.systemSetting.deleteMany({ where: { category: 'HOUSEHOLD_INVITE', value: existing.value } });
      await db.duesPayment.deleteMany({ where: { member: { workspaceId: existing.value } } });
      await db.ledgerMember.deleteMany({ where: { workspaceId: existing.value } });
      await db.systemSetting.deleteMany({ where: { key: { startsWith: `${existing.value}:` } } });
      await db.systemSetting.deleteMany({ where: { key: `household-member:${user.id}` } });
      await db.systemSetting.deleteMany({ where: { key: { startsWith: `household-member-role:${existing.value}:` } } });
      await db.systemSetting.delete({ where: { key: `household:${existing.value}` } });
    });
    return json({ success: true, household: null });
  }

  if (body.action === 'create') {
    if (existing) return json({ error: '이미 참여 중인 가계부가 있습니다.' }, 409);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type = body.type === 'CLUB' || body.type === 'COMPANY' ? body.type : body.type === undefined || body.type === 'WEALTH' ? 'WEALTH' : null;
    const goalAmount = type === 'CLUB' || type === 'COMPANY' ? null : parseOptionalGoalAmount(body.goalAmount);
    if (!name || name.length > 40) return json({ error: '가계부 이름을 1~40자로 입력해 주세요.' }, 400);
    if (!type) return json({ error: '가계부 유형을 확인해 주세요.' }, 400);
    if (goalAmount === undefined) return json({ error: '목표 금액을 확인해 주세요.' }, 400);
    const id = randomUUID();
    const inviteCode = randomBytes(5).toString('hex').toUpperCase();
    const inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const household = { id, name, type, goalAmount, inviteCode, inviteExpiresAt, ownerId: user.id, createdAt: new Date().toISOString() };
    const defaultMeta = {
      householdId: id,
      role: 'EDITOR',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: inviteExpiresAt,
    };
    try {
      await prisma.$transaction(async db => {
        await db.systemSetting.createMany({ data: [
          { key: `household:${id}`, userId: user.id, category: 'HOUSEHOLD', value: JSON.stringify(household) },
          { key: `household-invite:${inviteCode}`, userId: user.id, category: 'HOUSEHOLD_INVITE', value: id, description: JSON.stringify(defaultMeta) },
          { key: `household-member:${user.id}`, userId: user.id, category: 'HOUSEHOLD_MEMBER', value: id },
          { key: `household-member-role:${id}:${user.id}`, userId: user.id, category: 'HOUSEHOLD_MEMBER_ROLE', value: 'ADMIN' },
        ] });
        if (user.role === 'OWNER') await db.cardTransaction.updateMany({ where: { userId: null }, data: { userId: user.id } });
        for (const key of SHARED_KEYS) {
          if ((type === 'CLUB' || type === 'COMPANY') && key === 'household_categories') {
            await db.systemSetting.create({ data: { key: `${id}:${key}`, userId: user.id, category: 'HOUSEHOLD', value: JSON.stringify(type === 'CLUB' ? CLUB_CATEGORIES : COMPANY_CATEGORIES) } });
            continue;
          }
          // 회사 가계부는 개인 자산·예산·고정비를 복사하지 않고 빈 상태로 시작한다.
          if (type === 'COMPANY' && key !== 'household_payment_methods') continue;
          const personal = await db.systemSetting.findFirst({ where: { key: `${user.id}:${key}` } })
            ?? (user.role === 'OWNER' ? await db.systemSetting.findUnique({ where: { key } }) : null);
          if (personal) await db.systemSetting.create({ data: { key: `${id}:${key}`, userId: user.id, category: personal.category, value: personal.value, description: personal.description } });
        }
      });
      return json({ success: true, household }, 201);
    } catch (error) {
      console.error('Household create failed:', error);
      return json({ error: '가계부를 만들지 못했습니다. 다시 시도해 주세요.' }, 500);
    }
  }

  if (body.action === 'switch') {
    const targetHouseholdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
    if (!targetHouseholdId) return json({ error: '전환할 가계부 ID를 입력해 주세요.' }, 400);

    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${targetHouseholdId}` } });
    if (!record) return json({ error: '해당 가계부를 찾을 수 없습니다.' }, 404);
    const household = JSON.parse(record.value);

    // Check ownership or member role
    const isOwner = household.ownerId === user.id;
    const memberRole = await prisma.systemSetting.findUnique({ where: { key: `household-member-role:${targetHouseholdId}:${user.id}` } });
    if (!isOwner && !memberRole) {
      return json({ error: '해당 가계부의 구성원만 전환할 수 있습니다.' }, 403);
    }

    await prisma.systemSetting.upsert({
      where: { key: `household-member:${user.id}` },
      update: { value: targetHouseholdId },
      create: {
        key: `household-member:${user.id}`,
        userId: user.id,
        category: 'HOUSEHOLD_MEMBER',
        value: targetHouseholdId,
      },
    });

    return json({ success: true, household });
  }

  if (body.action === 'join') {
    if (existing) return json({ error: '이미 참여 중인 가계부가 있습니다.' }, 409);
    const limit = await checkRateLimit(`household-join:${user.id}:${getClientIp(request)}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) return json({ error: '초대 코드 입력이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }, 429);
    const inviteCode = typeof body.inviteCode === 'string' ? body.inviteCode.trim().toUpperCase() : '';
    if (!/^[A-F0-9]{10}$/.test(inviteCode)) return json({ error: '초대 코드를 확인해 주세요.' }, 400);
    const invite = await prisma.systemSetting.findUnique({ where: { key: `household-invite:${inviteCode}` } });
    if (!invite?.value) return json({ error: '유효한 초대 코드를 찾을 수 없습니다.' }, 404);
    const record = await prisma.systemSetting.findUnique({ where: { key: `household:${invite.value}` } });
    if (!record) return json({ error: '가계부 정보를 찾을 수 없습니다.' }, 404);
    const household = JSON.parse(record.value);

    let assignedRole: 'ADMIN' | 'EDITOR' | 'VIEWER' = 'EDITOR';
    let expiresAt = household.inviteExpiresAt;
    if (invite.description) {
      try {
        const meta = JSON.parse(invite.description);
        if (meta.role && ['ADMIN', 'EDITOR', 'VIEWER'].includes(meta.role)) assignedRole = meta.role;
        if (meta.expiresAt) expiresAt = meta.expiresAt;
      } catch {}
    }

    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return json({ error: '초대 코드가 만료되었거나 취소되었습니다.' }, 410);
    }

    try {
      await prisma.$transaction(async db => {
        await db.systemSetting.create({
          data: { key: `household-member:${user.id}`, userId: user.id, category: 'HOUSEHOLD_MEMBER', value: invite.value },
        });
        await db.systemSetting.create({
          data: { key: `household-member-role:${invite.value}:${user.id}`, userId: user.id, category: 'HOUSEHOLD_MEMBER_ROLE', value: assignedRole },
        });
      });
      return json({ success: true, household, role: assignedRole });
    } catch {
      return json({ error: '참여 처리에 실패했습니다. 이미 다른 가계부에 참여했는지 확인해 주세요.' }, 409);
    }
  }

  return json({ error: '지원하지 않는 요청입니다.' }, 400);
}
