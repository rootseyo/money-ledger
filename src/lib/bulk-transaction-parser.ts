import {
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  resolveCategoryInfo,
  resolveCategoryWithContext,
} from './household-categories';
import {
  matchPaymentMethod,
  formatDateToYMD,
} from './quick-transaction-parser';

export interface BulkParsedRow {
  index: number;
  rawLine: string;
  dateStr: string; // YYYY-MM-DD
  isMonthFallback: boolean; // true if original date was null/empty and filled with default month
  content: string; // 내용/사용처
  amount: number; // 금액
  mainCategory: string; // 대분류
  subCategory: string; // 소분류
  paymentMethod: string; // 지출 방법
  tag: string; // 태그
  memo: string; // 메모
  type: 'PAYMENT' | 'DEPOSIT' | 'WITHDRAWAL' | 'CANCEL';
  sourceApp: string;
  cardOrAccount: string;
  title: string;
  formattedContent: string;
  isValid: boolean;
  error?: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

export interface BulkParseResult {
  rows: BulkParsedRow[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  totalExpense: number;
  totalIncome: number;
  totalSavings: number;
  totalTransfer: number;
  defaultMonth: string;
}

/**
 * Clean & normalize date string.
 * If raw is null/empty/dash/'null', returns defaultMonth-01 (e.g. 2026-09-01).
 */
export function normalizeBulkDate(
  rawDate: string | null | undefined,
  defaultMonth: string
): { dateStr: string; isMonthFallback: boolean } {
  const trimmed = (rawDate || '').trim();

  // If empty or null placeholder
  const isNullLike =
    !trimmed ||
    trimmed === '-' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'none' ||
    trimmed === '없음' ||
    trimmed === '미정';

  const [fallbackYear, fallbackMonth] = defaultMonth.split('-');
  const fallbackDate = `${fallbackYear}-${fallbackMonth || '01'}-01`;

  if (isNullLike) {
    return { dateStr: fallbackDate, isMonthFallback: true };
  }

  // 1. Standard YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, isMonthFallback: false };
  }

  // 2. Korean style: 2026년 9월 15일
  const korFullMatch = trimmed.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  if (korFullMatch) {
    const y = korFullMatch[1];
    const m = String(parseInt(korFullMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(korFullMatch[3], 10)).padStart(2, '0');
    return { dateStr: `${y}-${m}-${d}`, isMonthFallback: false };
  }

  // 3. Month & Day only: 09-15, 9/15, 9.15, 9월 15일
  const mdMatch = trimmed.match(/^(\d{1,2})[-./월]\s*(\d{1,2})\s*일?/);
  if (mdMatch) {
    const m = String(parseInt(mdMatch[1], 10)).padStart(2, '0');
    const d = String(parseInt(mdMatch[2], 10)).padStart(2, '0');
    return { dateStr: `${fallbackYear}-${m}-${d}`, isMonthFallback: false };
  }

  // 4. Day only: 15, 15일
  const dMatch = trimmed.match(/^(\d{1,2})\s*일?$/);
  if (dMatch) {
    const d = String(parseInt(dMatch[1], 10)).padStart(2, '0');
    return { dateStr: `${fallbackYear}-${fallbackMonth || '01'}-${d}`, isMonthFallback: false };
  }

  // If unparseable, fallback
  return { dateStr: fallbackDate, isMonthFallback: true };
}

/**
 * Check if a row represents header titles
 */
export function isHeaderRow(cols: string[]): boolean {
  const joined = cols.join(' ').toLowerCase();
  const headerKeywords = ['날짜', '내용', '금액', '대분류', '소분류', '지출', '방법', '지출방법', '태그', '메모'];
  let matchCount = 0;
  for (const kw of headerKeywords) {
    if (joined.includes(kw)) matchCount++;
  }
  return matchCount >= 3;
}

/**
 * Check if a string looks like a date or date placeholder.
 */
export function isDateLike(str?: string | null): boolean {
  if (str === undefined || str === null) return false;
  const trimmed = str.trim();
  // empty string counts as an intentional empty date column
  if (!trimmed) return true;

  // null-like placeholders
  const lower = trimmed.toLowerCase();
  if (['-', 'null', 'none', '없음', '미정', 'n/a', 'na'].includes(lower)) return true;

  // YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YY-MM-DD
  if (/^(\d{2,4})[-./](\d{1,2})[-./](\d{1,2})/.test(trimmed)) return true;

  // 2026년 9월 15일, 9월 15일
  if (/^(\d{2,4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일?/.test(trimmed)) return true;

  // MM-DD, M/D, M.D (where month is 1-12 and day is 1-31)
  const mdMatch = trimmed.match(/^(\d{1,2})[-./](\d{1,2})$/);
  if (mdMatch) {
    const m = parseInt(mdMatch[1], 10);
    const d = parseInt(mdMatch[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return true;
  }

  // Day only: 1일 ~ 31일
  if (/^(\d{1,2})\s*일$/.test(trimmed)) {
    const d = parseInt(trimmed, 10);
    if (d >= 1 && d <= 31) return true;
  }

  return false;
}

/**
 * Check if a string looks like an amount / currency (contains digits, optional +/-, commas, '원').
 */
export function isAmountLike(str?: string | null): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (!/\d/.test(trimmed)) return false;
  return /^[+-]?\s*₩?\s*[\d,]+(\s*원)?$/.test(trimmed);
}

/**
 * Split a pasted row into columns by tab (\t) or comma or multiple spaces
 */
export function splitColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((c) => c.trim());
  }
  // CSV: honor quoted fields so amounts such as "5,500" stay in one column.
  if (line.includes(',')) {
    const columns: string[] = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === ',' && !quoted) {
        columns.push(value.trim()); value = '';
      } else value += character;
    }
    columns.push(value.trim());
    return columns;
  }
  // Otherwise split by 2 or more spaces
  return line.split(/\s{2,}/).map((c) => c.trim());
}

/**
 * Format a Date or date string to YYYY-MM-DD in KST (Asia/Seoul).
 */
export function formatToKSTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * Normalize merchant or content for robust comparison.
 * Strips bracketed tags like [외식], [가계부], (태그: ...), non-alphanumeric chars, and lowercases.
 */
export function normalizeMerchant(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9가-힣]/g, '');
}

