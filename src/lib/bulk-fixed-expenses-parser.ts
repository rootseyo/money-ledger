import {
  FixedExpenseCycle,
  FixedExpenseItem,
} from './fixed-expenses';
import {
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  resolveCategoryInfo,
} from './household-categories';
import { matchPaymentMethod } from './quick-transaction-parser';

export interface BulkParsedFixedExpenseRow {
  index: number;
  rawLine: string;
  name: string;
  amount: number;
  cycle: FixedExpenseCycle;
  payDay: string; // '1'~'31' 또는 'LAST_DAY'
  category: string;
  subCategory?: string;
  paymentMethod: string;
  startDate: string;
  endDate?: string | null;
  isAutoPay: boolean;
  memo?: string;
  merchantKeyword?: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export interface BulkFixedExpensesParseResult {
  rows: BulkParsedFixedExpenseRow[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  totalMonthlyAmount: number;
}

/**
 * 주기(Cycle) 정규화
 */
export function normalizeCycle(raw?: string | null): FixedExpenseCycle {
  if (!raw) return 'MONTHLY';
  const clean = raw.trim().toUpperCase().replace(/[\s\-_]/g, '');

  if (
    clean.includes('YEAR') ||
    clean.includes('연') ||
    clean.includes('년')
  ) {
    return 'YEARLY';
  }
  if (
    clean.includes('WEEK') ||
    clean.includes('주')
  ) {
    return 'WEEKLY';
  }
  if (
    clean.includes('DAY') ||
    clean.includes('DAILY') ||
    clean.includes('일간') ||
    clean === '일' ||
    clean === '매일'
  ) {
    return 'DAILY';
  }
  return 'MONTHLY';
}

/**
 * 날짜 및 결제일 값이 비어있거나 미지정 표시인지 확인
 */
export function isDateEmpty(val?: string | null): boolean {
  if (!val) return true;
  const clean = val.trim().toLowerCase();
  return (
    clean === '' ||
    clean === '-' ||
    clean === '--' ||
    clean === 'null' ||
    clean === 'none' ||
    clean === 'undefined' ||
    clean === '없음' ||
    clean === '미정' ||
    clean === '미지정' ||
    clean === '공란' ||
    clean === 'x' ||
    clean === 'nan'
  );
}

/**
 * 결제일(payDay) 정규화 ('1'~'31' 또는 'LAST_DAY')
 * 날짜/결제일 값이 비어있거나 생략된 경우 기본값 '1'을 반환하며 값이 밀리지 않도록 처리합니다.
 */
export function normalizePayDay(raw?: string | null): string {
  if (!raw || isDateEmpty(raw)) return '1';
  const clean = raw.trim();

  // 말일 패턴
  if (
    clean.includes('말일') ||
    clean.includes('마지막') ||
    clean.toUpperCase().includes('LAST') ||
    clean === '말'
  ) {
    return 'LAST_DAY';
  }

  // 1. 전체 날짜 형식: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const fullDateMatch = clean.match(/\d{4}[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[2], 10);
    if (day >= 1 && day <= 31) {
      return String(day);
    }
  }

  // 2. 월/일 형식: MM-DD, M/D, M.D
  const monthDayMatch = clean.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (monthDayMatch) {
    const day = parseInt(monthDayMatch[2], 10);
    if (day >= 1 && day <= 31) {
      return String(day);
    }
  }

  // 3. 일자 형식: "15일", "15"
  const dayMatch = clean.match(/^(\d{1,2})\s*일?$/);
  if (dayMatch) {
    const val = parseInt(dayMatch[1], 10);
    if (val >= 1 && val <= 31) {
      return String(val);
    }
  }

  // 4. "매달 15일", "매월 15일" 등
  const prefixedDayMatch = clean.match(/(?:매달|매월|매주|매일)?\s*(\d{1,2})\s*일/);
  if (prefixedDayMatch) {
    const val = parseInt(prefixedDayMatch[1], 10);
    if (val >= 1 && val <= 31) {
      return String(val);
    }
  }

  // 5. 일반 숫자 추출 (1~31)
  const numMatch = clean.match(/(\d{1,2})/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val >= 1 && val <= 31) {
      return String(val);
    }
  }

