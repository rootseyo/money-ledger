import { prisma } from './db';
import {
  CATEGORIES_SETTING_KEY,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  HouseholdCategory,
} from './household-categories';

/**
 * DB(SystemSetting)에서 설정된 카테고리 목록 조회 (Server-only)
 */
export async function getHouseholdCategories(): Promise<{
  categories: HouseholdCategory[];
  isDefault: boolean;
}> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: CATEGORIES_SETTING_KEY },
    });

    if (!setting) {
      return {
        categories: DEFAULT_HOUSEHOLD_CATEGORIES,
        isDefault: true,
      };
    }

    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return {
        categories: parsed,
        isDefault: false,
      };
    }

    return {
      categories: DEFAULT_HOUSEHOLD_CATEGORIES,
      isDefault: true,
    };
  } catch (error) {
    console.error('Failed to load household categories from DB:', error);
    return {
      categories: DEFAULT_HOUSEHOLD_CATEGORIES,
      isDefault: true,
    };
  }
}

/**
 * 카테고리 설정 저장 (Server-only)
 */
export async function saveHouseholdCategories(
  categories: HouseholdCategory[],
  updatedBy?: string
): Promise<HouseholdCategory[]> {
  await prisma.systemSetting.upsert({
    where: { key: CATEGORIES_SETTING_KEY },
    create: {
      key: CATEGORIES_SETTING_KEY,
      value: JSON.stringify(categories),
      category: 'FINANCE',
      description: '가계부 비용(지출) 22종 및 수입 8종 대분류·소분류 카테고리 설정',
      updatedBy: updatedBy || null,
    },
    update: {
      value: JSON.stringify(categories),
      updatedBy: updatedBy || null,
    },
  });

  return categories;
}

/**
 * 기본 카테고리로 초기화 (Server-only)
 */
export async function resetHouseholdCategories(updatedBy?: string): Promise<HouseholdCategory[]> {
  return saveHouseholdCategories(DEFAULT_HOUSEHOLD_CATEGORIES, updatedBy);
}