/**
 * Check if two merchant/content/title descriptors refer to the same merchant.
 */
export function isMerchantMatch(
  merchantA?: string | null,
  contentA?: string | null,
  titleA?: string | null,
  merchantB?: string | null,
  contentB?: string | null,
  titleB?: string | null
): boolean {
  const normMA = normalizeMerchant(merchantA);
  const normMB = normalizeMerchant(merchantB);
  const normCA = normalizeMerchant(contentA);
  const normCB = normalizeMerchant(contentB);

  // 1. Direct merchant match
  if (normMA && normMB && normMA === normMB) return true;
  // 2. Direct content match
  if (normCA && normCB && normCA === normCB) return true;
  // 3. Merchant of A matches content of B or vice versa
  if (normMA && normCB && (normMA === normCB || (normMA.length >= 2 && normCB.includes(normMA)) || (normCB.length >= 2 && normMA.includes(normCB)))) return true;
  if (normMB && normCA && (normMB === normCA || (normMB.length >= 2 && normCA.includes(normMB)) || (normCA.length >= 2 && normMB.includes(normCA)))) return true;

  // 4. Substring match if length >= 2
  if (normMA && normMB && normMA.length >= 2 && normMB.length >= 2) {
    if (normMA.includes(normMB) || normMB.includes(normMA)) return true;
  }
  if (normCA && normCB && normCA.length >= 2 && normCB.length >= 2) {
    if (normCA.includes(normCB) || normCB.includes(normCA)) return true;
  }

  // 5. Title substring checks
  const normTA = normalizeMerchant(titleA);
  const normTB = normalizeMerchant(titleB);
  if (normMA && normTB && normTB.includes(normMA)) return true;
  if (normMB && normTA && normTA.includes(normMB)) return true;
  if (normCA && normTB && normTB.includes(normCA)) return true;
  if (normCB && normTA && normTA.includes(normCB)) return true;

  // 6. If neither has any merchant/content/title
  if (!normMA && !normMB && !normCA && !normCB) return true;

  return false;
}

export interface TransactionComparisonItem {
  dateStr?: string;
  notifiedAt?: string | Date;
  amount: number;
  type?: string;
  merchant?: string | null;
  content?: string;
  title?: string;
}

/**
 * Check if two transactions are duplicates.
 * Duplicates must match:
 * 1. Date (same KST YYYY-MM-DD)
 * 2. Amount (same absolute integer value)
 * 3. Type direction (Income vs Expense)
 * 4. Merchant / Content / Title
 */
