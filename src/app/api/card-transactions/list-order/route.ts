import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isCardList, validListOrder } from '@/lib/card-list-order';

export const dynamic = 'force-dynamic';

async function handleGET(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  const list = request.nextUrl.searchParams.get('list');
  if (!isCardList(list)) return NextResponse.json({ error: '잘못된 목록입니다.' }, { status: 400 });
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: `card-list-order:${admin.id}:${list}` } });
    const ids: unknown = setting ? JSON.parse(setting.value) : [];
    return NextResponse.json({ ids: validListOrder(ids) ? ids : [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '목록 순서를 불러오지 못했습니다.' }, { status: 500 });
  }
}

async function handlePATCH(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!body || !isCardList(body.list) || !validListOrder(body.ids)) {
    return NextResponse.json({ error: '잘못된 목록 순서입니다.' }, { status: 400 });
  }
  try {
    const key = `card-list-order:${admin.id}:${body.list}`;
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(body.ids), category: 'CARD_HISTORY', updatedBy: admin.id },
      update: { value: JSON.stringify(body.ids), updatedBy: admin.id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '목록 순서를 저장하지 못했습니다.' }, { status: 500 });
  }
}

export const GET = withLedgerScope(handleGET);
export const PATCH = withLedgerScope(handlePATCH);
