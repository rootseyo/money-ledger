import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAYMENT_METHODS,
  normalizePaymentMethodId,
  resolvePaymentMethod,
  HouseholdPaymentMethod,
} from '../src/lib/payment-methods';

describe('Payment Methods Model and Helpers', () => {
  it('DEFAULT_PAYMENT_METHODS contains standard financial and payment options', () => {
    assert.ok(DEFAULT_PAYMENT_METHODS.length >= 7);
    const ids = DEFAULT_PAYMENT_METHODS.map((m) => m.id);
    assert.ok(ids.includes('WOORI_CARD'));
    assert.ok(ids.includes('WOORI_WON'));
    assert.ok(ids.includes('KAKAO_PAY'));
    assert.ok(ids.includes('KAKAO_BANK'));
    assert.ok(ids.includes('TOSS_BANK'));
    assert.ok(ids.includes('SMS'));
    assert.ok(ids.includes('MANUAL'));
  });

  it('normalizePaymentMethodId trims and normalizes to uppercase without spaces', () => {
    assert.equal(normalizePaymentMethodId('shinhan card'), 'SHINHAN_CARD');
    assert.equal(normalizePaymentMethodId('  kb_card  '), 'KB_CARD');
    assert.equal(normalizePaymentMethodId('현금'), '현금');
    assert.ok(normalizePaymentMethodId('').startsWith('PM_'));
  });

  it('resolvePaymentMethod resolves known payment methods by ID or name', () => {
    const customMethods: HouseholdPaymentMethod[] = [
      ...DEFAULT_PAYMENT_METHODS,
      { id: 'SHINHAN_CARD', name: '신한카드', emoji: '💳', color: '#0046ff' },
      { id: 'CASH', name: '현금', emoji: '💵', color: '#10b981' },
    ];

    const resolvedById = resolvePaymentMethod('WOORI_CARD', customMethods);
    assert.equal(resolvedById.name, '우리카드');

    const resolvedByName = resolvePaymentMethod('신한카드', customMethods);
    assert.equal(resolvedByName.id, 'SHINHAN_CARD');

    const resolvedCaseInsensitive = resolvePaymentMethod('woori_card', customMethods);
    assert.equal(resolvedCaseInsensitive.name, '우리카드');

    const resolvedUnknown = resolvePaymentMethod('국민카드', customMethods);
    assert.equal(resolvedUnknown.id, '국민카드');
    assert.equal(resolvedUnknown.name, '국민카드');

    const resolvedEmpty = resolvePaymentMethod('', customMethods);
    assert.equal(resolvedEmpty.id, 'MANUAL');
    assert.equal(resolvedEmpty.name, '직접입력');
  });
});
