import type { FixedExpenseItem } from './fixed-expenses';

export const SCHEDULED_FIXED_PACKAGE = 'household.fixed-expense';
export const kstDate = (value: Date | string = new Date()) => new Date(new Date(value).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function validMonth(month: unknown): month is string {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 2000;
}
export function monthBounds(month: string) {
  if (!validMonth(month)) throw new Error('올바른 월을 선택해 주세요.');
  const [year, number] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { start: new Date(`${month}-01T00:00:00+09:00`), end: new Date(`${month}-${days}T23:59:59.999+09:00`), days };
}
/** Shared by ledger, calendar, statistics and Slack. Fixed expenses are recognized when checked. */
export function recognizedTransactionsWhere(_now = new Date()) {
  return {
    OR: [
      { scheduledFor: null },
      {
        scheduledFor: { not: null },
        rawData: {
          path: ['checked'],
          equals: true,
        },
      },
    ],
  };
}
export function isRecognized(tx: { scheduledFor?: string | Date | null; rawData?: any }, _now = new Date()) {
  if (!tx.scheduledFor) return true;
  if (!tx.rawData) return false;
  try {
    const raw = typeof tx.rawData === 'string' ? JSON.parse(tx.rawData) : tx.rawData;
    return raw?.checked === true;
  } catch {
    return false;
  }
}
export function scheduledDates(item: FixedExpenseItem, month: string, includeBeforeStart = false): string[] {
  const { days } = monthBounds(month);
  if (!item.isActive || !Number.isSafeInteger(item.amount) || item.amount <= 0) return [];
  const start = new Date(`${item.startDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime())) return [];
  const payDay = item.payDay === 'LAST_DAY' ? days : Math.min(days, Math.max(1, Number(item.payDay) || start.getUTCDate()));
  return Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(date => {
    if ((!includeBeforeStart && date < item.startDate) || (item.endDate && date > item.endDate)) return false;
    switch (item.cycle) {
      case 'MONTHLY': return Number(date.slice(-2)) === payDay;
      case 'YEARLY': return month.slice(5) === item.startDate.slice(5, 7) && Number(date.slice(-2)) === payDay;
      case 'WEEKLY': return (new Date(`${date}T00:00:00Z`).getTime() - start.getTime()) / 86400000 % 7 === 0;
      case 'DAILY': return true;
      default: return false;
    }
  });
}
export function normalizeFixedMerchant(name: string | null | undefined) {
  return (name || '').replace(/^세요\)\s*/, '').replace(/\s+/g, '').toLowerCase();
}
/** Exact names only: ambiguous or partial keyword matches require explicit linking. */
export function matchesFixedPayment(item: Pick<FixedExpenseItem, 'name' | 'merchantKeyword' | 'amount'>, date: string, tx: { merchant: string | null; amount: number; type: string; notifiedAt: Date | string }) {
  const name = normalizeFixedMerchant(tx.merchant);
  return ['PAYMENT', 'WITHDRAWAL', 'DEPOSIT'].includes(tx.type) && tx.amount === item.amount && kstDate(tx.notifiedAt) === date && !!name &&
    [item.name, item.merchantKeyword].some(value => !!value && normalizeFixedMerchant(value) === name);
}

export function fixedExpenseEdit(existing: { fixedExpenseId?: string | null; scheduledFor?: Date | null; packageName?: string | null }, edit: { notifiedAt?: Date; type?: string; amount?: number }) {
  if (edit.notifiedAt && !Number.isFinite(edit.notifiedAt.getTime())) throw new Error('올바른 일시를 입력해 주세요.');
  if (edit.amount !== undefined && (!Number.isSafeInteger(edit.amount) || edit.amount < 0)) throw new Error('올바른 금액을 입력해 주세요.');
  if (!existing.fixedExpenseId || !existing.scheduledFor) return {};
  if (edit.type && !['PAYMENT', 'WITHDRAWAL', 'DEPOSIT'].includes(edit.type)) throw new Error('고정비는 지출, 수입 또는 출금으로만 저장할 수 있습니다.');
  if (edit.notifiedAt && kstDate(edit.notifiedAt).slice(0, 7) !== kstDate(existing.scheduledFor).slice(0, 7)) throw new Error('고정비의 날짜는 해당 월 안에서 변경해 주세요.');
  return existing.packageName === SCHEDULED_FIXED_PACKAGE && edit.notifiedAt
    ? { scheduledFor: new Date(`${kstDate(edit.notifiedAt)}T12:00:00+09:00`) }
    : {};
}
