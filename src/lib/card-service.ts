import { kstDate, matchesFixedPayment, SCHEDULED_FIXED_PACKAGE, recognizedTransactionsWhere } from '@/lib/fixed-expense-schedule';
import { prisma } from './db';
import { getHouseholdCategories } from './household-categories-server';

export const SLACK_WEBHOOK_URL = process.env.SLACK_CARD_WEBHOOK_URL || '';

import {
  TRANSACTION_CATEGORIES,
  type TransactionCategoryCode,
  getCategoryInfo,
  autoDetectCategory,
  classifyTransactionRole,
} from './household-categories';

export {
  TRANSACTION_CATEGORIES,
  type TransactionCategoryCode,
  getCategoryInfo,
  autoDetectCategory,
  classifyTransactionRole,
};



export interface CardTransactionInput {
  sourceApp: string; // "WOORI_CARD", "WOORI_WON", "KAKAO_PAY", "KAKAO_BANK", "TOSS_BANK", "SMS", "OTHER"
  type: string; // "PAYMENT", "DEPOSIT", "WITHDRAWAL", "CANCEL", "OTHER"
  amount: number;
  merchant?: string | null;
  category?: string | null;
  title: string;
  content: string;
  balance?: number | null;
  cardOrAccount?: string | null;
  packageName?: string | null;
  notifiedAt: string | Date;
  isReported?: boolean;
  reportedAt?: string | Date | null;
  rawData?: Record<string, unknown> | null;
}

/**
 * 전각/반각 문자 시각적 폭(visual width) 계산 함수 (한글 2칸, 영문/숫자 1칸)
 */
export function getVisualWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0x3130 && code <= 0x318f) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xff01 && code <= 0xff60)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * 시각적 폭에 맞춰 패딩을 부여하는 함수
 */
export function padVisual(str: string, targetWidth: number, alignRight = false): string {
  const currentWidth = getVisualWidth(str);
  if (currentWidth >= targetWidth) return str;
  const padding = ' '.repeat(targetWidth - currentWidth);
  return alignRight ? padding + str : str + padding;
}

/**
 * 텍스트 게이지 바 생성 (예: ████░░░░░░ 40%)
 */
export function makeProgressBar(ratio: number, totalSlots = 8): string {
  const clamped = Math.min(1, Math.max(0, ratio));
  const filledSlots = Math.round(clamped * totalSlots);
  const emptySlots = totalSlots - filledSlots;
  return '█'.repeat(filledSlots) + '░'.repeat(emptySlots);
}

/**
 * 앱/금융사 표시명 매핑
 */
export function getSourceAppLabel(sourceApp: string): string {
  switch (sourceApp.toUpperCase()) {
    case 'WOORI_CARD':
      return '우리카드';
    case 'WOORI_WON':
      return '우리WON';
    case 'KAKAO_PAY':
      return '카카오페이';
    case 'KAKAO_BANK':
      return '카카오뱅크';
    case 'TOSS_BANK':
    case 'TOSS':
      return '토스뱅크';
    case 'SMS':
      return '문자(SMS)';
    default:
      return sourceApp;
  }
}

/**
 * 거래 유형 한글 라벨 매핑
 */
export function getTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case 'PAYMENT':
      return '결제';
    case 'DEPOSIT':
      return '입금';
    case 'WITHDRAWAL':
      return '출금';
    case 'CANCEL':
      return '취소';
    default:
      return type;
  }
}

/**
 * 카드/계좌 거래 내역 저장 (중복 방지 및 스마트 카테고리 태깅 포함)
 */
