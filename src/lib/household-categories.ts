export type CategoryType = 'EXPENSE' | 'INCOME' | 'SAVINGS' | 'TRANSFER';

export interface HouseholdCategory {
  id: string;
  name: string;
  type: CategoryType;
  emoji: string;
  color: string;
  subcategories: string[];
}

export const CATEGORIES_SETTING_KEY = 'household_categories';

/**
 * 22종 비용(지출) 대분류 및 소분류 기본 데이터셋
 */
export const DEFAULT_EXPENSE_CATEGORIES: HouseholdCategory[] = [
  {
    id: 'HOUSING',
    name: '주거비',
    type: 'EXPENSE',
    emoji: '🏠',
    color: '#26a69a',
    subcategories: ['관리비', '월세/대출이자', '전기', '가스', '수도'],
  },
  {
    id: 'FOOD',
    name: '식비',
    type: 'EXPENSE',
    emoji: '🍚',
    color: '#ff9800',
    subcategories: ['장보기', '외식', '배달', '카페/간식'],
  },
  {
    id: 'DAILY_SUPPLIES',
    name: '생활용품',
    type: 'EXPENSE',
    emoji: '🧼',
    color: '#8bc34a',
    subcategories: ['생필품', '주방용품', '세제', '잡화'],
  },
  {
    id: 'TRANS',
    name: '교통비',
    type: 'EXPENSE',
    emoji: '🚗',
    color: '#42a5f5',
    subcategories: ['주유', '대중교통', '택시', '주차', '통행료'],
  },
  {
    id: 'VEHICLE',
    name: '차량비',
    type: 'EXPENSE',
    emoji: '🚘',
    color: '#3b82f6',
    subcategories: ['자동차보험', '정비', '세차', '자동차세'],
  },
  {
    id: 'COMMUNICATION',
    name: '통신비',
    type: 'EXPENSE',
    emoji: '📱',
    color: '#06b6d4',
    subcategories: ['휴대폰', '인터넷', '구독형 통신서비스'],
  },
  {
    id: 'EDUCATION',
    name: '교육비',
    type: 'EXPENSE',
    emoji: '📚',
    color: '#8b5cf6',
    subcategories: ['학원', '교재', '학교비', '방과후'],
  },
  {
    id: 'ARTS_SPORTS',
    name: '예체능비',
    type: 'EXPENSE',
    emoji: '🎹',
    color: '#a855f7',
    subcategories: ['피아노', '바이올린', '수영', '레슨', '콩쿠르'],
  },
  {
    id: 'EXAM_PREP',
    name: '입시/특별교육비',
    type: 'EXPENSE',
    emoji: '🎓',
    color: '#d946ef',
    subcategories: ['예중 준비', '특별레슨', '원서비', '시험비', '출장비'],
  },
  {
    id: 'HEALTH',
    name: '의료/건강',
    type: 'EXPENSE',
    emoji: '💊',
    color: '#ef5350',
    subcategories: ['병원', '약국', '치과', '검진', '운동'],
  },
  {
    id: 'SOCIAL_INSURANCE',
    name: '사회보험',
    type: 'EXPENSE',
    emoji: '🛡️',
    color: '#0d9488',
    subcategories: ['국민건강보험', '장기요양보험', '국민연금'],
  },
  {
    id: 'PRIVATE_INSURANCE',
    name: '민간보험',
    type: 'EXPENSE',
    emoji: '📄',
    color: '#14b8a6',
    subcategories: ['실손', '생명보험', '어린이보험 등'],
  },
  {
    id: 'BEAUTY_FASHION',
    name: '의류/미용',
    type: 'EXPENSE',
    emoji: '👗',
    color: '#ec4899',
    subcategories: ['옷', '신발', '미용실', '화장품'],
  },
  {
    id: 'CULTURE',
    name: '문화/여가',
    type: 'EXPENSE',
    emoji: '🎬',
    color: '#ec407a',
    subcategories: ['영화', '공연', '취미', '가족 나들이'],
  },
  {
    id: 'TRAVEL',
    name: '여행비',
    type: 'EXPENSE',
    emoji: '✈️',
    color: '#0284c7',
    subcategories: ['숙박', '항공', '교통', '관광', '여행식비'],
  },
  {
    id: 'GIFT_EVENT',
    name: '경조사/선물',
    type: 'EXPENSE',
    emoji: '🎁',
    color: '#f43f5e',
    subcategories: ['경조사비', '생일', '명절', '선물'],
  },
  {
    id: 'PET',
    name: '반려동물',
    type: 'EXPENSE',
    emoji: '🐾',
    color: '#fb923c',
    subcategories: ['사료', '간식', '병원', '용품'],
  },
  {
    id: 'SUBSCRIPTION',
    name: '구독서비스',
    type: 'EXPENSE',
    emoji: '📺',
    color: '#6366f1',
    subcategories: ['OTT', '앱', '클라우드', '소프트웨어'],
  },
  {
    id: 'TAX',
    name: '세금',
    type: 'EXPENSE',
    emoji: '🧾',
    color: '#64748b',
    subcategories: ['소득세', '부가세', '지방세', '재산세 등'],
  },
  {
    id: 'BUSINESS',
    name: '사업 관련 지출',
    type: 'EXPENSE',
    emoji: '💼',
    color: '#475569',
    subcategories: ['업무용 소프트웨어', '장비', '교통', '접대 등'],
  },
  {
    id: 'IRREGULAR',
    name: '비정기지출',
    type: 'EXPENSE',
    emoji: '🛋️',
    color: '#78716c',
    subcategories: ['가전', '가구', '수리', '큰 구매'],
  },
  {
    id: 'ALLOWANCE',
    name: '용돈',
    type: 'EXPENSE',
    emoji: '🪙',
    color: '#fbbf24',
    subcategories: ['자녀용돈', '배우자용돈', '개인용돈', '부모님용돈'],
  },
  {
    id: 'OTHER',
    name: '기타',
    type: 'EXPENSE',
    emoji: '🏷️',
    color: '#9e9e9e',
    subcategories: ['어느 항목에도 명확히 안 들어가는 비용'],
  },
];

