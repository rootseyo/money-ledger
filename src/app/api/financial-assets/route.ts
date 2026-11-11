import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { getFinancialAssets, saveFinancialAssets } from '@/lib/financial-assets-server';
import { FinancialData } from '@/lib/financial-assets';
import { verifyAdminToken } from '@/lib/auth';

async function handleGET() {
  try {
    const result = await getFinancialAssets();
    return NextResponse.json({
      success: true,
      data: result.data,
      summary: result.summary,
      isDefault: result.isDefault,
    });
  } catch (error: any) {
    console.error('[API /api/financial-assets GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '자산 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '유효하지 않은 요청 데이터입니다.' }, { status: 400 });
    }

    const payload: FinancialData = {
      cards: Array.isArray(body.cards) ? body.cards : [],
      accounts: Array.isArray(body.accounts) ? body.accounts : [],
      savings: Array.isArray(body.savings) ? body.savings : [],
      investments: Array.isArray(body.investments) ? body.investments : [],
      liabilities: Array.isArray(body.liabilities) ? body.liabilities : [],
      realEstates: Array.isArray(body.realEstates) ? body.realEstates : [],
      updatedAt: new Date().toISOString(),
    };

    const saved = await saveFinancialAssets(payload, admin.id);

    return NextResponse.json({
      success: true,
      message: '자산 및 금융 계좌 정보가 성공적으로 저장되었습니다.',
      data: saved.data,
      summary: saved.summary,
    });
  } catch (error: any) {
    console.error('[API /api/financial-assets POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '자산 정보를 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
