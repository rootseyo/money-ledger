import { dataScope } from '@/lib/data-scope';
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sendDailyCardReportToSlack } from '@/lib/card-service';
import { verifyAdminToken } from '@/lib/auth';

function checkAuth(request: NextRequest): boolean {
  // 1. 관리자 세션 쿠키/JWT 확인 (어드민 화면 브라우저 수동 발송 허용)
  if (verifyAdminToken(request)?.role === 'OWNER') return true;

  // 2. CRON_SECRET 확인 (배치 크론잡 허용)
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

  // 3. CARD_API_KEY 확인 (수동 curl / 앱 / 웹훅 허용)
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
    return NextResponse.json({ error: '권한이 없습니다. (관리자 세션, CRON_SECRET 또는 CARD_API_KEY 필요)' }, { status: 401 });
  }

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }

    const targetDate = body?.targetDate || request.nextUrl.searchParams.get('targetDate') || undefined;
    const forceAll = body?.forceAll === true || request.nextUrl.searchParams.get('forceAll') === 'true';

    console.info(`[Card Report Cron] Starting daily card report... (targetDate: ${targetDate || 'unreported'}, forceAll: ${forceAll})`);
    const result = await sendDailyCardReportToSlack({ targetDate, forceAll });
    console.info('[Card Report Cron] Completed:', result);

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    console.error('[Card Report Cron] Failed:', error);
    return NextResponse.json(
      { error: error?.message || '카드 일일 리포트 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // GET 요청도 동일하게 처리 (Vercel Cron 또는 웹 브라우저/수동 호출 편의)
  return POST(request);
}

export async function POST(request: NextRequest) {
  return dataScope.run({ id: 'legacy-cron', role: 'OWNER' }, () => handlePOST(request));
}