export function isTransactionDuplicate(
  incoming: TransactionComparisonItem,
  existing: TransactionComparisonItem
): boolean {
  // 1. Amount match
  const amtA = Math.round(Math.abs(Number(incoming.amount) || 0));
  const amtB = Math.round(Math.abs(Number(existing.amount) || 0));
  if (amtA !== amtB) return false;

  // 2. Type direction match (Income vs Expense)
  const isIncomeA = incoming.type === 'DEPOSIT';
  const isIncomeB = existing.type === 'DEPOSIT';
  if (isIncomeA !== isIncomeB) return false;

  // 3. Date match (in KST YYYY-MM-DD)
  const dateA = incoming.dateStr || (incoming.notifiedAt ? formatToKSTDate(incoming.notifiedAt) : '');
  const dateB = existing.dateStr || (existing.notifiedAt ? formatToKSTDate(existing.notifiedAt) : '');
  if (dateA && dateB && dateA !== dateB) return false;

  // 4. Merchant / Content match
  return isMerchantMatch(
    incoming.merchant,
    incoming.content,
    incoming.title,
    existing.merchant,
    existing.content,
    existing.title
  );
}

/**
 * Mark duplicate rows against existing database records and within the batch.
 */
export function markDuplicateRows(
  rows: BulkParsedRow[],
  existingTransactions: any[] = []
): BulkParsedRow[] {
  const seenValidRows: BulkParsedRow[] = [];

  return rows.map((row) => {
    if (!row.isValid) {
      return row;
    }

    // 1. Check against DB records
    const existingMatch = existingTransactions.find((et) =>
      isTransactionDuplicate(
        {
          dateStr: row.dateStr,
          amount: row.amount,
          type: row.type,
          merchant: row.content,
          content: row.formattedContent,
          title: row.title,
        },
        et
      )
    );

    if (existingMatch) {
      const matchDate =
        existingMatch.dateStr ||
        (existingMatch.notifiedAt ? formatToKSTDate(existingMatch.notifiedAt) : row.dateStr);
      const matchName =
        existingMatch.merchant ||
        existingMatch.content ||
        existingMatch.title ||
        row.content;
      return {
        ...row,
        isDuplicate: true,
        duplicateReason: `기존 거래와 중복 (${matchDate} ${matchName} ₩${row.amount.toLocaleString()})`,
      };
    }

    // 2. Check against previous rows in this batch (intra-batch)
    const intraMatch = seenValidRows.find((prev) =>
      isTransactionDuplicate(
        {
          dateStr: row.dateStr,
          amount: row.amount,
          type: row.type,
          merchant: row.content,
          content: row.formattedContent,
          title: row.title,
        },
        {
          dateStr: prev.dateStr,
          amount: prev.amount,
          type: prev.type,
          merchant: prev.content,
          content: prev.formattedContent,
          title: prev.title,
        }
      )
    );

    if (intraMatch) {
      return {
        ...row,
        isDuplicate: true,
        duplicateReason: `입력 목록 내 중복 (${intraMatch.index}번 행과 동일)`,
      };
    }

    seenValidRows.push(row);
    return {
      ...row,
      isDuplicate: false,
      duplicateReason: undefined,
    };
  });
}

/**
 * Parse bulk text (copied from web tables, Google Sheets, or Excel)
 * Expected order:
 * 날짜 | 내용 | 금액 | 대분류 | 소분류 | 지출 방법 | 태그 | 메모
 */
