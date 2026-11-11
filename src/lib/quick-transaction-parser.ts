import {
  resolveCategoryInfo,
  HouseholdCategory,
  autoDetectCategory,
} from './household-categories';


export interface PaymentMethodOption {
  code: string;
  name: string;
  aliases: string[];
  emoji: string;
  badgeBg: string;
  color: string;
  desc: string;
}

export const QUICK_PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    code: 'WOORI_CARD',
    name: '우리카드',
    aliases: ['우리카드', '우리', '카드', '신용카드', '체크카드', 'woori'],
    emoji: '💳',
    badgeBg: '#1976d2',
    color: '#ffffff',
    desc: '신용/체크카드 결제',
  },
  {
    code: 'TOSS_BANK',
    name: '토스뱅크',
    aliases: ['토스뱅크', '토스', '토뱅', '토스카드', 'toss'],
    emoji: '💙',
    badgeBg: '#0064FF',
    color: '#ffffff',
    desc: '토스뱅크 카드/통장',
  },
  {
    code: 'KAKAO_PAY',
    name: '카카오페이',
    aliases: ['카카오페이', '카페', '페이', '카페이', 'kakaopay'],
    emoji: '💛',
    badgeBg: '#fee500',
    color: '#181600',
    desc: '머니/카드 결제',
  },
  {
    code: 'KAKAO_BANK',
    name: '카카오뱅크',
    aliases: ['카카오뱅크', '카뱅', 'kakaobank'],
    emoji: '🦁',
    badgeBg: '#ffe600',
    color: '#000000',
    desc: '체크카드/계좌',
  },
  {
    code: 'WOORI_WON',
    name: '우리WON',
    aliases: ['우리WON', '우리원', '우리won', '우리은행', 'won'],
    emoji: '🏦',
    badgeBg: '#0288d1',
    color: '#ffffff',
    desc: '우리은행 입출금',
  },
  {
    code: 'SMS',
    name: '현금/SMS',
    aliases: ['현금', 'sms', 'SMS', '문자', '기타', '현금영수증'],
    emoji: '💵',
    badgeBg: '#607d8b',
    color: '#ffffff',
    desc: '현금/문자 내역',
  },
];

export interface QuickPreset {
  paymentName: string;
  paymentCode: string;
  mainCategory: string;
  subCategory: string;
  emoji?: string;
}

export const DEFAULT_QUICK_PRESETS: QuickPreset[] = [
  { paymentName: '우리카드', paymentCode: 'WOORI_CARD', mainCategory: '식비', subCategory: '외식', emoji: '🍽️' },
  { paymentName: '우리카드', paymentCode: 'WOORI_CARD', mainCategory: '생활용품', subCategory: '생필품', emoji: '🛒' },
  { paymentName: '토스뱅크', paymentCode: 'TOSS_BANK', mainCategory: '카페/간식', subCategory: '카페/음료', emoji: '☕' },
  { paymentName: '우리WON', paymentCode: 'WOORI_WON', mainCategory: '주거비', subCategory: '관리비', emoji: '🏠' },
  { paymentName: '카카오페이', paymentCode: 'KAKAO_PAY', mainCategory: '교통비', subCategory: '대중교통', emoji: '🚌' },
];

export interface ParsedQuickTransaction {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  sourceApp: string; // WOORI_CARD, etc.
  paymentName: string;
  category: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  merchant: string | null;
  amount: number;
  type: 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT' | 'CANCEL';
  title: string;
  content: string;
  isValid: boolean;
  error?: string;
  rawParts: string[];
}

/**
 * Format a Date to 'YYYY-MM-DD'
 */