/**
 * 수입 대분류 및 소분류 기본 데이터셋
 */
export const DEFAULT_INCOME_CATEGORIES: HouseholdCategory[] = [
  {
    id: 'SALARY',
    name: '근로소득',
    type: 'INCOME',
    emoji: '💰',
    color: '#10b981',
    subcategories: ['급여', '상여', '성과급', '월급'],
  },
  {
    id: 'BUSINESS_INCOME',
    name: '사업소득',
    type: 'INCOME',
    emoji: '💼',
    color: '#059669',
    subcategories: ['용역매출', '프리랜서 수입', '기타 사업매출'],
  },
  {
    id: 'FINANCIAL_INCOME',
    name: '금융소득',
    type: 'INCOME',
    emoji: '📈',
    color: '#3b82f6',
    subcategories: ['예금이자', '배당금'],
  },
  {
    id: 'INVESTMENT_PROFIT',
    name: '투자수익',
    type: 'INCOME',
    emoji: '📊',
    color: '#6366f1',
    subcategories: ['주식 매도차익', '펀드 수익', '가상자산 수익'],
  },
  {
    id: 'PUBLIC_ALLOWANCE',
    name: '공적급여/지원금',
    type: 'INCOME',
    emoji: '🏛️',
    color: '#8b5cf6',
    subcategories: ['실업급여', '아동수당', '정부지원금', '장려금'],
  },
  {
    id: 'REFUND',
    name: '환급금',
    type: 'INCOME',
    emoji: '💳',
    color: '#06b6d4',
    subcategories: ['세금환급', '보험금', '카드 캐시백'],
  },
  {
    id: 'SECONDHAND_OTHER',
    name: '중고판매/기타수입',
    type: 'INCOME',
    emoji: '📦',
    color: '#14b8a6',
    subcategories: ['중고거래', '이벤트 당첨금', '기타 일회성 수입', '부수입'],
  },
  {
    id: 'FAMILY_SUPPORT',
    name: '가족간 수입',
    type: 'INCOME',
    emoji: '👨‍👩‍👧',
    color: '#ec4899',
    subcategories: ['용돈 받음', '부모님 지원금 등'],
  },
  {
    id: 'INCOME',
    name: '수입',
    type: 'INCOME',
    emoji: '💰',
    color: '#10b981',
    subcategories: ['월급', '부수입', '급여', '상여', '기타수입'],
  },
];

