import { dataScope } from './data-scope';
import { prisma } from './db';
import {
  FINANCIAL_ASSETS_KEY,
  DEFAULT_FINANCIAL_DATA,
  FinancialData,
  calculateFinancialSummary,
  FinancialSummary,
} from './financial-assets';

/**
 * DB(SystemSetting)에서 자산/계좌/카드/투자 데이터 조회 (Server-only)
 */
export async function getFinancialAssets(): Promise<{
  data: FinancialData;
  summary: FinancialSummary;
  isDefault: boolean;
}> {
  const defaultData = dataScope.getStore()?.role === 'OWNER' ? DEFAULT_FINANCIAL_DATA : { cards: [], accounts: [], savings: [], investments: [], liabilities: [], realEstates: [], updatedAt: new Date().toISOString() };
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: FINANCIAL_ASSETS_KEY },
    });

    if (!setting) {
      return {
        data: defaultData,
        summary: calculateFinancialSummary(defaultData),
        isDefault: true,
      };
    }

    const parsed = JSON.parse(setting.value) as FinancialData;
    if (parsed && typeof parsed === 'object') {
      const merged: FinancialData = {
        cards: Array.isArray(parsed.cards) ? parsed.cards : defaultData.cards,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : defaultData.accounts,
        savings: Array.isArray(parsed.savings) ? parsed.savings : defaultData.savings,
        investments: Array.isArray(parsed.investments) ? parsed.investments : defaultData.investments,
        liabilities: Array.isArray(parsed.liabilities) ? parsed.liabilities : defaultData.liabilities,
        realEstates: Array.isArray(parsed.realEstates) ? parsed.realEstates : [],
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
      return {
        data: merged,
        summary: calculateFinancialSummary(merged),
        isDefault: false,
      };
    }

    return {
      data: defaultData,
      summary: calculateFinancialSummary(defaultData),
      isDefault: true,
    };
  } catch (error) {
    console.error('Failed to load financial assets from DB:', error);
    return {
      data: defaultData,
      summary: calculateFinancialSummary(defaultData),
      isDefault: true,
    };
  }
}

/**
 * 자산/계좌/카드/투자 데이터 저장 (Server-only)
 */
export async function saveFinancialAssets(
  data: FinancialData,
  updatedBy?: string
): Promise<{
  data: FinancialData;
  summary: FinancialSummary;
}> {
  const updatedData: FinancialData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: FINANCIAL_ASSETS_KEY },
    create: {
      key: FINANCIAL_ASSETS_KEY,
      value: JSON.stringify(updatedData),
      category: 'FINANCE',
      description: '카드, 통장, 예적금, 주식/투자 등 자산 관리 설정 데이터',
      updatedBy: updatedBy || 'admin',
    },
    update: {
      value: JSON.stringify(updatedData),
      updatedBy: updatedBy || 'admin',
      updatedAt: new Date(),
    },
  });

  return {
    data: updatedData,
    summary: calculateFinancialSummary(updatedData),
  };
}