  return '1';
}

/**
 * 전체 날짜 문자열(YYYY-MM-DD) 추출
 */
export function extractStartDate(raw?: string | null): string | null {
  if (!raw || isDateEmpty(raw)) return null;
  const clean = raw.trim();
  const m = clean.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    const day = m[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * 헤더 행 판별
 */
function isHeaderRow(line: string): boolean {
  const lower = line.toLowerCase();
  const headerKeywords = [
    '항목',
    '이름',
    '고정비',
    '내용',
    '가맹점',
    '사용처',
    '적요',
    '금액',
    '비용',
    '주기',
    '결제일',
    '결제일자',
    '날짜',
    '일자',
    '납부일',
    '출금일',
    '시작일',
    '카테고리',
    '대분류',
    '소분류',
    '결제수단',
    '수단',
    '카드',
    '계좌',
    '메모',
    '비고',
  ];
  let matchCount = 0;
  for (const kw of headerKeywords) {
    if (lower.includes(kw)) matchCount++;
  }
  return matchCount >= 2;
}

/**
 * 대량 고정비용 복붙 파서
 */
export function parseBulkFixedExpenses(
  rawText: string,
  categories: HouseholdCategory[] = DEFAULT_HOUSEHOLD_CATEGORIES,
  existingItems: (FixedExpenseItem | { name: string; merchantKeyword?: string })[] = []
): BulkFixedExpensesParseResult {
  // 개행 기준으로 분리하되, 첫 번째 열이 공란일 때 leading tab이 지워지지 않도록 trim() 대신 개행 문자만 제거
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/[\r\n]+$/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      totalMonthlyAmount: 0,
    };
  }

  // 헤더 분석 (첫 줄이 헤더인지 확인)
  let startIndex = 0;
  let headerMap: Record<string, number> = {};

  if (lines.length > 0 && isHeaderRow(lines[0])) {
    const headerTokens = splitLineTokens(lines[0]);
    headerTokens.forEach((token, idx) => {
      if (!token) return;
      const t = token.replace(/[\s\-_]/g, '').toLowerCase();
      if (
        t.includes('항목') ||
        t.includes('이름') ||
        t.includes('고정비') ||
        t.includes('서비스') ||
        t.includes('내용') ||
        t.includes('가맹점') ||
        t.includes('사용처') ||
        t.includes('적요')
      ) {
        headerMap['name'] = idx;
      } else if (
        t.includes('금액') ||
        t.includes('비용') ||
        t.includes('가격') ||
        t.includes('월액') ||
        t.includes('지출액')
      ) {
        headerMap['amount'] = idx;
      } else if (t.includes('주기') || t.includes('반복') || t.includes('단위')) {
        headerMap['cycle'] = idx;
      } else if (
        t.includes('결제일') ||
        t.includes('납부일') ||
        t.includes('일자') ||
        t.includes('출금일') ||
        t.includes('날짜') ||
        t.includes('결제날') ||
        t.includes('이체일') ||
        t.includes('승인일') ||
        t.includes('시작일') ||
        t === '일'
      ) {
        headerMap['payDay'] = idx;
      } else if (t.includes('카테고리') || t.includes('대분류') || t.includes('분류')) {
        headerMap['category'] = idx;
      } else if (t.includes('소분류')) {
        headerMap['subCategory'] = idx;
      } else if (
        t.includes('결제수단') ||
        t.includes('수단') ||
        t.includes('카드') ||
        t.includes('계좌')
      ) {
        headerMap['paymentMethod'] = idx;
      } else if (t.includes('메모') || t.includes('비고') || t.includes('설명')) {
        headerMap['memo'] = idx;
      }
    });
    startIndex = 1;
  }

  const rows: BulkParsedFixedExpenseRow[] = [];
  const todayYMD = new Date().toISOString().slice(0, 10);

  // 기존 등록된 이름 목록 (중복 체크용)
  const existingNamesSet = new Set(
    existingItems.map((item) => (item.name || '').trim().toLowerCase())
  );
  const existingKeywordsSet = new Set(
    existingItems
      .map((item) => (item.merchantKeyword || '').trim().toLowerCase())
      .filter((k) => k.length > 0)
  );

  let rowCounter = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    rowCounter++;

    const tokens = splitLineTokens(rawLine);
    if (tokens.length === 0) continue;

    let name = '';
    let amount = 0;
    let cycle: FixedExpenseCycle = 'MONTHLY';
    let payDay = '1';
    let category = '';
    let subCategory = '';
    let paymentMethod = '우리카드';
    let memo = '';
    let startDate = todayYMD;

    const hasHeaderMapping = Object.keys(headerMap).length >= 2;

    if (hasHeaderMapping) {
      // 1. 헤더 기반 슬롯 매핑
      if (headerMap['name'] !== undefined && tokens[headerMap['name']]) {
        name = tokens[headerMap['name']];
      }
      if (headerMap['amount'] !== undefined && tokens[headerMap['amount']]) {
        amount = parseAmountNumber(tokens[headerMap['amount']]);
      }
      if (headerMap['cycle'] !== undefined && tokens[headerMap['cycle']]) {
        cycle = normalizeCycle(tokens[headerMap['cycle']]);
      }
      if (headerMap['payDay'] !== undefined) {
        const rawPayDay = tokens[headerMap['payDay']] || '';
        if (!isDateEmpty(rawPayDay)) {
          payDay = normalizePayDay(rawPayDay);
          const fullD = extractStartDate(rawPayDay);
          if (fullD) startDate = fullD;
        } else {
          payDay = '1';
        }
      }
      if (headerMap['category'] !== undefined && tokens[headerMap['category']]) {
        category = tokens[headerMap['category']];
      }
      if (headerMap['subCategory'] !== undefined && tokens[headerMap['subCategory']]) {
        subCategory = tokens[headerMap['subCategory']];
      }
      if (headerMap['paymentMethod'] !== undefined && tokens[headerMap['paymentMethod']]) {
        paymentMethod = normalizePaymentMethod(tokens[headerMap['paymentMethod']]);
      }
      if (headerMap['memo'] !== undefined && tokens[headerMap['memo']]) {
        memo = tokens[headerMap['memo']];
      }
    } else {
      // 2. 스마트 자동 추론 매핑 (토큰 순서 자유형)
      const usedTokenIndices = new Set<number>();

      // A. 금액 찾기
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        const token = tokens[tIdx];
        if (isAmountToken(token)) {
          const parsedNum = parseAmountNumber(token);
          if (parsedNum > 0) {
            amount = parsedNum;
            usedTokenIndices.add(tIdx);
            break;
          }
        }
      }

      // B. 주기 찾기 (매월, 매년, 매주, 매일 등)
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        if (usedTokenIndices.has(tIdx)) continue;
        const token = tokens[tIdx];
        if (isCycleToken(token)) {
          cycle = normalizeCycle(token);
          usedTokenIndices.add(tIdx);
          break;
        }
      }

      // C. 결제일 찾기 (말일, 1일~31일 등)
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        if (usedTokenIndices.has(tIdx)) continue;
        const token = tokens[tIdx];
        if (!token || isDateEmpty(token)) continue;
        if (isPayDayToken(token)) {
          payDay = normalizePayDay(token);
          const fullD = extractStartDate(token);
          if (fullD) startDate = fullD;
          usedTokenIndices.add(tIdx);
          break;
        }
      }

      // D. 카테고리 매칭
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        if (usedTokenIndices.has(tIdx)) continue;
        const token = tokens[tIdx];
        if (!token) continue;
        const matchedCat = findMatchingCategory(token, categories);
        if (matchedCat) {
          category = matchedCat.name;
          usedTokenIndices.add(tIdx);
          break;
        }
      }

      // E. 결제수단 매칭
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        if (usedTokenIndices.has(tIdx)) continue;
        const token = tokens[tIdx];
        if (!token) continue;
        if (isPaymentMethodToken(token)) {
          paymentMethod = normalizePaymentMethod(token);
          usedTokenIndices.add(tIdx);
          break;
        }
      }

      // F. 남은 토큰 중 첫 번째는 항목명(name), 나머지는 메모(memo) (공란 및 미입력 표시는 제외)
      const remaining: string[] = [];
      for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
        if (!usedTokenIndices.has(tIdx)) {
          const val = tokens[tIdx]?.trim();
          if (val && !isDateEmpty(val)) {
            remaining.push(val);
          }
        }
      }

      if (remaining.length > 0) {
        name = remaining[0];
        if (remaining.length > 1) {
          memo = remaining.slice(1).join(' ');
        }
      }
    }

    // 기본 카테고리 없으면 자동 추론
    if (!category && name) {
      const autoCat = resolveCategoryInfo(name, categories);
      category = autoCat.name || '주거/통신';
    } else if (!category) {
      category = '주거/통신';
    }

    // 유효성 검사
    let isValid = true;
    let error: string | undefined;

    if (!name.trim()) {
      isValid = false;
      error = '고정비용 항목명이 누락되었습니다.';
    } else if (amount <= 0) {
      isValid = false;
      error = '올바른 결제 금액(1원 이상)이 필요합니다.';
    }

    // 중복 검사
    const lowerName = name.trim().toLowerCase();
    const isDuplicate =
      existingNamesSet.has(lowerName) ||
      (lowerName.length >= 2 && existingKeywordsSet.has(lowerName));

    const duplicateReason = isDuplicate ? '기존 등록된 고정비용과 이름이 일치합니다' : undefined;

    rows.push({
      index: rowCounter,
      rawLine,
      name: name.trim(),
      amount,
      cycle,
      payDay,
      category: category.trim(),
      subCategory: subCategory.trim() || undefined,
      paymentMethod: paymentMethod.trim() || '우리카드',
      startDate: startDate,
      endDate: null,
      isAutoPay: true,
      memo: memo.trim() || undefined,
      merchantKeyword: name.trim(),
      isValid,
      error,
      isDuplicate,
      duplicateReason,
    });
  }

  const validCount = rows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  const totalMonthlyAmount = rows
    .filter((r) => r.isValid && !r.isDuplicate)
    .reduce((sum, r) => {
      let monthly = r.amount;
      if (r.cycle === 'YEARLY') monthly = Math.round(r.amount / 12);
      else if (r.cycle === 'WEEKLY') monthly = Math.round((r.amount * 52) / 12);
      else if (r.cycle === 'DAILY') monthly = Math.round(r.amount * 30.4);
      return sum + monthly;
    }, 0);

  return {
    rows,
    totalCount: rows.length,
    validCount,
    invalidCount,
    duplicateCount,
    totalMonthlyAmount,
  };
}

