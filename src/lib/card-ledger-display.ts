export type LedgerSortField = 'received' | 'notified' | 'merchant' | 'category' | 'paymentMethod' | 'content' | 'amount' | 'balance';
export type LedgerSortOrder = 'asc' | 'desc';

interface LedgerSortItem {
  id: string;
  notifiedAt: string | Date;
  createdAt: string | Date;
  packageName?: string | null;
  merchant?: string | null;
  cardOrAccount?: string | null;
  sourceApp?: string | null;
  title?: string | null;
  category?: string | null;
  content?: string | null;
  amount?: number | null;
  balance?: number | null;
}

export function ledgerOrderBy(field: LedgerSortField, order: LedgerSortOrder) {
  if (field === 'category' || field === 'content') {
    return [{ [field]: order }, { notifiedAt: 'desc' as const }, { id: order }];
  }
  if (field === 'paymentMethod') {
    return [{ cardOrAccount: order }, { sourceApp: order }, { notifiedAt: 'desc' as const }, { id: order }];
  }
  if (field === 'merchant') {
    return [{ merchant: order }, { notifiedAt: 'desc' as const }, { id: order }];
  }
  if (field === 'amount') {
    return [{ amount: order }, { notifiedAt: 'desc' as const }, { id: order }];
  }
  if (field === 'balance') {
    return [{ balance: order }, { notifiedAt: 'desc' as const }, { id: order }];
  }
  return field === 'received'
    ? [{ createdAt: order }, { id: order }]
    : [{ notifiedAt: order }, { createdAt: order }, { id: order }];
}

export function formatLedgerMerchant(tx: {
  merchant?: string | null;
  cardOrAccount?: string | null;
  title?: string | null;
  packageName?: string | null;
  sourceApp?: string | null;
}): string {
  const base = (tx.merchant || tx.cardOrAccount || tx.title || '').replace(/세요\)\s*/g, '').trim();
  return base;
}

export function compareLedgerTransactions(a: LedgerSortItem, b: LedgerSortItem, field: LedgerSortField, order: LedgerSortOrder) {
  let result = 0;
  if (field === 'category') {
    result = (a.category ?? '').localeCompare(b.category ?? '', 'ko-KR');
  } else if (field === 'paymentMethod') {
    result = (a.cardOrAccount || a.sourceApp || '').localeCompare(b.cardOrAccount || b.sourceApp || '', 'ko-KR');
  } else if (field === 'content') {
    result = (a.content || a.title || '').localeCompare(b.content || b.title || '', 'ko-KR');
  } else if (field === 'merchant') {
    const mA = formatLedgerMerchant(a);
    const mB = formatLedgerMerchant(b);
    result = mA.localeCompare(mB, 'ko-KR');
  } else if (field === 'amount') {
    result = (a.amount ?? 0) - (b.amount ?? 0);
  } else if (field === 'balance') {
    const bA = a.balance ?? -Infinity;
    const bB = b.balance ?? -Infinity;
    result = bA - bB;
  } else if (field === 'received') {
    const tA = new Date(a.createdAt).getTime() || 0;
    const tB = new Date(b.createdAt).getTime() || 0;
    result = tA - tB;
  } else {
    // notified
    const nA = new Date(a.notifiedAt).getTime() || 0;
    const nB = new Date(b.notifiedAt).getTime() || 0;
    const rA = new Date(a.createdAt).getTime() || 0;
    const rB = new Date(b.createdAt).getTime() || 0;
    result = (nA - nB) || (rA - rB);
  }

  if (result === 0) {
    result = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }
  return order === 'asc' ? result : -result;
}

export function formatLedgerTimestamp(value: string | Date) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }),
    time: date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export function hasImportedPlaceholderTime(tx: LedgerSortItem) {
  const date = new Date(tx.notifiedAt);
  return tx.packageName === 'csv.household.import'
    && date.getUTCHours() === 3 && date.getUTCMinutes() === 0
    && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
}