export function formatDateToYMD(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Get date with relative offset (0 = today, -1 = yesterday, -2 = 2 days ago)
 */
export function getRelativeDateYMD(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDateToYMD(d);
}

/**
 * Smart Date Parser: handles YYYY-MM-DD, YYYY.MM.DD, MM-DD, 오늘, 어제, etc.
 */
export function parseQuickDate(rawDateStr?: string | null): { date: Date; dateStr: string } {
  const now = new Date();
  const trimmed = (rawDateStr || '').trim();

  if (!trimmed || trimmed === '오늘') {
    return { date: now, dateStr: formatDateToYMD(now) };
  }
  if (trimmed === '어제') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return { date: d, dateStr: formatDateToYMD(d) };
  }
  if (trimmed === '그저께' || trimmed === '그제' || trimmed === '2일전') {
    const d = new Date(now);
    d.setDate(d.getDate() - 2);
    return { date: d, dateStr: formatDateToYMD(d) };
  }

  // Check YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const fullMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (fullMatch) {
    const y = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10) - 1;
    const day = parseInt(fullMatch[3], 10);
    const d = new Date(y, m, day, now.getHours(), now.getMinutes(), now.getSeconds());
    return { date: d, dateStr: formatDateToYMD(d) };
  }

  // Check MM-DD or MM.DD or MM/DD
  const shortMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})/);
  if (shortMatch) {
    const m = parseInt(shortMatch[1], 10) - 1;
    const day = parseInt(shortMatch[2], 10);
    const d = new Date(now.getFullYear(), m, day, now.getHours(), now.getMinutes(), now.getSeconds());
    return { date: d, dateStr: formatDateToYMD(d) };
  }

  // Fallback to today
  return { date: now, dateStr: formatDateToYMD(now) };
}

/**
 * Match a raw string to known Payment Method
 */
export function matchPaymentMethod(raw?: string | null): PaymentMethodOption {
  if (!raw) return QUICK_PAYMENT_METHODS[0]; // Default: WOORI_CARD
  const clean = raw.trim().toLowerCase();

  // 1. Exact match on name, code, or alias
  for (const pm of QUICK_PAYMENT_METHODS) {
    if (pm.name.toLowerCase() === clean || pm.code.toLowerCase() === clean) {
      return pm;
    }
    if (pm.aliases.some((alias) => alias.toLowerCase() === clean)) {
      return pm;
    }
  }

  // 2. Partial match preferring longest alias
  let bestMatch: PaymentMethodOption | null = null;
  let maxAliasLen = 0;

  for (const pm of QUICK_PAYMENT_METHODS) {
    for (const alias of pm.aliases) {
      const aLower = alias.toLowerCase();
      if (clean.includes(aLower) && aLower.length > maxAliasLen) {
        bestMatch = pm;
        maxAliasLen = aLower.length;
      }
    }
  }

  return bestMatch || QUICK_PAYMENT_METHODS[0];
}

/**
 * Parse comma-separated quick input string
 * Format: [날짜], [결제방식], [대분류], [소분류], [내용/사용처], [금액] (6 slots)
 * Also supports 5 slots: [날짜], [결제방식], [대분류], [내용/사용처], [금액]
 */