export function parseBulkTransactions(
  rawText: string,
  defaultMonth: string = formatDateToYMD(new Date()).slice(0, 7),
  categories: HouseholdCategory[] = DEFAULT_HOUSEHOLD_CATEGORIES,
  existingTransactions: any[] = []
): BulkParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.replace(/[\r\n]+$/, ''))
    .filter((l) => l.trim().length > 0);
  const rows: BulkParsedRow[] = [];

  let rowIndex = 0;
  let tableMissingDateHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let cols = splitColumns(line);

    // Skip empty line
    if (cols.length === 0 || (cols.length === 1 && !cols[0])) {
      continue;
    }

    // Check if this row is a header
    if (i === 0 && isHeaderRow(cols)) {
      const firstCol = (cols[0] || '').toLowerCase();
      const hasDateInFirstCol =
        firstCol.includes('날짜') || firstCol.includes('일시') || firstCol.includes('일자');
      if (!hasDateInFirstCol) {
        tableMissingDateHeader = true;
      }
      continue;
    }

    // 날짜 컬럼 누락 여부 자동 감지:
    // 1) 헤더 행에서 날짜 컬럼이 없었거나,
    // 2) 첫 번째 컬럼이 날짜 형식이 아니고 두 번째 컬럼이 금액(숫자) 형식인 경우
    // -> 날짜 칸을 공백('')으로 채워 내용/금액/카테고리가 밀리지 않도록 자동 보정
    const isMissingDate =
      tableMissingDateHeader ||
      (!isDateLike(cols[0]) && isAmountLike(cols[1]));

    if (isMissingDate) {
      cols = ['', ...cols];
    }

    rowIndex++;

    // Extract columns according to user specification:
    // 0: 날짜, 1: 내용, 2: 금액, 3: 대분류, 4: 소분류, 5: 지출 방법, 6: 태그, 7: 메모
    const rawDate = cols[0] || '';
    const rawContent = cols[1] || '';
    const rawAmount = cols[2] || '';
    const rawMainCategory = cols[3] || '';
    const rawSubCategory = cols[4] || '';
    const rawPayment = cols[5] || '';
    const rawTag = cols[6] || '';
    const rawMemo = cols[7] || '';

    // 1. Date normalization (handling null -> defaultMonth)
    const { dateStr, isMonthFallback } = normalizeBulkDate(rawDate, defaultMonth);

    // 2. Amount parsing
    const cleanDigits = rawAmount.replace(/[^0-9]/g, '');
    const amount = parseInt(cleanDigits, 10) || 0;

    // Check if explicit deposit or income sign
    const isExplicitPlus = rawAmount.includes('+') || rawAmount.includes('입금');
    let type: 'PAYMENT' | 'DEPOSIT' | 'WITHDRAWAL' | 'CANCEL' = 'PAYMENT';

    // 3. Category handling & Financial transaction type resolution
    let mainCategory = rawMainCategory.trim();
    const subCategory = rawSubCategory.trim();
    const content = rawContent.trim();

    if (mainCategory || subCategory || content) {
      const catContext = resolveCategoryWithContext(
        mainCategory,
        subCategory,
        content,
        categories
      );
      mainCategory = catContext.name;
      if (isExplicitPlus) {
        type = 'DEPOSIT';
      } else {
        type = catContext.txType;
      }
    } else if (isExplicitPlus) {
      type = 'DEPOSIT';
    }

    // 4. Payment method matching
    const payment = matchPaymentMethod(rawPayment);
    const paymentMethod = rawPayment.trim() || payment.name;
    const sourceApp = payment.code;
    const cardOrAccount = rawPayment.trim() || payment.name;

    // 5. Tag & Memo
    const tag = rawTag.trim();
    const memo = rawMemo.trim();

    // 6. Content & Title
    const title = `[가계부] ${content || subCategory || mainCategory || '거래'}`;

    // Format content with [소분류], 태그, 메모
    const subTagStr = subCategory ? `[${subCategory}] ` : '';
    const tagStr = tag ? ` (태그: ${tag})` : '';
    const memoStr = memo ? ` - ${memo}` : '';
    const formattedContent = `[가계부 대량 등록] ${subTagStr}${content}${tagStr}${memoStr}`.trim();

    // Validation
    let isValid = true;
    let error: string | undefined;

    if (amount <= 0) {
      isValid = false;
      error = '금액이 올바르지 않습니다 (0원 이하)';
    }

    rows.push({
      index: rowIndex,
      rawLine: line,
      dateStr,
      isMonthFallback,
      content,
      amount,
      mainCategory,
      subCategory,
      paymentMethod,
      tag,
      memo,
      type,
      sourceApp,
      cardOrAccount,
      title,
      formattedContent,
      isValid,
      error,
    });
  }

  // Mark duplicate rows
  const markedRows = markDuplicateRows(rows, existingTransactions);

  let totalExpense = 0;
  let totalIncome = 0;
  let totalSavings = 0;
  let totalTransfer = 0;

  for (const r of markedRows) {
    if (r.isValid && !r.isDuplicate) {
      if (r.type === 'DEPOSIT') {
        totalIncome += r.amount;
      } else if (r.mainCategory === '저축' || r.mainCategory === '투자/자산증식') {
        totalSavings += r.amount;
      } else if (r.mainCategory === '이체/송금' || r.type === 'WITHDRAWAL') {
        totalTransfer += r.amount;
      } else {
        totalExpense += r.amount;
      }
    }
  }

  const validCount = markedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateCount = markedRows.filter((r) => r.isDuplicate).length;
  const invalidCount = markedRows.filter((r) => !r.isValid).length;

  return {
    rows: markedRows,
    totalCount: markedRows.length,
    validCount,
    invalidCount,
    duplicateCount,
    totalExpense,
    totalIncome,
    totalSavings,
    totalTransfer,
    defaultMonth,
  };
}
