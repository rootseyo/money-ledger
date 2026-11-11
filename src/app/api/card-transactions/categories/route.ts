import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import {
  getHouseholdCategories,
  saveHouseholdCategories,
  resetHouseholdCategories,
} from '@/lib/household-categories-server';
import {
  type CategoryType,
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
} from '@/lib/household-categories';

async function handleGET() {
  try {
    const { categories, isDefault } = await getHouseholdCategories();
    const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
    const incomeCategories = categories.filter((c) => c.type === 'INCOME');

    return NextResponse.json({
      success: true,
      categories,
      expenseCategories,
      incomeCategories,
      isDefault,
      totalCount: categories.length,
      expenseCount: expenseCategories.length,
      incomeCount: incomeCategories.length,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/categories GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '카테고리 목록을 불러오는 중 오류가 발생했습니다.' },
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
    const { action } = body;

    // 1. 기본값으로 초기화
    if (action === 'reset') {
      const resetList = await resetHouseholdCategories(admin.id);
      return NextResponse.json({
        success: true,
        message: '기본 카테고리로 초기화되었습니다. (비용 22개, 수입 8개)',
        categories: resetList,
      });
    }

    // 2. 전체 카테고리 목록 직접 저장
    if (action === 'save' || Array.isArray(body.categories)) {
      const inputCategories = body.categories as HouseholdCategory[];
      if (!Array.isArray(inputCategories) || inputCategories.length === 0) {
        return NextResponse.json({ error: '유효한 카테고리 배열이 필요합니다.' }, { status: 400 });
      }

      // 간단한 데이터 정제
      const cleaned: HouseholdCategory[] = inputCategories.map((c, idx) => ({
        id: (c.id || `CAT_${Date.now()}_${idx}`).trim().toUpperCase(),
        name: (c.name || '미분류').trim(),
        type: (['EXPENSE', 'INCOME', 'SAVINGS', 'TRANSFER'].includes(c.type) ? c.type : 'EXPENSE') as CategoryType,
        emoji: (c.emoji || '🏷️').trim(),
        color: (c.color || '#9e9e9e').trim(),
        subcategories: Array.isArray(c.subcategories)
          ? Array.from(new Set(c.subcategories.map((s) => String(s).trim()).filter(Boolean)))
          : [],
      }));

      const saved = await saveHouseholdCategories(cleaned, admin.id);
      return NextResponse.json({
        success: true,
        message: '카테고리가 저장되었습니다.',
        categories: saved,
      });
    }

    // 3. 개별 대분류 추가
    if (action === 'add') {
      const { name, type, emoji, color, subcategories } = body.category || {};
      if (!name || !name.trim()) {
        return NextResponse.json({ error: '대분류 이름을 입력해주세요.' }, { status: 400 });
      }

      const { categories } = await getHouseholdCategories();
      const newId = `CAT_${Date.now()}`;
      const newCategory: HouseholdCategory = {
        id: newId,
        name: name.trim(),
        type: (['EXPENSE', 'INCOME', 'SAVINGS', 'TRANSFER'].includes(type) ? type : 'EXPENSE') as CategoryType,
        emoji: emoji?.trim() || '🏷️',
        color: color?.trim() || '#3b82f6',
        subcategories: Array.isArray(subcategories)
          ? Array.from(new Set(subcategories.map((s: string) => String(s).trim()).filter(Boolean)))
          : [],
      };

      const updatedList = [...categories, newCategory];
      await saveHouseholdCategories(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${newCategory.name}' 대분류가 추가되었습니다.`,
        category: newCategory,
        categories: updatedList,
      });
    }

    // 4. 개별 대분류 수정
    if (action === 'update') {
      const { id, name, emoji, color, subcategories, type } = body.category || {};
      if (!id) {
        return NextResponse.json({ error: '카테고리 ID가 필요합니다.' }, { status: 400 });
      }

      const { categories } = await getHouseholdCategories();
      const targetIndex = categories.findIndex((c) => c.id === id);
      if (targetIndex === -1) {
        return NextResponse.json({ error: '존재하지 않는 카테고리입니다.' }, { status: 404 });
      }

      const current = categories[targetIndex];
      const updatedCategory: HouseholdCategory = {
        ...current,
        name: name !== undefined ? name.trim() : current.name,
        type: type !== undefined ? ((['EXPENSE', 'INCOME', 'SAVINGS', 'TRANSFER'].includes(type) ? type : 'EXPENSE') as CategoryType) : current.type,
        emoji: emoji !== undefined ? emoji.trim() : current.emoji,
        color: color !== undefined ? color.trim() : current.color,
        subcategories: Array.isArray(subcategories)
          ? Array.from(new Set(subcategories.map((s: string) => String(s).trim()).filter(Boolean)))
          : current.subcategories,
      };

      const updatedList = [...categories];
      updatedList[targetIndex] = updatedCategory;
      await saveHouseholdCategories(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${updatedCategory.name}' 카테고리가 수정되었습니다.`,
        category: updatedCategory,
        categories: updatedList,
      });
    }

    // 5. 대분류 삭제
    if (action === 'delete') {
      const { categoryId } = body;
      if (!categoryId) {
        return NextResponse.json({ error: '삭제할 카테고리 ID가 필요합니다.' }, { status: 400 });
      }

      const { categories } = await getHouseholdCategories();
      const updatedList = categories.filter((c) => c.id !== categoryId);
      await saveHouseholdCategories(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: '카테고리가 삭제되었습니다.',
        categories: updatedList,
      });
    }

    // 6. 소분류 추가
    if (action === 'addSubcategory') {
      const { categoryId, subcategory } = body;
      const subClean = subcategory?.trim();
      if (!categoryId || !subClean) {
        return NextResponse.json({ error: '카테고리 ID와 소분류명을 입력해주세요.' }, { status: 400 });
      }

      const { categories } = await getHouseholdCategories();
      const target = categories.find((c) => c.id === categoryId);
      if (!target) {
        return NextResponse.json({ error: '해당 카테고리를 찾을 수 없습니다.' }, { status: 404 });
      }

      if (target.subcategories.includes(subClean)) {
        return NextResponse.json({ error: '이미 존재하는 소분류입니다.' }, { status: 400 });
      }

      const updatedList = categories.map((c) =>
        c.id === categoryId ? { ...c, subcategories: [...c.subcategories, subClean] } : c
      );
      await saveHouseholdCategories(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${subClean}' 소분류가 추가되었습니다.`,
        categories: updatedList,
      });
    }

    // 7. 소분류 삭제
    if (action === 'deleteSubcategory') {
      const { categoryId, subcategory } = body;
      if (!categoryId || !subcategory) {
        return NextResponse.json({ error: '카테고리 ID와 소분류명이 필요합니다.' }, { status: 400 });
      }

      const { categories } = await getHouseholdCategories();
      const updatedList = categories.map((c) =>
        c.id === categoryId ? { ...c, subcategories: c.subcategories.filter((s) => s !== subcategory) } : c
      );
      await saveHouseholdCategories(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${subcategory}' 소분류가 삭제되었습니다.`,
        categories: updatedList,
      });
    }

    return NextResponse.json({ error: '지원하지 않는 액션입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/card-transactions/categories POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '카테고리 변경 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
