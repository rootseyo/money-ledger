import { AsyncLocalStorage } from 'node:async_hooks';
export type HouseholdRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export interface DataScope { id: string; role: string; householdId?: string; memberIds?: string[]; householdRole?: HouseholdRole }
export const dataScope = new AsyncLocalStorage<DataScope>();
const GLOBAL_KEYS = new Set(['financial_assets_data', 'household_budget', 'household_categories', 'household_payment_methods', 'household_fixed_expenses']);
export function scopedSettingKey(key: string, scope: DataScope): string {
  if (scope.householdId && GLOBAL_KEYS.has(key)) return `${scope.householdId}:${key}`;
  if (scope.role === 'OWNER') return key;
  if (key.startsWith(`${scope.id}:`)) return key;
  if (GLOBAL_KEYS.has(key) || key.startsWith('household-fixed-month:') || key.startsWith('ledger-undo:')) return `${scope.id}:${key}`;
  return key;
}
// All existing legacy transactions belong to the original owner's workspace.
export function transactionBoundary(scope: DataScope) {
  if (scope.id === 'legacy-cron') return { OR: [{ userId: null }, { user: { role: 'OWNER' } }] };
  if (scope.householdId && scope.memberIds?.length) return scope.role === 'OWNER'
    ? { OR: [{ userId: { in: scope.memberIds } }, { userId: null }] }
    : { userId: { in: scope.memberIds } };
  return scope.role === 'OWNER'
    ? { OR: [{ userId: scope.id }, { userId: null }] }
    : { userId: scope.id };
}