export const DEFAULT_SAVINGS_CATEGORIES: HouseholdCategory[] = [
  {
    id: 'SAVINGS',
    name: '저축',
    type: 'SAVINGS',
    emoji: '🌱',
    color: '#10b981',
    subcategories: ['예금', '적금', '주택청약', '비상금', '세이프박스', '기타저축'],
  },
  {
    id: 'INVESTMENT',
    name: '투자/자산증식',
    type: 'SAVINGS',
    emoji: '📈',
    color: '#6366f1',
    subcategories: ['주식', '펀드', 'ETF', '연금저축', 'IRP', 'ISA'],
  },
];

export const DEFAULT_TRANSFER_CATEGORIES: HouseholdCategory[] = [
  {
    id: 'TRANSFER',
    name: '이체/송금',
    type: 'TRANSFER',
    emoji: '💸',
    color: '#06b6d4',
    subcategories: ['카드대금', '카드값', '통장간이체', '송금', '현금인출'],
  },
];

export const DEFAULT_HOUSEHOLD_CATEGORIES: HouseholdCategory[] = [
  ...DEFAULT_EXPENSE_CATEGORIES,
  ...DEFAULT_INCOME_CATEGORIES,
  ...DEFAULT_SAVINGS_CATEGORIES,
  ...DEFAULT_TRANSFER_CATEGORIES,
];

/**
 * 기존 레거시 코드 및 다양한 입력값 매핑 맵
 */
const LEGACY_CODE_MAP: Record<string, { name: string; emoji: string; color: string }> = {
  FOOD: { name: '식비', emoji: '🍚', color: '#ff9800' },
  CAFE: { name: '카페/간식', emoji: '☕', color: '#ffb74d' },
  TRANS: { name: '교통비', emoji: '🚗', color: '#42a5f5' },
  SHOPPING: { name: '생활용품', emoji: '🛍️', color: '#8bc34a' },
  LIVING: { name: '주거비', emoji: '🏠', color: '#26a69a' },
  INSURANCE: { name: '보험', emoji: '🛡️', color: '#14b8a6' },
  HEALTH: { name: '의료/건강', emoji: '💊', color: '#ef5350' },
  CULTURE: { name: '문화/여가', emoji: '🎬', color: '#ec407a' },
  SAVINGS: { name: '저축', emoji: '🌱', color: '#10b981' },
  INVESTMENT: { name: '투자/자산증식', emoji: '📈', color: '#6366f1' },
  TRANSFER: { name: '이체/송금', emoji: '💸', color: '#26c6da' },
  INCOME: { name: '수입', emoji: '💰', color: '#10b981' },
  SALARY: { name: '근로소득', emoji: '💰', color: '#10b981' },
  ALLOWANCE: { name: '용돈', emoji: '🪙', color: '#fbbf24' },
  OTHER: { name: '기타', emoji: '🏷️', color: '#9e9e9e' },
};

/**
 * 입력값(코드 또는 이름)으로 카테고리 상세 정보 반환 (Client/Server 공용 순수 함수)
 */
