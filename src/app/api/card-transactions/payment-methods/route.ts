import { withLedgerScope } from '@/lib/ledger-scope';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import {
  getHouseholdPaymentMethods,
  saveHouseholdPaymentMethods,
  resetHouseholdPaymentMethods,
} from '@/lib/payment-methods-server';
import {
  HouseholdPaymentMethod,
  DEFAULT_PAYMENT_METHODS,
  normalizePaymentMethodId,
} from '@/lib/payment-methods';

async function handleGET() {
  try {
    const { paymentMethods, isDefault } = await getHouseholdPaymentMethods();

    return NextResponse.json({
      success: true,
      paymentMethods,
      isDefault,
      totalCount: paymentMethods.length,
    });
  } catch (error: any) {
    console.error('[API /api/card-transactions/payment-methods GET] Error:', error);
    return NextResponse.json(
      { error: error?.message || '결제/금융 수단 목록을 불러오는 중 오류가 발생했습니다.' },
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

    // 1. 기본값으로 복원
    if (action === 'reset') {
      const resetList = await resetHouseholdPaymentMethods(admin.id);
      return NextResponse.json({
        success: true,
        message: '기본 결제/금융 수단으로 초기화되었습니다.',
        paymentMethods: resetList,
      });
    }

    // 2. 전체 목록 일괄 저장
    if (action === 'save' || Array.isArray(body.paymentMethods)) {
      const inputMethods = body.paymentMethods as HouseholdPaymentMethod[];
      if (!Array.isArray(inputMethods) || inputMethods.length === 0) {
        return NextResponse.json({ error: '유효한 결제/금융 수단 배열이 필요합니다.' }, { status: 400 });
      }

      const cleaned = inputMethods.map((m, idx) => ({
        id: normalizePaymentMethodId(m.id || `PM_${Date.now()}_${idx}`),
        name: (m.name || '미지정').trim(),
        emoji: (m.emoji || '💳').trim(),
        color: (m.color || '#3b82f6').trim(),
        desc: (m.desc || '').trim(),
        isDefault: Boolean(m.isDefault),
      }));

      const saved = await saveHouseholdPaymentMethods(cleaned, admin.id);
      return NextResponse.json({
        success: true,
        message: '결제/금융 수단이 저장되었습니다.',
        paymentMethods: saved,
      });
    }

    // 3. 개별 결제/금융 수단 추가
    if (action === 'add') {
      const { id, name, emoji, color, desc } = body.paymentMethod || {};
      const cleanName = (name || '').trim();
      if (!cleanName) {
        return NextResponse.json({ error: '결제/금융 수단 이름을 입력해주세요.' }, { status: 400 });
      }

      const { paymentMethods } = await getHouseholdPaymentMethods();
      const generatedId = id && id.trim() ? normalizePaymentMethodId(id) : normalizePaymentMethodId(cleanName);

      if (paymentMethods.some((m) => m.id.toLowerCase() === generatedId.toLowerCase())) {
        return NextResponse.json({ error: `이미 동일한 ID('${generatedId}')의 수단이 존재합니다.` }, { status: 400 });
      }

      const newMethod: HouseholdPaymentMethod = {
        id: generatedId,
        name: cleanName,
        emoji: (emoji || '💳').trim(),
        color: (color || '#3b82f6').trim(),
        desc: (desc || '').trim(),
        isDefault: false,
      };

      const updatedList = [...paymentMethods, newMethod];
      await saveHouseholdPaymentMethods(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${newMethod.name}' 결제/금융 수단이 추가되었습니다.`,
        paymentMethod: newMethod,
        paymentMethods: updatedList,
      });
    }

    // 4. 개별 결제/금융 수단 수정
    if (action === 'update') {
      const { id, name, emoji, color, desc } = body.paymentMethod || {};
      if (!id) {
        return NextResponse.json({ error: '수정할 수단 ID가 필요합니다.' }, { status: 400 });
      }

      const { paymentMethods } = await getHouseholdPaymentMethods();
      const targetIndex = paymentMethods.findIndex((m) => m.id.toLowerCase() === id.toLowerCase());
      if (targetIndex === -1) {
        return NextResponse.json({ error: '존재하지 않는 결제/금융 수단입니다.' }, { status: 404 });
      }

      const current = paymentMethods[targetIndex];
      const updatedMethod: HouseholdPaymentMethod = {
        ...current,
        name: name !== undefined ? (name || '').trim() : current.name,
        emoji: emoji !== undefined ? (emoji || '💳').trim() : current.emoji,
        color: color !== undefined ? (color || '#3b82f6').trim() : current.color,
        desc: desc !== undefined ? (desc || '').trim() : current.desc,
      };

      const updatedList = [...paymentMethods];
      updatedList[targetIndex] = updatedMethod;
      await saveHouseholdPaymentMethods(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: `'${updatedMethod.name}' 결제/금융 수단이 수정되었습니다.`,
        paymentMethod: updatedMethod,
        paymentMethods: updatedList,
      });
    }

    // 5. 개별 결제/금융 수단 삭제
    if (action === 'delete') {
      const { id } = body;
      if (!id) {
        return NextResponse.json({ error: '삭제할 결제/금융 수단 ID가 필요합니다.' }, { status: 400 });
      }

      const { paymentMethods } = await getHouseholdPaymentMethods();
      const updatedList = paymentMethods.filter((m) => m.id.toLowerCase() !== id.toLowerCase());
      await saveHouseholdPaymentMethods(updatedList, admin.id);

      return NextResponse.json({
        success: true,
        message: '결제/금융 수단이 삭제되었습니다.',
        paymentMethods: updatedList,
      });
    }

    return NextResponse.json({ error: '지원하지 않는 액션입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('[API /api/card-transactions/payment-methods POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || '결제/금융 수단 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export const GET = withLedgerScope(handleGET);
export const POST = withLedgerScope(handlePOST);
