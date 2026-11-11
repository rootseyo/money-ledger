'use client';

import { useLedgerHistory } from './LedgerHistory';
import { ledgerSuggestions, rankLedgerOptions } from './ledger-suggestions';
import type { ReactNode } from 'react';
import type { HouseholdPaymentMethod } from '@/lib/payment-methods';
import type { HouseholdCategory } from '@/lib/household-categories';
import { transactionCellPatch, type TransactionCellField } from '@/lib/ledger-cell';
import { kstDatetime } from '@/lib/transaction-entry';
import { SpreadsheetCell } from './SpreadsheetTable';
import type { Transaction } from './ledger-types';

export default function TransactionCell({ item, field, label, categories = [], onSaved, children, disabled, className, merchants, paymentMethods = [], neighbor, recentItems = [] }: {
  neighbor?: Transaction; recentItems?: Transaction[];
  item: Transaction; field: TransactionCellField; label: string; categories?: HouseholdCategory[];
  onSaved: (item: Transaction) => void; children: ReactNode; disabled?: boolean; className?: string; merchants?: string[]; paymentMethods?: HouseholdPaymentMethod[];
}) {
  const history = useLedgerHistory();
  const value = field === 'notifiedAt' ? kstDatetime(item.scheduledFor || item.notifiedAt).slice(0, 10)
    : field === 'merchant' ? item.merchant || item.title : String(item[field] ?? '');
  const options = field === 'cardOrAccount' && paymentMethods.length ? [
    { value: '', label: '결제수단 미지정' },
    ...(value && !paymentMethods.some(method => method.name === value) ? [{ value, label: value }] : []),
    ...paymentMethods.map(method => ({ value: method.name, label: `${method.emoji || ''} ${method.name}` })),
  ] : field === 'category' ? [
    { value: '', label: '미분류' },
    ...(value && !categories.some(c => c.name === value) ? [{ value, label: value }] : []),
    ...categories.map(c => ({ value: c.name, label: `${c.emoji || ''} ${c.name}` })),
  ] : undefined;
  return <SpreadsheetCell id={`${item.id}:${field}`} label={label} value={value} disabled={disabled} className={className} options={options ? rankLedgerOptions(options, ledgerSuggestions(field, neighbor, recentItems, history.recent)) : undefined} suggestions={field === 'merchant' ? ledgerSuggestions(field, neighbor, recentItems, history.recent, merchants) : undefined}
    type={field === 'notifiedAt' ? 'date' : 'text'} numeric={field === 'amount'}
    onSave={async next => {
      const payload = transactionCellPatch(item, field, next, categories);
      if (field === 'cardOrAccount') {
        const method = paymentMethods.find(method => method.name === next);
        if (method) payload.sourceApp = method.id;
      }
      const { id, ...changes } = payload;
      const data = await history.perform({ action: 'update', id, changes });
      if (!data.transaction) throw new Error('거래를 찾을 수 없습니다.');
      history.remember(field, next.trim());
      onSaved(data.transaction);
    }}>{children}</SpreadsheetCell>;
}