export function resolveCategoryInfo(
  codeOrName?: string | null,
  customCategories?: HouseholdCategory[]
): {
  id: string;
  name: string;
  label: string;
  emoji: string;
  color: string;
  type: CategoryType;
} {
  if (!codeOrName || !codeOrName.trim()) {
    return {
      id: 'OTHER',
      name: '기타',
      label: '기타',
      emoji: '🏷️',
      color: '#9e9e9e',
      type: 'EXPENSE',
    };
  }

  const clean = codeOrName.trim();
  const upper = clean.toUpperCase();

  // 1. 커스텀 또는 기본 목록에서 검색 (ID 또는 Name 일치)
  const list = customCategories || DEFAULT_HOUSEHOLD_CATEGORIES;
  const found = list.find((c) => c.id === upper || c.name === clean);
  if (found) {
    return {
      id: found.id,
      name: found.name,
      label: found.name,
      emoji: found.emoji,
      color: found.color,
      type: found.type,
    };
  }

  // 2. 소분류 안에 포함된 경우 검색
  const foundBySub = list.find((c) => c.subcategories.includes(clean));
  if (foundBySub) {
    return {
      id: foundBySub.id,
      name: foundBySub.name,
      label: clean,
      emoji: foundBySub.emoji,
      color: foundBySub.color,
      type: foundBySub.type,
    };
  }

  // 3. 저축 및 투자 키워드 직접 탐지
  if (
    clean === '저축' ||
    clean === '투자' ||
    upper === 'SAVINGS' ||
    upper === 'INVESTMENT' ||
    ['적금', '예금', '청약', '주택청약', '세이프박스', '비상금'].includes(clean)
  ) {
    return {
      id: 'SAVINGS',
      name: '저축',
      label: clean,
      emoji: '🌱',
      color: '#10b981',
      type: 'SAVINGS',
    };
  }

  // 4. 이체 및 카드대금/카드값 직접 탐지
  if (
    clean === '이체' ||
    clean === '송금' ||
    clean === '이체/송금' ||
    clean === '카드대금' ||
    clean === '카드값' ||
    upper === 'TRANSFER'
  ) {
    return {
      id: 'TRANSFER',
      name: '이체/송금',
      label: clean,
      emoji: '💸',
      color: '#06b6d4',
      type: 'TRANSFER',
    };
  }

  // 5. 일반 수입/소득 직접 탐지
  if (
    clean === '수입' ||
    clean === '소득' ||
    clean === '근로소득' ||
    clean === '부수입' ||
    upper === 'INCOME' ||
    upper === 'SALARY'
  ) {
    return {
      id: 'INCOME',
      name: clean === '근로소득' ? '근로소득' : '수입',
      label: clean,
      emoji: '💰',
      color: '#10b981',
      type: 'INCOME',
    };
  }

  // 6. 용돈 직접 탐지 (기본 지출)
  if (clean === '용돈' || upper === 'ALLOWANCE') {
    return {
      id: 'ALLOWANCE',
      name: '용돈',
      label: clean,
      emoji: '🪙',
      color: '#fbbf24',
      type: 'EXPENSE',
    };
  }

  // 7. 레거시 코드 매핑 확인
  if (LEGACY_CODE_MAP[upper]) {
    const leg = LEGACY_CODE_MAP[upper];
    let type: CategoryType = 'EXPENSE';
    if (upper === 'SAVINGS' || upper === 'INVESTMENT') type = 'SAVINGS';
    else if (upper === 'TRANSFER') type = 'TRANSFER';
    else if (upper === 'INCOME' || upper === 'SALARY') type = 'INCOME';

    return {
      id: upper,
      name: leg.name,
      label: leg.name,
      emoji: leg.emoji,
      color: leg.color,
      type,
    };
  }

  return {
    id: upper,
    name: clean,
    label: clean,
    emoji: '🏷️',
    color: '#9e9e9e',
    type: 'EXPENSE',
  };
}

/**
 * 대분류, 소분류, 내용(사용처)의 맥락을 종합 분석하여 카테고리 정보와 금융 거래 타입(DEPOSIT/WITHDRAWAL/PAYMENT)을 스마트 추론
 */
