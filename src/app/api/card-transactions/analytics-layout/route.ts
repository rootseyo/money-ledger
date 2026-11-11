import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { defaultDashboardLayout, validDashboardLayout } from '@/lib/analytics-layout';

async function handleGET(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: `analytics-layout:v1:${admin.id}` } });
    const layout: unknown = setting ? JSON.parse(setting.value) : null;
    return NextResponse.json({ layout: validDashboardLayout(layout) ? layout : defaultDashboardLayout() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '배치를 불러오지 못했습니다.' }, { status: 500 });
  }
}
async function handlePATCH(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }); }
  if (!validDashboardLayout(body?.layout)) return NextResponse.json({ error: '잘못된 대시보드 배치입니다.' }, { status: 400 });
  try {
    const key = `analytics-layout:v1:${admin.id}`;
    await prisma.systemSetting.upsert({ where: { key },
      create: { key, value: JSON.stringify(body.layout), category: 'CARD_HISTORY', updatedBy: admin.id },
      update: { value: JSON.stringify(body.layout), updatedBy: admin.id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '배치를 저장하지 못했습니다.' }, { status: 500 });
  }
}

export const GET = withLedgerScope(handleGET);
export const PATCH = withLedgerScope(handlePATCH);