export function parseQuickTransactionInput(
  rawInput: string,
  customCategories?: HouseholdCategory[]
): ParsedQuickTransaction {
  const parts = rawInput.split(',').map((p) => p.trim());

  let rawDate = '';
  let rawPayment = '';
  let rawMainCategory = '';
  let rawSubCategory = '';
  let rawMerchant = '';
  let rawAmount = '';

  if (parts.length >= 6) {
    rawDate = parts[0];
    rawPayment = parts[1];
    rawMainCategory = parts[2];
    rawSubCategory = parts[3];
    rawMerchant = parts[4];
    rawAmount = parts[5];
  } else if (parts.length === 5) {
    rawDate = parts[0];
    rawPayment = parts[1];
    rawMainCategory = parts[2];
    // Check if parts[3] is recognized subcategory of parts[2]
    const resolvedCat = resolveCategoryInfo(parts[2], customCategories);
    const isSub = resolvedCat.id !== 'OTHER' && (resolvedCat as any).subcategories?.includes(parts[3]);
    if (isSub) {
      rawSubCategory = parts[3];
      rawMerchant = '';
      rawAmount = parts[4];
    } else {
      rawSubCategory = '';
      rawMerchant = parts[3];
      rawAmount = parts[4];
    }
  } else if (parts.length === 4) {
    rawDate = parts[0];
    rawPayment = parts[1];
    // Check if parts[2] is a recognized category
    const isCategory = resolveCategoryInfo(parts[2], customCategories).id !== 'OTHER';
    if (isCategory) {
      rawMainCategory = parts[2];
      rawAmount = parts[3];
    } else {
      rawMerchant = parts[2];
      rawAmount = parts[3];
    }
  } else if (parts.length === 3) {
    rawDate = parts[0];
    rawPayment = parts[1];
    rawAmount = parts[2];
  } else if (parts.length === 2) {
    rawDate = parts[0];
    rawAmount = parts[1];
  } else if (parts.length === 1) {
    rawAmount = parts[0];
  }

  // 1. Date
  const { date, dateStr } = parseQuickDate(rawDate);

  // 2. Payment Method
  const payment = matchPaymentMethod(rawPayment);

  // 3. Amount & Type
  const cleanDigits = rawAmount.replace(/[^0-9]/g, '');
  const amount = parseInt(cleanDigits, 10) || 0;

  // Type: check if deposit
  const isDepositExplicit = rawAmount.includes('+') || rawAmount.includes('입금');
  let type: 'PAYMENT' | 'WITHDRAWAL' | 'DEPOSIT' | 'CANCEL' = isDepositExplicit ? 'DEPOSIT' : 'PAYMENT';

  // 4. Main Category & Sub Category
  let mainCategory: string | null = null;
  let subCategory: string | null = rawSubCategory ? rawSubCategory.trim() : null;

  if (rawMainCategory) {
    const resolved = resolveCategoryInfo(rawMainCategory, customCategories);
    mainCategory = resolved.name;
    if (resolved.type === 'INCOME') {
      type = 'DEPOSIT';
    }
  }

  // 5. Merchant & Content
  const merchant = rawMerchant ? rawMerchant.trim() : null;

  // If category is not set, try auto-detection from merchant
  if (!mainCategory && merchant) {
    const autoCatCode = autoDetectCategory(merchant);
    if (autoCatCode && autoCatCode !== 'OTHER') {
      const autoInfo = resolveCategoryInfo(autoCatCode, customCategories);
      mainCategory = autoInfo.name;
    }
  }

  // Validation
  const isValid = amount > 0;
  const error = !rawInput.trim()
    ? '거래 내역을 입력해주세요.'
    : amount <= 0
    ? '올바른 금액을 입력해주세요.'
    : undefined;

  const typeLabel = type === 'DEPOSIT' ? '입금' : '결제';
  const memoSub = subCategory ? `[${subCategory}] ` : '';
  const title = `[가계부] ${merchant || (subCategory ? `${subCategory} ` : '') + typeLabel}`;
  const content = `[가계부 간편 등록] ${memoSub}${merchant ? merchant + ' ' : ''}${amount.toLocaleString()}원 ${typeLabel}`;

  return {
    date,
    dateStr,
    sourceApp: payment.code,
    paymentName: payment.name,
    category: mainCategory,
    mainCategory,
    subCategory,
    merchant,
    amount,
    type,
    title,
    content,
    isValid,
    error,
    rawParts: parts,
  };
}

/**
 * Determine which slot the cursor is currently in (0 to 5)
 */
export function getSlotAtCursor(text: string, cursorPos: number): number {
  const before = text.slice(0, cursorPos);
  const commas = before.split(',').length - 1;
  return Math.min(Math.max(commas, 0), 5);
}

/**
 * Get character index range for a slot index
 */
export function getSlotRange(text: string, slotIndex: number): { start: number; end: number } {
  const parts = text.split(',');
  let start = 0;
  for (let i = 0; i < slotIndex; i++) {
    start += (parts[i]?.length || 0) + 1; // +1 for comma
  }
  // Skip leading space in slot
  while (start < text.length && text[start] === ' ') {
    start++;
  }
  const end = slotIndex < parts.length ? start + (parts[slotIndex]?.trim()?.length || 0) : text.length;
  return { start, end };
}

/**
 * Replace a slot value in the comma-separated string
 */
export function replaceSlotValue(
  text: string,
  slotIndex: number,
  newValue: string,
  appendTrailingComma = true
): { newText: string; newCursorPos: number } {
  const parts = text.split(',');

  while (parts.length <= slotIndex) {
    parts.push(' ');
  }

  const prefix = slotIndex > 0 ? ' ' : '';
  parts[slotIndex] = prefix + newValue.trim();

  // If appendTrailingComma and this is not the last slot, ensure next slot exists
  if (appendTrailingComma && slotIndex < 5) {
    if (parts.length <= slotIndex + 1) {
      parts.push(' ');
    } else if (parts[slotIndex + 1] === '') {
      parts[slotIndex + 1] = ' ';
    }
  }

  const newText = parts.join(',');

  // Calculate cursor position: right after the comma following slotIndex
  let newCursorPos = 0;
  for (let i = 0; i <= slotIndex; i++) {
    newCursorPos += (parts[i]?.length || 0) + 1;
  }
  // Advance 1 space into next slot if present
  if (appendTrailingComma && slotIndex < 5 && newText[newCursorPos] === ' ') {
    newCursorPos++;
  }

  return { newText, newCursorPos: Math.min(newCursorPos, newText.length) };
}
