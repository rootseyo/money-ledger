import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, isAllowedOrigin } from '@/lib/cors';
import { fetchStockExternalData, STOCK_PROFILES } from '@/lib/stock-detail';

function response(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      'Cache-Control': status === 200 ? 'public, max-age=15, stale-while-revalidate=30' : 'no-store',
    },
  });
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return isAllowedOrigin(origin)
    ? new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
    : new NextResponse(null, { status: 403 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) return response({ error: 'Origin not allowed.' }, 403, origin);

  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toUpperCase();
  const profile = STOCK_PROFILES[code];
  if (!profile) return response({ error: '지원하지 않는 종목입니다.' }, 404, origin);

  try {
    const external = await fetchStockExternalData(profile);

    return response({
      success: true,
      data: {
        profile: { code: profile.code, name: profile.name, market: profile.market },
        fundamentals: external.fundamentals,
        news: external.news,
        polls: [],
      },
    }, 200, origin);
  } catch (error) {
    console.error(`[StockDetail API] Failed to fetch code=${code}:`, error);
    return response({ error: '종목 상세 정보를 불러오지 못했습니다.' }, 500, origin);
  }
}
