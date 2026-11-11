import { classifyTransactionRole, resolveCategoryInfo, type HouseholdCategory } from './household-categories';

/** Includes income-like imported rows whose transaction type was supplied incorrectly. */
export function isIncomeSensitive(tx: { type?: string; category?: string | null; title?: string | null; merchant?: string | null; content?: string | null }, categories?: HouseholdCategory[]) {
  return classifyTransactionRole(tx) === 'INCOME' || resolveCategoryInfo(tx.category, categories).type === 'INCOME' || /급여|월급|이자|배당|수입/.test(`${tx.merchant || ''} ${tx.title || ''} ${tx.content || ''}`);
}