export async function saveCardTransaction(input: CardTransactionInput) {
  const notifiedAtDate = new Date(input.notifiedAt);
  // Explicit manual entries may have identical values. Retry the same entry safely,
  // while keeping notification deduplication for existing ingestion clients.
  const manualEntryId = input.rawData?.manual === true && typeof input.rawData.entryId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.rawData.entryId)
    ? input.rawData.entryId : null;

  // 최근 60초 이내에 동일 앱, 동일 금액, 동일 내용의 알림이 인입된 경우 중복 저장 방지
  const duplicateWindowStart = new Date(notifiedAtDate.getTime() - 60_000);
  const duplicateWindowEnd = new Date(notifiedAtDate.getTime() + 60_000);

  // 🛡️ 잔액 오인 전송 방어 로직:
  // 클라이언트에서 amount와 balance가 동일하게 전송되었거나 content에 '잔액 {amount}원'이 포함되어 있고
  // title/content에 별도의 명시적 거래 금액(예: "카드 결제 13,000원", "입금 200,000원")이 존재하는 경우 올바른 금액으로 보정
  let correctedAmount = Math.round(input.amount);
  const correctedBalance = input.balance != null ? Math.round(input.balance) : null;

  const fullText = `${input.title || ''} ${input.content || ''}`;
  const actionAmountMatch =
    fullText.match(/(?:카드\s*결제|체크카드\s*결제|신용카드\s*결제|체크\s*결제|결제|승인|출금|체크출금|입금|이체|송금|사용)\s+([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원/) ||
    fullText.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원\s*(?:결제|출금|체크출금|입금|승인|이체|송금|사용|일시불)/);

  if (actionAmountMatch && !manualEntryId) {
    const parsedActionAmount = parseInt(actionAmountMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(parsedActionAmount) && parsedActionAmount > 0) {
      const isMistakenBalance =
        correctedAmount === correctedBalance ||
        fullText.includes(`잔액 ${correctedAmount.toLocaleString()}`) ||
        fullText.includes(`잔액 ${correctedAmount}`) ||
        fullText.includes(`잔액:${correctedAmount}`) ||
        fullText.includes(`잔액 : ${correctedAmount}`);

      if (isMistakenBalance) {
        correctedAmount = parsedActionAmount;
      }
    }
  }

  // 카테고리가 전달되지 않은 경우 자동 추론 적용
  const finalCategory =
    input.category?.trim() || autoDetectCategory(input.merchant, input.title, input.content);

  let isDuplicate = false;
  const transaction = await prisma.$transaction(async db => {
    if (manualEntryId) await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`manual-entry:${manualEntryId}`}))`;
    const month = kstDate(notifiedAtDate).slice(0, 7);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const existing = await db.cardTransaction.findFirst({ where: manualEntryId ? {
      rawData: { path: ['entryId'], equals: manualEntryId },
    } : {
      sourceApp: input.sourceApp, amount: correctedAmount, content: input.content.trim(),
      notifiedAt: { gte: duplicateWindowStart, lte: duplicateWindowEnd },
      OR: [{ packageName: null }, { packageName: { not: SCHEDULED_FIXED_PACKAGE } }],
    } });
    if (existing) { isDuplicate = true; return existing; }
    const data = {
      sourceApp: input.sourceApp,
      type: input.type,
      amount: correctedAmount,
      merchant: input.merchant?.trim() || null,
      category: finalCategory,
      title: input.title.trim(),
      content: input.content.trim(),
      balance: correctedBalance,
      cardOrAccount: input.cardOrAccount?.trim() || null,
      packageName: input.packageName?.trim() || null,
      notifiedAt: notifiedAtDate,
      isReported: Boolean(input.isReported ?? false),
      reportedAt: input.isReported ? (input.reportedAt ? new Date(input.reportedAt) : new Date()) : null,
      rawData: (input.rawData as any) || null,
    };
    const due = new Date(`${kstDate(notifiedAtDate)}T00:00:00+09:00`);
    const pending = await db.cardTransaction.findMany({ where: { packageName: SCHEDULED_FIXED_PACKAGE, scheduledFor: due, amount: correctedAmount } });
    const matches = pending.filter(tx => {
      const metadata = tx.rawData as { fixedExpenseKeyword?: string } | null;
      return matchesFixedPayment({ name: tx.merchant || tx.title, amount: tx.amount, merchantKeyword: metadata?.fixedExpenseKeyword }, kstDate(due), { ...data, notifiedAt: notifiedAtDate });
    });
    if (matches.length === 1) {
      return db.cardTransaction.update({ where: { id: matches[0].id }, data: { ...data, category: input.category?.trim() || matches[0].category, isReported: matches[0].isReported || data.isReported, reportedAt: matches[0].reportedAt || data.reportedAt } });
    }
    return db.cardTransaction.create({ data });
  });

  return {
    transaction,
    isDuplicate,
  };
}

/**
 * 트랜잭션 목록을 Slack용 Table 및 | 구분 CSV 포맷 텍스트로 변환
 */
export function formatTransactionsToTable(
  transactions: Array<{
    notifiedAt: Date | string;
    sourceApp: string;
    type: string;
    amount: number;
    merchant: string | null;
    category?: string | null;
    balance: number | null;
    cardOrAccount: string | null;
  }>
): string {
  if (transactions.length === 0) {
    return '신규 거래 내역이 없습니다.';
  }

  // 컬럼 헤더: 일시(11) | 금융/앱(8) | 분류(7) | 구분(4) | 사용처/내용(16) | 금액(12) | 잔액(12)
  const header = `| 일시        | 앱/금융 | 카테고리 | 구분 | 사용처/내용      |     금액(원) |     잔액(원) |`;
  const separator = `|-------------|---------|----------|------|------------------|--------------|--------------|`;

  const rows = transactions.map((tx) => {
    const d = new Date(tx.notifiedAt);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${mm}-${dd} ${hh}:${min}`;

    const appLabel = getSourceAppLabel(tx.sourceApp);
    const catLabel = getCategoryInfo(tx.category).label;
    const typeLabel = getTypeLabel(tx.type);
    const merchantStr = (tx.merchant || tx.cardOrAccount || '-').slice(0, 16);
    const amountStr = `${tx.type === 'CANCEL' ? '-' : ''}${tx.amount.toLocaleString()}`;
    const balanceStr = tx.balance != null ? tx.balance.toLocaleString() : '-';

    const colTime = padVisual(timeStr, 11);
    const colApp = padVisual(appLabel, 8);
    const colCat = padVisual(catLabel, 8);
    const colType = padVisual(typeLabel, 4);
    const colMerchant = padVisual(merchantStr, 16);
    const colAmount = padVisual(amountStr, 12, true);
    const colBalance = padVisual(balanceStr, 12, true);

    return `| ${colTime} | ${colApp} | ${colCat} | ${colType} | ${colMerchant} | ${colAmount} | ${colBalance} |`;
  });

  return [header, separator, ...rows].join('\n');
}

