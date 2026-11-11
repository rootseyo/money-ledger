export const WEALTH_GOAL = 1_000_000_000;
export function projectWealth(netWorth: number, monthlyGrowth: number, target = WEALTH_GOAL) {
  const remaining = Math.max(0, target - netWorth);
  const months = remaining === 0 ? 0 : monthlyGrowth > 0 ? Math.ceil(remaining / monthlyGrowth) : null;
  return { remaining, months, progress: Math.max(0, Math.min(100, netWorth / target * 100)) };
}
export function monthAfter(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
