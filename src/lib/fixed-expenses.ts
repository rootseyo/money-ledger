export type FixedExpenseCycle = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'DAILY';

export interface FixedExpenseItem {
  id: string;
  name: string; // 항목명 (예: 넷플릭스, 월세, 통신비, 관리비 등)
  amount: number; // 1회 결제 금액
  category: string; // 대분류
  subCategory?: string; // 소분류
  paymentMethod: string; // 결제 수단
  cycle: FixedExpenseCycle; // 반복 주기
  payDay: string; // 결제일: '1'~'31' 또는 'LAST_DAY'(말일/마지막날)
  startDate: string; // 시작일 (YYYY-MM-DD)
  endDate?: string | null; // 종료일 (YYYY-MM-DD or null: 무기한)
  isAutoPay: boolean; // 자동이체 여부
  isActive: boolean; // 활성 여부 (true: 활성, false: 일시중단)
  memo?: string; // 메모
  merchantKeyword?: string; // 과거 거래 내역 자동 매칭 키워드
  createdAt: string;
  updatedAt: string;
}

export interface FixedExpenseHistoryItem {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  content: string;
  sourceApp: string;
  cardOrAccount?: string | null;
}

export interface FixedExpenseWithStats extends FixedExpenseItem {
  totalPaidAmount: number; // 총 누적 결제액 ("이 고정 비용은 총 얼마")
  paidCount: number; // 결제 횟수
  lastPaidAt: string | null; // 최근 결제일
  monthlyNormalizedAmount: number; // 월 환산액
  history: FixedExpenseHistoryItem[]; // 과거 결제 이력
}

export const FIXED_EXPENSES_SETTING_KEY = 'household_fixed_expenses';

/**
 * 기본 예시 고정비용 목록 (최초 설정 시 제공)
 */
export const DEFAULT_FIXED_EXPENSES: FixedExpenseItem[] = [
  {
    id: 'fe-netflix',
    name: '넷플릭스 정기결제',
    amount: 17000,
    category: '문화/여가',
    subCategory: '구독',
    paymentMethod: '우리카드',
    cycle: 'MONTHLY',
    payDay: 'LAST_DAY',
    startDate: '2025-01-01',
    endDate: null,
    isAutoPay: true,
    isActive: true,
    memo: '프리미엄 4K 멤버십',
    merchantKeyword: '넷플릭스',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fe-telecom',
    name: '휴대폰 통신비',
    amount: 65000,
    category: '주거/통신',
    subCategory: '통신',
    paymentMethod: '우리WON',
    cycle: 'MONTHLY',
    payDay: '15',
    startDate: '2025-01-01',
    endDate: null,
    isAutoPay: true,
    isActive: true,
    memo: 'KT 5G 무제한 요금제',
    merchantKeyword: 'KT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fe-rent',
    name: '주택 월세',
    amount: 500000,
    category: '주거/통신',
    subCategory: '월세',
    paymentMethod: '우리WON',
    cycle: 'MONTHLY',
    payDay: '25',
    startDate: '2025-01-01',
    endDate: null,
    isAutoPay: true,
    isActive: true,
    memo: '매달 25일 자동송금',
    merchantKeyword: '월세',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 반복 주기에 따른 월 환산 금액 계산
 */
export function calculateMonthlyNormalizedAmount(amount: number, cycle: FixedExpenseCycle): number {
  if (!amount || amount <= 0) return 0;
  switch (cycle) {
    case 'MONTHLY':
      return amount;
    case 'YEARLY':
      return Math.round(amount / 12);
    case 'WEEKLY':
      return Math.round((amount * 52) / 12);
    case 'DAILY':
      return Math.round(amount * 30.4);
    default:
      return amount;
  }
}

/**
 * 결제일 라벨 포맷 (예: '매달 1일', '매달 말일(마지막날)')
 */
export function formatPayDayLabel(payDay: string, cycle: FixedExpenseCycle): string {
  if (cycle === 'DAILY') return '매일';
  if (cycle === 'WEEKLY') return '매주';
  if (cycle === 'YEARLY') {
    return payDay === 'LAST_DAY' ? '매년 말일' : `매년 ${payDay}일`;
  }
  if (payDay === 'LAST_DAY') return '매달 말일(마지막날)';
  return `매달 ${payDay}일`;
}

/**
 * 결제 주기 한글 라벨
 */
export function formatCycleLabel(cycle: FixedExpenseCycle): string {
  switch (cycle) {
    case 'MONTHLY':
      return '매월(월간)';
    case 'YEARLY':
      return '매년(연간)';
    case 'WEEKLY':
      return '매주(주간)';
    case 'DAILY':
      return '매일(일간)';
    default:
      return cycle;
  }
}
