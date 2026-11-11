import type { Transaction } from './ledger-types';

type Option = { value: string; label: string };
export function ledgerSuggestions(field: string, neighbor: Transaction | undefined, items: Transaction[], recent: Record<string, string[]>, base: string[] = []) {
  const value = (item: Transaction) => field === 'merchant' ? item.merchant || item.title : field === 'cardOrAccount' ? item.cardOrAccount || '' : String(item[field as keyof Transaction] || '');
  const ordered = [...items].sort((a, b) => new Date(b.updatedAt || b.createdAt || b.notifiedAt).getTime() - new Date(a.updatedAt || a.createdAt || a.notifiedAt).getTime());
  return [...new Set([neighbor ? value(neighbor) : '', ...(recent[field] || []), ...ordered.map(value), ...base].filter(Boolean))];
}
export function rankLedgerOptions(options: Option[], priorities: string[]) {
  const byValue = new Map(options.map(option => [option.value, option]));
  // Include historic categories even when no longer present in settings.
  return [...new Set([...priorities, ...options.map(option => option.value)])].map(value => byValue.get(value) || { value, label: value });
}