export function resolveCategoryWithContext(
  mainCategory?: string | null,
  subCategory?: string | null,
  content?: string | null,
  customCategories?: HouseholdCategory[]
): {
  id: string;
  name: string;
  type: CategoryType;
  txType: 'PAYMENT' | 'DEPOSIT' | 'WITHDRAWAL' | 'CANCEL';
  emoji: string;
  color: string;
} {
  const main = (mainCategory || '').trim();
  const sub = (subCategory || '').trim();
  const cont = (content || '').trim();
  const mainUpper = main.toUpperCase();
  const list = customCategories || DEFAULT_HOUSEHOLD_CATEGORIES;

  // 1. 수입 / 소득 계열 분석
  const isIncomeContext =
    mainUpper === 'INCOME' ||
    mainUpper === 'SALARY' ||
    main === '수입' ||
    main === '소득' ||
    main.includes('수입') ||
    main.includes('소득') ||
    sub === '월급' ||
    sub === '부수입';

  if (isIncomeContext) {
    const combined = `${main} ${sub} ${cont}`.toLowerCase();
    // 1-1. 근로소득 (급여, 월급, 보너스, 성과급)
    if (/급여|월급|상여|성과급|보너스|알바|연봉/.test(combined)) {
      const cat = list.find((c) => c.id === 'SALARY') || {
        id: 'SALARY',
        name: '근로소득',
        type: 'INCOME' as CategoryType,
        emoji: '💰',
        color: '#10b981',
      };
      return { id: cat.id, name: cat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: cat.emoji, color: cat.color };
    }
    // 1-2. 금융소득 (이자, 배당금)
    if (/이자|배당|예금이자/.test(combined)) {
      const cat = list.find((c) => c.id === 'FINANCIAL_INCOME') || {
        id: 'FINANCIAL_INCOME',
        name: '금융소득',
        type: 'INCOME' as CategoryType,
        emoji: '📈',
        color: '#3b82f6',
      };
      return { id: cat.id, name: cat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: cat.emoji, color: cat.color };
    }
    // 1-3. 환급금 (세금 환급, 캐시백, 보험금)
    if (/환급|캐시백|세금\s?환급|보험금/.test(combined)) {
      const cat = list.find((c) => c.id === 'REFUND') || {
        id: 'REFUND',
        name: '환급금',
        type: 'INCOME' as CategoryType,
        emoji: '💳',
        color: '#06b6d4',
      };
      return { id: cat.id, name: cat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: cat.emoji, color: cat.color };
    }
    // 1-4. 공적급여/지원금 (아동수당, 실업급여, 지원금)
    if (/아동수당|실업급여|지원금|장려금|수당|바우처/.test(combined)) {
      const cat = list.find((c) => c.id === 'PUBLIC_ALLOWANCE') || {
        id: 'PUBLIC_ALLOWANCE',
        name: '공적급여/지원금',
        type: 'INCOME' as CategoryType,
        emoji: '🏛️',
        color: '#8b5cf6',
      };
      return { id: cat.id, name: cat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: cat.emoji, color: cat.color };
    }
    // 1-5. 가족간 수입 (용돈 받음, 엄마/부모/시엄마가 용돈 등)
    if (/용돈|엄마|시엄마|이모|부모|아빠/.test(combined)) {
      const cat = list.find((c) => c.id === 'FAMILY_SUPPORT') || {
        id: 'FAMILY_SUPPORT',
        name: '가족간 수입',
        type: 'INCOME' as CategoryType,
        emoji: '👨‍👩‍👧',
        color: '#ec4899',
      };
      return { id: cat.id, name: cat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: cat.emoji, color: cat.color };
    }
    // 기본 수입
    const incomeCat = list.find((c) => c.id === 'INCOME' || c.name === '수입') || {
      id: 'INCOME',
      name: '수입',
      type: 'INCOME' as CategoryType,
      emoji: '💰',
      color: '#10b981',
    };
    return { id: incomeCat.id, name: incomeCat.name, type: 'INCOME', txType: 'DEPOSIT', emoji: incomeCat.emoji, color: incomeCat.color };
  }

  // 2. 저축 / 투자 계열 분석
  const isSavingsContext =
    mainUpper === 'SAVINGS' ||
    mainUpper === 'INVESTMENT' ||
    main === '저축' ||
    main === '투자' ||
    main.includes('저축') ||
    sub.includes('적금') ||
    sub.includes('청약') ||
    sub.includes('세이프박스') ||
    cont.includes('청약') ||
    cont.includes('적금') ||
    cont.includes('세이프박스');

  if (isSavingsContext && !cont.includes('이자') && !cont.includes('배당')) {
    const isInvest = /주식|펀드|etf|irp|연금저축|isa/.test(`${main} ${sub} ${cont}`.toLowerCase());
    const cat = list.find((c) => c.id === (isInvest ? 'INVESTMENT' : 'SAVINGS')) || {
      id: isInvest ? 'INVESTMENT' : 'SAVINGS',
      name: isInvest ? '투자/자산증식' : '저축',
      type: 'SAVINGS' as CategoryType,
      emoji: isInvest ? '📈' : '🌱',
      color: isInvest ? '#6366f1' : '#10b981',
    };
    return { id: cat.id, name: cat.name, type: 'SAVINGS', txType: 'WITHDRAWAL', emoji: cat.emoji, color: cat.color };
  }

  // 3. 카드값 / 이체 / 송금 분석
  const isTransferContext =
    mainUpper === 'TRANSFER' ||
    main === '카드값' ||
    main === '카드대금' ||
    main === '이체' ||
    main === '송금' ||
    main.includes('이체') ||
    main.includes('송금');

  if (isTransferContext) {
    const cat = list.find((c) => c.id === 'TRANSFER') || {
      id: 'TRANSFER',
      name: '이체/송금',
      type: 'TRANSFER' as CategoryType,
      emoji: '💸',
      color: '#06b6d4',
    };
    return { id: cat.id, name: cat.name, type: 'TRANSFER', txType: 'WITHDRAWAL', emoji: cat.emoji, color: cat.color };
  }

  // 4. 용돈 분석 (아이/가족에게 주는 용돈 지출 vs 받은 용돈)
  if (main === '용돈' || mainUpper === 'ALLOWANCE') {
    const combined = `${sub} ${cont}`.toLowerCase();
    if (/받음|받은|엄마가|이모가|시엄마가|부모님이/.test(combined)) {
      return { id: 'FAMILY_SUPPORT', name: '가족간 수입', type: 'INCOME', txType: 'DEPOSIT', emoji: '👨‍👩‍👧', color: '#ec4899' };
    }
    return { id: 'ALLOWANCE', name: '용돈', type: 'EXPENSE', txType: 'PAYMENT', emoji: '🪙', color: '#fbbf24' };
  }

  // 5. 일반 카테고리 매핑 (동의어 정규화 포함)
  let searchName = main;
  if (main === '자동차') searchName = '차량비';
  else if (main === '커피') searchName = '식비';
  else if (main === '쇼핑 / 미용' || main === '쇼핑/미용') searchName = '의류/미용';
  else if (main === '건강') searchName = '의료/건강';
  else if (main === '브라이트네트웍스') searchName = '사업 관련 지출';
  else if (main === '교회') searchName = '경조사/선물';
  else if (main === '개인활동') searchName = '기타';

  const resolved = resolveCategoryInfo(searchName, list);
  let txType: 'PAYMENT' | 'DEPOSIT' | 'WITHDRAWAL' | 'CANCEL' = 'PAYMENT';
  if (resolved.type === 'INCOME') txType = 'DEPOSIT';
  else if (resolved.type === 'SAVINGS' || resolved.type === 'TRANSFER') txType = 'WITHDRAWAL';

  return {
    id: resolved.id,
    name: resolved.name,
    type: resolved.type,
    txType,
    emoji: resolved.emoji,
    color: resolved.color,
  };
}

