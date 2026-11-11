import type { Transaction } from '@/components/ledger/ledger-types';

export function kstDatetime(value: string | Date = new Date()) {
  return new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function defaultTransactionDate(month?: string, entryDate?: string): string {
  if (entryDate && (!month || entryDate.slice(0, 7) === month)) {
    return entryDate;
  }
  const today = kstDatetime().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return today;
  }
  if (month === currentMonth) {
    return today;
  }
  return `${month}-01`;
}

export function transactionDraft(item?: Transaction, copy = false, defaultDate?: string) {
  const fallbackDate = defaultDate || kstDatetime().slice(0, 10);
  return {
    notifiedAt: item && !copy ? kstDatetime(item.notifiedAt).slice(0, 10) : fallbackDate,
    merchant: item?.merchant || item?.title || '',
    category: item?.category || '',
    type: item?.type || 'PAYMENT',
    amount: item ? String(item.amount) : '',
    sourceApp: item?.sourceApp || 'MANUAL',
    cardOrAccount: item?.cardOrAccount || '',
    content: item?.content || '',
  };
}

export type TransactionDraft = ReturnType<typeof transactionDraft>;

export function transactionEntryPayload(draft: TransactionDraft, item?: Transaction) {
  const rawAmount = draft.amount.replace(/,/g, '').trim();
  const amount = Number(rawAmount);
  if (!/^\d+$/.test(rawAmount) || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('0보다 큰 올바른 금액을 입력해 주세요.');
  }
  if (!draft.merchant.trim()) throw new Error('사용처를 입력해 주세요.');
  const localDateTime = draft.notifiedAt.length === 10 ? `${draft.notifiedAt}T12:00` : draft.notifiedAt;
  const date = new Date(`${localDateTime}:00+09:00`);
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(draft.notifiedAt) || Number.isNaN(date.getTime()) || kstDatetime(date) !== localDateTime) throw new Error('올바른 일시를 입력해 주세요.');
  return {
    ...draft,
    amount,
    merchant: draft.merchant.trim(),
    category: draft.category || null,
    cardOrAccount: draft.cardOrAccount.trim() || null,
    content: draft.content.trim(),
    // Editing another field must not truncate the original seconds.
    notifiedAt: item && draft.notifiedAt === kstDatetime(item.notifiedAt).slice(0, 10) ? item.notifiedAt : date.toISOString(),
  };
}