/**
 * 일일 집계 요약을 단백한 텍스트 포맷으로 생성
 * 형식:
 * 2026. 09. 29.
 * 총 지출 16,000원 (2건)
 *   - 토스뱅크, 식비, 솥내음, ₩13,000
 *   - 토스뱅크, 식비, 핸디엄, ₩3,000
 * 총 수입 13,000원 (1건)
 *   - 클라이언트(주), 용역비, ₩13,000원
 */
export function formatDailyCardReportText(
  transactions: Array<{
    sourceApp: string;
    type: string;
    amount: number;
    merchant?: string | null;
    category?: string | null;
    title?: string | null;
    content?: string | null;
    cardOrAccount?: string | null;
    notifiedAt: Date | string;
  }>,
  targetDate?: string // YYYY-MM-DD
): string {
  // 날짜 계산 (KST 기준)
  let dateHeader = '';
  if (targetDate) {
    const parts = targetDate.split('-');
    if (parts.length === 3) {
      dateHeader = `${parts[0]}. ${parts[1]}. ${parts[2]}.`;
    }
  }
  if (!dateHeader) {
    const refDate = transactions.length > 0 ? new Date(transactions[0].notifiedAt) : new Date();
    const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateHeader = kstFormatter.format(refDate).trim();
    if (!dateHeader.endsWith('.')) {
      dateHeader += '.';
    }
  }

  // 지출 및 수입 분류
  const expenseTxs = transactions.filter(
    (t) => t.type === 'PAYMENT' || t.type === 'WITHDRAWAL' || t.type === 'CANCEL'
  );
  const depositTxs = transactions.filter((t) => t.type === 'DEPOSIT');

  let netExpense = 0;
  for (const t of expenseTxs) {
    if (t.type === 'CANCEL') {
      netExpense -= t.amount;
    } else {
      netExpense += t.amount;
    }
  }
  if (netExpense < 0) netExpense = 0;

  let totalDeposit = 0;
  for (const t of depositTxs) {
    totalDeposit += t.amount;
  }

  const lines: string[] = [dateHeader];

  // 총 지출 섹션
  lines.push(`총 지출 ${netExpense.toLocaleString()} (${expenseTxs.length}건)`);
  for (const tx of expenseTxs) {
    const appLabel = getSourceAppLabel(tx.sourceApp);
    const catLabel = getCategoryInfo(tx.category || autoDetectCategory(tx.merchant, tx.title, tx.content)).label;
    let merchant = (tx.merchant?.trim() || tx.cardOrAccount?.trim() || tx.title?.trim() || '사용처 미상');
    if (tx.type === 'CANCEL') {
      merchant += ' (취소)';
      lines.push(`  - ${appLabel}, ${catLabel}, ${merchant}, -${tx.amount.toLocaleString()}`);
    } else {
      lines.push(`  - ${appLabel}, ${catLabel}, ${merchant}, ${tx.amount.toLocaleString()}`);
    }
  }

  // 총 수입 섹션
  lines.push(`총 수입 ${totalDeposit.toLocaleString()} (${depositTxs.length}건)`);
  for (const tx of depositTxs) {
    const catLabel = getCategoryInfo(tx.category || autoDetectCategory(tx.merchant, tx.title, tx.content)).label;
    const depositSource = tx.merchant?.trim() || getSourceAppLabel(tx.sourceApp);
    lines.push(`  - ${depositSource}, ${catLabel}, ${tx.amount.toLocaleString()}`);
  }

  return lines.join('\n');
}

