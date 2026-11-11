import { dataScope } from '@/lib/data-scope';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateMonthlyCardReportData,
  sendMonthlyCardReportToSlack,
  buildMonthlySlackBlocks,
} from '@/lib/card-service';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function checkAuth(request: NextRequest): boolean {
  // 1. 관리자 세션 토큰 확인
  if (verifyAdminToken(request)?.role === 'OWNER') return true;

  // 2. CRON_SECRET 확인
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization');
  if (cronSecret && authorization?.startsWith('Bearer ')) {
    const supplied = authorization.slice('Bearer '.length);
    const expectedBuffer = Buffer.from(cronSecret);
    const suppliedBuffer = Buffer.from(supplied);
    if (expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return true;
    }
  }

  // 3. CARD_API_KEY 확인
  const cardKey = process.env.CARD_API_KEY?.trim();
  const headerKey = request.headers.get('x-api-key') || request.headers.get('x-card-api-key');
  if (cardKey && (headerKey === cardKey || authorization === `Bearer ${cardKey}`)) {
    return true;
  }

  // 비밀키가 전혀 설정되지 않은 개발 환경
  if (process.env.NODE_ENV !== 'production' && !cronSecret && !cardKey) return true;

  return false;
}

async function handlePOST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: '권한이 없습니다. (인증 필요)' }, { status: 401 });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const month = body?.month || request.nextUrl.searchParams.get('month') || undefined;
    const isPreview =
      body?.preview === true || request.nextUrl.searchParams.get('preview') === 'true';

    console.info(`[Monthly Card Report] month: ${month || 'current'}, preview: ${isPreview}`);

    if (isPreview) {
      const report = await generateMonthlyCardReportData(month);
      const slackBlocks = buildMonthlySlackBlocks(report);
      return NextResponse.json({
        success: true,
        preview: true,
        report,
        reportText: report.reportText,
        slackBlocks,
      });
    }

    const result = await sendMonthlyCardReportToSlack(month);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Monthly Card Report] Failed:', error);
    return NextResponse.json(
      { error: error?.message || '카드 월간 리포트 생성/전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  return dataScope.run({ id: 'legacy-cron', role: 'OWNER' }, () => handlePOST(request));
}