/**
 * 거래가 저축/자산증식에 해당하는지 검증하는 순수 함수
 */
export function isSavingsCategory(codeOrName?: string | null): boolean {
  if (!codeOrName) return false;
  const clean = codeOrName.trim();
  const upper = clean.toUpperCase();
  if (
    upper === 'SAVINGS' ||
    upper === 'INVESTMENT' ||
    clean === '저축' ||
    clean === '투자' ||
    clean === '투자/자산증식'
  ) {
    return true;
  }
  const info = resolveCategoryInfo(codeOrName);
  if (info.type === 'SAVINGS' || info.id === 'SAVINGS' || info.id === 'INVESTMENT') {
    return true;
  }
  const savingsKeywords = ['적금', '예금', '청약', '세이프박스', '비상금', '주식', '펀드', 'irp', '연금저축', 'isa'];
  return savingsKeywords.some((kw) => clean.toLowerCase().includes(kw));
}

/**
 * 거래가 계좌간 이체 또는 카드대금 결제인지 검증하는 순수 함수
 */
export function isTransferCategory(codeOrName?: string | null): boolean {
  if (!codeOrName) return false;
  const clean = codeOrName.trim();
  const upper = clean.toUpperCase();
  if (upper === 'TRANSFER' || clean === '이체/송금' || clean === '카드대금' || clean === '카드값') {
    return true;
  }
  const info = resolveCategoryInfo(codeOrName);
  return info.type === 'TRANSFER' || info.id === 'TRANSFER';
}