/**
 * 텍스트 라인을 토큰으로 분리 (탭, 쉼표, 세미콜론, 파이프, 다중 공백)
 * 구분자(탭, 콤마 등)로 분리할 때는 빈 열(예: 날짜 미입력)의 자리가 유지되도록 빈 문자열을 보존합니다.
 */
function splitLineTokens(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((s) => s.trim());
  }
  if (line.includes('|')) {
    const trimmed = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
    return trimmed.split('|').map((s) => s.trim());
  }
  if (line.includes(';')) {
    return line.split(';').map((s) => s.trim());
  }
  if (line.includes(',')) {
    return line.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }
  // 2개 이상의 연속 공백으로 분리 (공백은 빈 열 구분이 없으므로 빈 항목 제외)
  return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 금액 토큰인지 판별
 */
function isAmountToken(token: string): boolean {
  const clean = token.replace(/[,원₩\s+]/g, '');
  return /^\d{2,10}$/.test(clean);
}

/**
 * 금액 파싱
 */
function parseAmountNumber(token: string): number {
  const clean = token.replace(/[^0-9]/g, '');
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 주기 토큰인지 판별
 */
function isCycleToken(token: string): boolean {
  const clean = token.replace(/[\s\-_]/g, '').toLowerCase();
  return (
    clean === '매월' ||
    clean === '월' ||
    clean === '월간' ||
    clean === 'monthly' ||
    clean === '매년' ||
    clean === '년' ||
    clean === '연' ||
    clean === '연간' ||
    clean === 'yearly' ||
    clean === '매주' ||
    clean === '주' ||
    clean === '주간' ||
    clean === 'weekly' ||
    clean === '매일' ||
    clean === '일' ||
    clean === '일간' ||
    clean === 'daily'
  );
}

/**
 * 결제일 토큰인지 판별
 */
function isPayDayToken(token: string): boolean {
  const clean = token.replace(/[\s\-_]/g, '');
  if (
    clean.includes('말일') ||
    clean.includes('마지막날') ||
    clean.toUpperCase().includes('LAST') ||
    clean === '말'
  ) {
    return true;
  }
  const match = clean.match(/^(\d{1,2})일?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    return day >= 1 && day <= 31;
  }
  return false;
}

/**
 * 카테고리 매칭
 */
function findMatchingCategory(token: string, categories: HouseholdCategory[]): HouseholdCategory | null {
  const clean = token.replace(/[\s/]/g, '').toLowerCase();
  for (const cat of categories) {
    const catName = cat.name.replace(/[\s/]/g, '').toLowerCase();
    if (catName === clean || cat.id.toLowerCase() === clean) {
      return cat;
    }
  }
  return null;
}

/**
 * 결제수단 토큰인지 판별
 */
function isPaymentMethodToken(token: string): boolean {
  const clean = token.replace(/[\s\-_]/g, '').toLowerCase();
  const known = [
    '우리카드',
    '우리won',
    '토스',
    '토스뱅크',
    '카카오페이',
    '카카오뱅크',
    '신한카드',
    '국민카드',
    '현대카드',
    '자동이체',
    '계좌이체',
    '체크카드',
    '신용카드',
  ];
  return known.some((k) => clean.includes(k) || k.includes(clean));
}

/**
 * 결제 수단 정규화
 */
export function normalizePaymentMethod(raw?: string | null): string {
  if (!raw) return '우리카드';
  const clean = raw.trim();
  const lower = clean.toLowerCase();

  if (lower.includes('자동이체') || lower.includes('계좌이체') || lower === '이체') {
    return '자동이체';
  }
  if (lower.includes('우리won') || lower.includes('우리원') || lower === 'won') {
    return '우리WON';
  }
  if (lower.includes('우리카드') || lower === '우리') {
    return '우리카드';
  }
  if (lower.includes('토스뱅크') || lower.includes('토뱅')) {
    return '토스뱅크';
  }
  if (lower.includes('토스')) {
    return '토스';
  }
  if (lower.includes('카카오페이') || lower.includes('카페이')) {
    return '카카오페이';
  }
  if (lower.includes('카카오뱅크') || lower.includes('카뱅')) {
    return '카카오뱅크';
  }
  if (lower.includes('신한')) {
    return '신한카드';
  }
  if (lower.includes('국민') || lower.includes('kb')) {
    return '국민카드';
  }
  if (lower.includes('현대')) {
    return '현대카드';
  }
  return clean || '우리카드';
}