/**
 * Slack 일배치 리포트 전송 (단백한 텍스트 요약 포맷)
 */
export async function sendDailyCardReportToSlack(options?: {
  targetDate?: string; // YYYY-MM-DD
  forceAll?: boolean;
}) {
  if (!SLACK_WEBHOOK_URL) {
    return {
      success: false,
      status: 400,
      count: 0,
      totalPayment: 0,
      totalDeposit: 0,
      netPayment: 0,
      reportText: '',
      message: 'SLACK_CARD_WEBHOOK_URL이 설정되지 않아 리포트를 전송하지 않았습니다.',
    };
  }
  let whereClause: any = {};

  if (options?.targetDate) {
    const start = new Date(`${options.targetDate}T00:00:00+09:00`);
    const end = new Date(`${options.targetDate}T23:59:59.999+09:00`);
    whereClause.notifiedAt = { gte: start, lte: end };
    if (!options.forceAll) {
      whereClause.isReported = false;
    }
  } else {
    // 기본 모드: 아직 리포트되지 않은 전체 건
    whereClause.isReported = false;
  }

  const transactions = await prisma.cardTransaction.findMany({
    where: { AND: [whereClause, recognizedTransactionsWhere()] },
    orderBy: { notifiedAt: 'asc' },
  });

  const now = new Date();

  if (transactions.length === 0) {
    let emptyDateHeader = '';
    if (options?.targetDate) {
      const parts = options.targetDate.split('-');
      if (parts.length === 3) {
        emptyDateHeader = `${parts[0]}. ${parts[1]}. ${parts[2]}.`;
      }
    }
    if (!emptyDateHeader) {
      const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      emptyDateHeader = kstFormatter.format(now).trim();
      if (!emptyDateHeader.endsWith('.')) {
        emptyDateHeader += '.';
      }
    }

    const emptyText = `${emptyDateHeader}\n총 지출 0 (0건)\n총 수입 0 (0건)`;

    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: emptyText }),
    });

    return {
      success: res.ok,
      status: res.status,
      count: 0,
      totalPayment: 0,
      totalDeposit: 0,
      netPayment: 0,
      reportText: emptyText,
      message: '전송할 거래 내역이 없습니다.',
    };
  }

  // 지출 및 수입 집계
  let totalPayment = 0;
  let totalDeposit = 0;
  let totalCancel = 0;

  for (const tx of transactions) {
    if (tx.type === 'PAYMENT' || tx.type === 'WITHDRAWAL') {
      totalPayment += tx.amount;
    } else if (tx.type === 'DEPOSIT') {
      totalDeposit += tx.amount;
    } else if (tx.type === 'CANCEL') {
      totalCancel += tx.amount;
    }
  }

  const netPayment = Math.max(0, totalPayment - totalCancel);
  const reportText = formatDailyCardReportText(transactions, options?.targetDate);

  const slackPayload = {
    text: reportText,
  };

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Slack webhook error (${response.status}): ${responseText}`);
  }

  // 성공 시 해당 트랜잭션들 isReported = true, reportedAt = now 업데이트
  const ids = transactions.map((t) => t.id);
  await prisma.cardTransaction.updateMany({
    where: { id: { in: ids } },
    data: {
      isReported: true,
      reportedAt: now,
    },
  });

  return {
    success: true,
    count: transactions.length,
    netPayment,
    totalDeposit,
    reportText,
    ids,
  };
}

/**
 * 월간 카드/계좌 거래 리포트 데이터 생성 함수
 */
export async function generateMonthlyCardReportData(targetMonthStr?: string) {
  const { categories } = await getHouseholdCategories();
  // targetMonthStr: 'YYYY-MM' 형식 (지정하지 않으면 이번 달 KST 기준)
  let year: number;
  let month: number;

  if (targetMonthStr && /^\d{4}-\d{2}$/.test(targetMonthStr)) {
    const [yStr, mStr] = targetMonthStr.split('-');
    year = parseInt(yStr, 10);
    month = parseInt(mStr, 10);
  } else {
    const now = new Date();
    const kstYearMonth = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
    })
      .format(now)
      .replace(/\. /g, '-')
      .replace(/\./g, '');
    const [yStr, mStr] = kstYearMonth.split('-');
    year = parseInt(yStr, 10);
    month = parseInt(mStr, 10);
  }

  const padMonth = String(month).padStart(2, '0');
  const monthKey = `${year}-${padMonth}`;

  // 해당 월의 시작일과 종료일 계산 (KST 기준)
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const currentStart = new Date(`${year}-${padMonth}-01T00:00:00+09:00`);
  const currentEnd = new Date(`${year}-${padMonth}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59.999+09:00`);

  // 전월(MoM 비교 대상) 시작일과 종료일 계산
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const padPrevMonth = String(prevMonth).padStart(2, '0');
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevStart = new Date(`${prevYear}-${padPrevMonth}-01T00:00:00+09:00`);
  const prevEnd = new Date(`${prevYear}-${padPrevMonth}-${String(prevLastDay).padStart(2, '0')}T23:59:59.999+09:00`);

  // 당월 및 전월 데이터 병렬 조회
  const [currentTransactions, prevTransactions] = await Promise.all([
    prisma.cardTransaction.findMany({
      where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: currentStart, lte: currentEnd } },
      orderBy: { notifiedAt: 'asc' },
    }),
    prisma.cardTransaction.findMany({
      where: { ...recognizedTransactionsWhere(), notifiedAt: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  // 1. 당월 집계
  let currentPayment = 0; // 순수 소비 결제
  let currentWithdrawal = 0; // 순수 소비 출금
  let currentCancel = 0;
  let currentDeposit = 0;
  let currentSavings = 0; // 저축·투자
  let currentTransfer = 0; // 이체/카드대금
  let paymentTxCount = 0;
  let cancelTxCount = 0;
  let depositTxCount = 0;
  let savingsTxCount = 0;
  let transferTxCount = 0;

  // 카테고리별 집계 (순수 소비)
  const categoryStatsMap = new Map<string, { amount: number; count: number }>();
  // 가맹점(사용처)별 집계
  const merchantStatsMap = new Map<string, { amount: number; count: number }>();
  // 결제수단(앱)별 집계
  const appStatsMap = new Map<string, { amount: number; count: number }>();
  // 일별 지출 집계
  const dailySpendingMap = new Map<string, number>();
  // 주중 vs 주말 지출 집계
  let weekdaySpending = 0;
  let weekendSpending = 0;

  for (const tx of currentTransactions) {
    const role = classifyTransactionRole(tx, categories);
    const isCancel = tx.type === 'CANCEL';

    if (role === 'INCOME') {
      currentDeposit += tx.amount;
      depositTxCount++;
    } else if (role === 'SAVINGS') {
      currentSavings += tx.amount;
      savingsTxCount++;
    } else if (role === 'TRANSFER') {
      currentTransfer += tx.amount;
      transferTxCount++;
    } else if (isCancel) {
      currentCancel += tx.amount;
      cancelTxCount++;
    } else {
      // role === 'CONSUMPTION'
      if (tx.type === 'PAYMENT') {
        currentPayment += tx.amount;
      } else {
        currentWithdrawal += tx.amount;
      }
      paymentTxCount++;
    }

    // 순수 소비 및 취소 건 카테고리/가맹점/앱 집계 (저축 및 이체 제외)
    if (role === 'CONSUMPTION' || isCancel) {
      const netTxAmount = isCancel ? -tx.amount : tx.amount;

      // 카테고리
      const catCode = tx.category || autoDetectCategory(tx.merchant, tx.title, tx.content);
      const catEntry = categoryStatsMap.get(catCode) || { amount: 0, count: 0 };
      catEntry.amount += netTxAmount;
      if (!isCancel) catEntry.count += 1;
      categoryStatsMap.set(catCode, catEntry);

      // 가맹점
      const merchantName = (tx.merchant || tx.cardOrAccount || '기타/미상').trim();
      const mEntry = merchantStatsMap.get(merchantName) || { amount: 0, count: 0 };
      mEntry.amount += netTxAmount;
      if (!isCancel) mEntry.count += 1;
      merchantStatsMap.set(merchantName, mEntry);

      // 결제수단/앱
      const appName = tx.sourceApp;
      const appEntry = appStatsMap.get(appName) || { amount: 0, count: 0 };
      appEntry.amount += netTxAmount;
      if (!isCancel) appEntry.count += 1;
      appStatsMap.set(appName, appEntry);

      // 일별 및 주중/주말 집계
      const txDate = new Date(tx.notifiedAt);
      const dayKst = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        day: '2-digit',
      }).format(txDate);
      const dayOfWeek = txDate.getDay(); // 0: 일, 6: 토

      dailySpendingMap.set(dayKst, (dailySpendingMap.get(dayKst) || 0) + netTxAmount);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendSpending += netTxAmount;
      } else {
        weekdaySpending += netTxAmount;
      }
    }
  }

  // 순수 소비 지출 (저축·투자 및 이체 완전 제외)
  const currentNetExpense = Math.max(0, currentPayment + currentWithdrawal - currentCancel);

  // 2. 전월 집계 (MoM 비교 - 전월 역시 순수 소비 기준)
  let prevPayment = 0;
  let prevCancel = 0;
  for (const tx of prevTransactions) {
    const role = classifyTransactionRole(tx, categories);
    if (role === 'CONSUMPTION') {
      prevPayment += tx.amount;
    } else if (tx.type === 'CANCEL') {
      prevCancel += tx.amount;
    }
  }
  const prevNetExpense = Math.max(0, prevPayment - prevCancel);
  const momDiffAmount = currentNetExpense - prevNetExpense;
  const momDiffRate = prevNetExpense > 0 ? (momDiffAmount / prevNetExpense) * 100 : null;

  // 3. 일평균 지출액 계산
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const activeDays = isCurrentMonth ? Math.max(1, now.getDate()) : lastDayOfMonth;
  const dailyAverageExpense = Math.round(currentNetExpense / activeDays);

  // 4. 카테고리별 정렬 및 비율
  const categoryBreakdown = Array.from(categoryStatsMap.entries())
    .map(([code, stat]) => {
      const info = getCategoryInfo(code);
      const percentage = currentNetExpense > 0 ? Math.max(0, (stat.amount / currentNetExpense) * 100) : 0;
      return {
        code,
        label: info.label,
        emoji: info.emoji,
        amount: Math.max(0, stat.amount),
        count: stat.count,
        percentage: Number(percentage.toFixed(1)),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 5. Top 가맹점 5개
  const topMerchants = Array.from(merchantStatsMap.entries())
    .filter(([_, stat]) => stat.amount > 0)
    .map(([merchant, stat]) => {
      const percentage = currentNetExpense > 0 ? (stat.amount / currentNetExpense) * 100 : 0;
      return {
        merchant,
        amount: stat.amount,
        count: stat.count,
        percentage: Number(percentage.toFixed(1)),
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // 6. 결제수단별 비중
  const appBreakdown = Array.from(appStatsMap.entries())
    .filter(([_, stat]) => stat.amount > 0)
    .map(([sourceApp, stat]) => {
      const label = getSourceAppLabel(sourceApp);
      const percentage = currentNetExpense > 0 ? (stat.amount / currentNetExpense) * 100 : 0;
      return {
        sourceApp,
        label,
        amount: stat.amount,
        count: stat.count,
        percentage: Number(percentage.toFixed(1)),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 7. 피크 지출일
  let peakDay = '-';
  let peakDayAmount = 0;
  for (const [day, amount] of dailySpendingMap.entries()) {
    if (amount > peakDayAmount) {
      peakDayAmount = amount;
      peakDay = `${month}월 ${day}`;
    }
  }

  // 8. 주중 vs 주말 비중
  const totalAnalyzed = Math.max(0, weekdaySpending) + Math.max(0, weekendSpending);
  const weekdayRate = totalAnalyzed > 0 ? ((Math.max(0, weekdaySpending) / totalAnalyzed) * 100).toFixed(1) : '0.0';
  const weekendRate = totalAnalyzed > 0 ? ((Math.max(0, weekendSpending) / totalAnalyzed) * 100).toFixed(1) : '0.0';

  return {
    monthKey,
    year,
    month,
    periodLabel: `${year}년 ${month}월`,
    isCurrentMonth,
    activeDays,
    lastDayOfMonth,
    totalTransactions: currentTransactions.length,
    paymentTxCount,
    cancelTxCount,
    depositTxCount,
    currentPayment,
    currentWithdrawal,
    currentCancel,
    currentNetExpense, // 순수 소비 지출 (저축·투자 제외)
    consumptionExpense: currentNetExpense,
    currentDeposit, // 수입
    currentSavings, // 저축·투자 실적
    savingsAmount: currentSavings,
    savingsRate: currentDeposit > 0 ? Number(((currentSavings / currentDeposit) * 100).toFixed(1)) : 0,
    assetGrowth: currentDeposit - currentNetExpense, // 자산 순증가 (수입 - 소비)
    currentTransfer, // 이체/카드대금
    savingsTxCount,
    transferTxCount,
    prevNetExpense,
    momDiffAmount,
    momDiffRate: momDiffRate != null ? Number(momDiffRate.toFixed(1)) : null,
    dailyAverageExpense,
    categoryBreakdown,
    topMerchants,
    appBreakdown,
    peakDay: peakDayAmount > 0 ? { date: peakDay, amount: peakDayAmount } : null,
    spendingPattern: {
      weekdayAmount: Math.max(0, weekdaySpending),
      weekdayRate: Number(weekdayRate),
      weekendAmount: Math.max(0, weekendSpending),
      weekendRate: Number(weekendRate),
    },
    reportText: formatMonthlyCardReportText(year, month, currentTransactions),
    transactions: currentTransactions,
  };
}

/**
 * 월간 집계 요약을 단백한 텍스트 포맷으로 생성
 * 형식:
 * 2026. 09.
 * 총 지출 300,000원 (33건)
 *   - 토스뱅크, 식비, 솥내음, ₩13,000
 *   - ...
 * 총 수입 100000원 (1건) 
 *   - 클라이언트(주), 용역비, ₩13,000원
 */
export function formatMonthlyCardReportText(
  year: number,
  month: number,
  transactions: Array<{
    sourceApp: string;
    type: string;
    amount: number;
    merchant?: string | null;
    category?: string | null;
    title?: string | null;
    content?: string | null;
    cardOrAccount?: string | null;
    notifiedAt: Date | string;
  }>
): string {
  const padMonth = String(month).padStart(2, '0');
  const monthHeader = `${year}. ${padMonth}.`;

  const expenseTxs = transactions.filter(
    (t) => t.type === 'PAYMENT' || t.type === 'WITHDRAWAL' || t.type === 'CANCEL'
  );
  const depositTxs = transactions.filter((t) => t.type === 'DEPOSIT');

  let netExpense = 0;
  for (const t of expenseTxs) {
    if (t.type === 'CANCEL') {
      netExpense -= t.amount;
    } else {
      netExpense += t.amount;
    }
  }
  if (netExpense < 0) netExpense = 0;

  let totalDeposit = 0;
  for (const t of depositTxs) {
    totalDeposit += t.amount;
  }

  const lines: string[] = [monthHeader];

  // 총 지출 섹션
  lines.push(`총 지출 ${netExpense.toLocaleString()} (${expenseTxs.length}건)`);
  for (const tx of expenseTxs) {
    const appLabel = getSourceAppLabel(tx.sourceApp);
    const catLabel = getCategoryInfo(tx.category || autoDetectCategory(tx.merchant, tx.title, tx.content)).label;
    let merchant = (tx.merchant?.trim() || tx.cardOrAccount?.trim() || tx.title?.trim() || '사용처 미상');
    if (tx.type === 'CANCEL') {
      merchant += ' (취소)';
      lines.push(`  - ${appLabel}, ${catLabel}, ${merchant}, -${tx.amount.toLocaleString()}`);
    } else {
      lines.push(`  - ${appLabel}, ${catLabel}, ${merchant}, ${tx.amount.toLocaleString()}`);
    }
  }

  // 총 수입 섹션
  lines.push(`총 수입 ${totalDeposit.toLocaleString()} (${depositTxs.length}건)`);
  for (const tx of depositTxs) {
    const catLabel = getCategoryInfo(tx.category || autoDetectCategory(tx.merchant, tx.title, tx.content)).label;
    const depositSource = tx.merchant?.trim() || getSourceAppLabel(tx.sourceApp);
    lines.push(`  - ${depositSource}, ${catLabel}, ${tx.amount.toLocaleString()}`);
  }

  return lines.join('\n');
}

/**
 * Slack 월간 리포트 블록 빌드 (단백한 텍스트 포맷)
 */
export function buildMonthlySlackBlocks(report: Awaited<ReturnType<typeof generateMonthlyCardReportData>>) {
  return {
    text: report.reportText,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: report.reportText,
        },
      },
    ],
  };
}

/**
 * Slack 월간 리포트 발송 함수 (단백한 텍스트 포맷)
 */
export async function sendMonthlyCardReportToSlack(targetMonthStr?: string) {
  const report = await generateMonthlyCardReportData(targetMonthStr);
  if (!SLACK_WEBHOOK_URL) {
    return {
      success: false,
      monthKey: report.monthKey,
      periodLabel: report.periodLabel,
      currentNetExpense: report.currentNetExpense,
      totalTransactions: report.totalTransactions,
      reportText: report.reportText,
      report,
      message: 'SLACK_CARD_WEBHOOK_URL이 설정되지 않아 리포트를 전송하지 않았습니다.',
    };
  }
  const slackPayload = {
    text: report.reportText,
  };

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Slack webhook error (${response.status}): ${responseText}`);
  }

  return {
    success: true,
    monthKey: report.monthKey,
    periodLabel: report.periodLabel,
    currentNetExpense: report.currentNetExpense,
    totalTransactions: report.totalTransactions,
    reportText: report.reportText,
    report,
  };
}