export type TransactionFinancialRole = 'INCOME' | 'CONSUMPTION' | 'SAVINGS' | 'TRANSFER';

/**
 * 가계부 4대 테마(수입 확대, 소비 통제, 꾸준한 저축, 자산 증식)에 맞춰 거래의 역할을 판별
 */
export function classifyTransactionRole(tx: {
  type?: string | null;
  category?: string | null;
  title?: string | null;
  merchant?: string | null;
  content?: string | null;
}, customCategories?: HouseholdCategory[]): TransactionFinancialRole {
  const type = tx.type || 'PAYMENT';
  const cat = (tx.category || '').trim();
  const categoryIsSavings = isSavingsCategory(cat) || resolveCategoryInfo(cat, customCategories).type === 'SAVINGS';
  if (type === 'DEPOSIT' && !categoryIsSavings) {
    return 'INCOME';
  }

  const text = `${cat} ${tx.title || ''} ${tx.merchant || ''} ${tx.content || ''}`.toLowerCase();

  // 1. 이체 및 카드대금
  if (isTransferCategory(cat) || /카드대금|카드값|계좌이체/.test(text)) {
    return 'TRANSFER';
  }

  // 2. 저축 및 투자 (소비 예산에서 반드시 제외!)
  if (
    categoryIsSavings ||
    /주택\s?청약|세이프박스|비상금\s?저축|비상금\s?카뱅/.test(text) ||
    (text.includes('예금') && type !== 'DEPOSIT' && !text.includes('이자')) ||
    (text.includes('적금') && type !== 'DEPOSIT' && !text.includes('이자'))
  ) {
    return 'SAVINGS';
  }

  // 3. 나머지는 통제 대상인 순수 소비 지출
  return 'CONSUMPTION';
}

