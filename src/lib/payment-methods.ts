export interface HouseholdPaymentMethod {
  id: string; // Unique identifier used in CardTransaction.sourceApp (e.g., 'WOORI_CARD', 'CASH', 'SHINHAN_CARD')
  name: string; // Display label (e.g., '우리카드', '현금', '신한카드')
  emoji?: string; // Icon emoji (e.g., '💳', '💵', '🏦')
  color?: string; // Theme color (e.g., '#2563eb')
  desc?: string; // Optional description/memo
  isDefault?: boolean; // Whether it is a system default
}

export const PAYMENT_METHODS_SETTING_KEY = 'household_payment_methods';

export const DEFAULT_PAYMENT_METHODS: HouseholdPaymentMethod[] = [
  { id: 'WOORI_CARD', name: '우리카드', emoji: '💳', color: '#2563eb', desc: '우리카드 신용/체크', isDefault: true },
  { id: 'WOORI_WON', name: '우리WON', emoji: '🏦', color: '#0284c7', desc: '우리은행 입출금', isDefault: true },
  { id: 'KAKAO_PAY', name: '카카오페이', emoji: '💛', color: '#eab308', desc: '카카오페이 머니/카드', isDefault: true },
  { id: 'KAKAO_BANK', name: '카카오뱅크', emoji: '🦁', color: '#f59e0b', desc: '카카오뱅크 통장/카드', isDefault: true },
  { id: 'TOSS_BANK', name: '토스뱅크', emoji: '💙', color: '#3b82f6', desc: '토스뱅크 통장/카드', isDefault: true },
  { id: 'SMS', name: 'SMS', emoji: '📱', color: '#64748b', desc: '문자(SMS) 알림 내역', isDefault: true },
  { id: 'MANUAL', name: '직접입력', emoji: '✍️', color: '#10b981', desc: '직접 수기 등록', isDefault: true },
];

/**
 * Normalizes an ID for a payment method.
 * Converts alphanumeric/Korean/dash/underscore safely to uppercase standard string.
 */
export function normalizePaymentMethodId(id: string): string {
  const clean = (id || '').trim();
  if (!clean) return `PM_${Date.now()}`;
  return clean.toUpperCase().replace(/\s+/g, '_');
}

/**
 * Resolves a payment method from an ID or name.
 */
export function resolvePaymentMethod(
  idOrName: string | null | undefined,
  methods: HouseholdPaymentMethod[] = DEFAULT_PAYMENT_METHODS
): HouseholdPaymentMethod {
  if (!idOrName) {
    return { id: 'MANUAL', name: '직접입력', emoji: '✍️', color: '#10b981', desc: '직접 등록' };
  }
  const clean = idOrName.trim();
  const matched = methods.find(
    (m) => m.id.toLowerCase() === clean.toLowerCase() || m.name.toLowerCase() === clean.toLowerCase()
  );
  if (matched) return matched;

  return {
    id: clean,
    name: clean,
    emoji: '💳',
    color: '#64748b',
    desc: '기타/사용자 정의',
  };
}
