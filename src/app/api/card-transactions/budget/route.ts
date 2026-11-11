import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

const BUDGET_KEY = 'household_budget';

export interface HouseholdBudgetConfig {
  monthlyTotal: number;
  monthlyFixedIncome?: number; // 매달 고정 수익 (자동 반복 설정)
  categoryBudgets: Record<string, number>;
  updatedAt?: string;
}

const DEFAULT_BUDGET: HouseholdBudgetConfig = {
  monthlyTotal: 1500000,
  monthlyFixedIncome: 0,
  categoryBudgets: {
    FOOD: 500000,
    CAFE: 100000,
    TRANS: 150000,
    SHOPPING: 300000,
    LIVING: 200000,
    INSURANCE: 150000,
    HEALTH: 100000,
    CULTURE: 100000,
    TRANSFER: 0,
    OTHER: 50000,
  },
};

async function handleGET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: BUDGET_KEY },
    });

    if (!setting) {
      return NextResponse.json({
        success: true,
        budget: DEFAULT_BUDGET,
        isDefault: true,
      });
    }

    const parsed = JSON.parse(setting.value) as HouseholdBudgetConfig;
    return NextResponse.json({
      success: true,
      budget: parsed,
      isDefault: false,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/budget GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '예산 정보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  const admin = verifyAdminToken(request);
  if (!admin) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const monthlyTotal = Math.max(0, Number(body.monthlyTotal) || 0);
    const categoryBudgets: Record<string, number> = {};

    if (body.categoryBudgets && typeof body.categoryBudgets === 'object') {
      for (const [key, val] of Object.entries(body.categoryBudgets)) {
        categoryBudgets[key] = Math.max(0, Number(val) || 0);
      }
    }

    let existingIncome = 0;
    try {
      const cur = await prisma.systemSetting.findUnique({ where: { key: BUDGET_KEY } });
      if (cur) {
        const curParsed = JSON.parse(cur.value);
        existingIncome = curParsed.monthlyFixedIncome || 0;
      }
    } catch {}

    const monthlyFixedIncome =
      body.monthlyFixedIncome !== undefined
        ? Math.max(0, Number(body.monthlyFixedIncome) || 0)
        : existingIncome;

    const config: HouseholdBudgetConfig = {
      monthlyTotal,
      monthlyFixedIncome,
      categoryBudgets,
      updatedAt: new Date().toISOString(),
    };

    const setting = await prisma.systemSetting.upsert({
      where: { key: BUDGET_KEY },
      create: {
        key: BUDGET_KEY,
        value: JSON.stringify(config),
        category: 'FINANCE',
        description: '가계부 월간 및 카테고리별 목표 예산 설정',
        updatedBy: admin.id,
      },
      update: {
        value: JSON.stringify(config),
        updatedBy: admin.id,
      },
    });

    return NextResponse.json({
      success: true,
      budget: JSON.parse(setting.value),
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/budget POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '예산 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