export const TRANSACTION_CATEGORIES = [
  { code: 'FOOD', label: '식비', emoji: '🍚', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  { code: 'CAFE', label: '카페/간식', emoji: '☕', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { code: 'TRANS', label: '교통', emoji: '🚗', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { code: 'SHOPPING', label: '쇼핑', emoji: '🛍️', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { code: 'LIVING', label: '주거/통신', emoji: '🏠', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { code: 'INSURANCE', label: '보험', emoji: '🛡️', color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  { code: 'HEALTH', label: '의료/건강', emoji: '💊', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { code: 'CULTURE', label: '문화/여가', emoji: '🎬', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  { code: 'SAVINGS', label: '저축/투자', emoji: '🌱', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { code: 'TRANSFER', label: '이체/송금', emoji: '💸', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { code: 'OTHER', label: '기타', emoji: '🏷️', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
] as const;

export type TransactionCategoryCode = (typeof TRANSACTION_CATEGORIES)[number]['code'];

export function getCategoryInfo(code?: string | null) {
  if (!code) return { code: 'OTHER', label: '기타', emoji: '🏷️', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
  const found = TRANSACTION_CATEGORIES.find((c) => c.code === code.toUpperCase());
  if (found) return found;

  const resolved = resolveCategoryInfo(code);
  return {
    code: resolved.id,
    label: resolved.label,
    emoji: resolved.emoji,
    color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };
}

/**
 * 가맹점명 및 텍스트를 기반으로 카테고리를 자동 추론하는 스마트 분류기
 */
export function autoDetectCategory(
  merchant?: string | null,
  title?: string | null,
  content?: string | null
): TransactionCategoryCode {
  const text = `${merchant || ''} ${title || ''} ${content || ''}`.toLowerCase();

  // 1. 카페 / 간식
  if (
    /스타벅스|starbucks|투썸|이디야|메가커피|컴포즈|빽다방|커피|카페|cafe|베이커리|파리바게|뚜레쥬르|배스킨|던킨|공차|디저트|와플|베이글|샌드위치|도넛|설빙|요거트|할리스|엔제리너스|폴바셋|블루보틀|파스쿠찌/.test(
      text
    )
  ) {
    return 'CAFE';
  }

  // 2. 식비 (식당, 배달 등)
  if (
    /식당|음식|배달의민족|배민|요기요|쿠팡이츠|솥내음|김밥|국밥|찌개|고기|갈비|삼겹|치킨|피자|버거|맥도날드|버거킹|롯데리아|서브웨이|한식|중식|일식|분식|푸드|레스토랑|스시|초밥|짜장|짬뽕|탕수육|포차|주점|술집|호프|이자카야|구이|곱창|마라|돈까스|칼국수|냉면|우동|라면|라멘|식사|순대|백반|덮밥|부대찌개|감자탕|쭈꾸미|낙지|아구찜|보쌈|족발|닭갈비|샤브|마라탕|양꼬치|회|횟집|반찬/.test(
      text
    )
  ) {
    return 'FOOD';
  }

  // 3. 교통
  if (
    /카카오t|카카오택시|티머니|코레일|sert|지하철|택시|버스|교통|주유|주차|하이패스|통행료|gs칼텍스|sk에너지|s-oil|에쓰오일|현대오일|알뜰주유|쏘카|그린카|따릉이|주차장|철도|ktx|srt|고속버스/.test(
      text
    )
  ) {
    return 'TRANS';
  }

  // 4. 쇼핑
  if (
    /쿠팡|coupang|네이버페이|11번가|지마켓|gmarket|옥션|ssg|무신사|올리브영|다이소|백화점|마켓컬리|컬리|이마트|홈플러스|롯데마트|편의점|cu|gs25|세븐일레븐|미니스톱|이마트24|아울렛|몰|쇼핑|스토어|패션|의류|신발|안경|서점|문구|문방구/.test(
      text
    )
  ) {
    return 'SHOPPING';
  }

  // 5. 주거/통신/공과금
  if (
    /관리비|아파트|한국전력|한전|도시가스|가스요금|수도요금|skt|kt|lgu|엘지유플러스|통신|인터넷|렌탈|월세|임대료|코웨이|청호|국민연금|연금|공과금|세금/.test(
      text
    )
  ) {
    return 'LIVING';
  }

  // 6. 보험
  if (
    /보험|삼성생명|한화생명|교보생명|현대해상|db손해|kb손해|메리츠|실손|동양생명|신한라이프|흥국|라이나|aia|aig|암보험|종신|자동차보험|운전자보험|화재보험|치아보험|태아보험|어린이보험|공제회|보장/.test(
      text
    )
  ) {
    return 'INSURANCE';
  }

  // 7. 의료/건강
  if (
    /병원|의원|약국|치과|안과|피부과|이비인후과|정형외과|한의원|내과|약업|헬스|피트니스|gym|필라테스|요가|크로스핏|보건소|종합검진|물리치료|국민건강/.test(
      text
    )
  ) {
    return 'HEALTH';
  }

  // 7. 문화/여가
  if (
    /cgv|메가박스|롯데시네마|영화|넷플릭스|netflix|유튜브|youtube|티빙|왓챠|디즈니|멜론|지니|스포티파이|교보문고|알라딘|yes24|영풍문고|도서|골프|볼링|pc방|노래방|호텔|리조트|펜션|모텔|에어비앤비|야놀자|여기어때|항공|비행기|인터파크|공연|전시|미술관|박물관|테마파크|워터파크|스키/.test(
      text
    )
  ) {
    return 'CULTURE';
  }

  // 8. 저축 / 투자 (자산 증식)
  if (/청약|적금|예금|세이프박스|비상금\s?저축|주식|펀드|연금저축|irp|isa/.test(text) && !text.includes('이자') && !text.includes('배당')) {
    return 'SAVINGS';
  }

  // 9. 이체/송금
  if (/이체|송금|출금|입금|충전|타행|카카오송금|토스송금|카드값|카드대금/.test(text)) {
    return 'TRANSFER';
  }

  return 'OTHER';
}
