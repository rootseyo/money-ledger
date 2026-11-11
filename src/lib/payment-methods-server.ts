import { prisma } from './db';
import {
  PAYMENT_METHODS_SETTING_KEY,
  DEFAULT_PAYMENT_METHODS,
  HouseholdPaymentMethod,
} from './payment-methods';

/**
 * DB(SystemSetting)에서 설정된 결제/금융 수단 목록 조회 (Server-only)
 */
export async function getHouseholdPaymentMethods(): Promise<{
  paymentMethods: HouseholdPaymentMethod[];
  isDefault: boolean;
}> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: PAYMENT_METHODS_SETTING_KEY },
    });

    if (!setting) {
      return {
        paymentMethods: DEFAULT_PAYMENT_METHODS,
        isDefault: true,
      };
    }

    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        paymentMethods: parsed,
        isDefault: false,
      };
    }

    return {
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      isDefault: true,
    };
  } catch (error) {
    console.error('Failed to load household payment methods from DB:', error);
    return {
      paymentMethods: DEFAULT_PAYMENT_METHODS,
      isDefault: true,
    };
  }
}

/**
 * 결제/금융 수단 목록 저장 (Server-only)
 */
export async function saveHouseholdPaymentMethods(
  paymentMethods: HouseholdPaymentMethod[],
  updatedBy?: string
): Promise<HouseholdPaymentMethod[]> {
  await prisma.systemSetting.upsert({
    where: { key: PAYMENT_METHODS_SETTING_KEY },
    create: {
      key: PAYMENT_METHODS_SETTING_KEY,
      value: JSON.stringify(paymentMethods),
      category: 'FINANCE',
      description: '가계부 거래 내역 장부 결제/금융 수단 항목 설정',
      updatedBy: updatedBy || null,
    },
    update: {
      value: JSON.stringify(paymentMethods),
      updatedBy: updatedBy || null,
    },
  });

  return paymentMethods;
}

/**
 * 기본 결제/금융 수단으로 초기화 (Server-only)
 */
export async function resetHouseholdPaymentMethods(
  updatedBy?: string
): Promise<HouseholdPaymentMethod[]> {
  return saveHouseholdPaymentMethods(DEFAULT_PAYMENT_METHODS, updatedBy);
}
