export type CardList = 'ledger' | 'fixed-expenses' | 'monthly-fixed-expenses';

export function isCardList(value: unknown): value is CardList {
  return value === 'ledger' || value === 'fixed-expenses' || value === 'monthly-fixed-expenses';
}

export function validListOrder(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 20000
    && value.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 100)
    && new Set(value).size === value.length;
}

export function applyListOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const ranks = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
}

// Reorder visible slots only, so filtering does not discard or move hidden rows.
export function moveListItem(order: string[], allIds: string[], visibleIds: string[], source: string, target: string): string[] {
  if (source === target || !visibleIds.includes(source) || !visibleIds.includes(target)) return order;
  const full = [...new Set([...order, ...allIds])];
  const visible = new Set(visibleIds);
  const moved = [...visibleIds];
  moved.splice(moved.indexOf(source), 1);
  moved.splice(visibleIds.indexOf(target), 0, source);
  let index = 0;
  return full.map((id) => visible.has(id) ? moved[index++] : id);
}
