export const DASHBOARD_IDS = ['summary', 'budget', 'timeline', 'category', 'daily', 'merchants', 'payments'] as const;
export type DashboardId = typeof DASHBOARD_IDS[number];
export type DashboardItem = { id: DashboardId; width: number; height: number | null };
export const DASHBOARD_TITLES: Record<DashboardId, string> = {
  summary: '월간·연간 요약', budget: '예산', timeline: '날짜별 지출',
  merchants: '주요 지출처', category: '소비 분야', daily: '일별 지출 차트', payments: '결제수단',
};
export function defaultDashboardLayout(): DashboardItem[] {
  return [
    { id: 'summary', width: 12, height: null },
    { id: 'budget', width: 4, height: null }, { id: 'timeline', width: 8, height: null },
    { id: 'category', width: 6, height: null }, { id: 'daily', width: 6, height: null },
    { id: 'merchants', width: 6, height: null }, { id: 'payments', width: 6, height: null },
  ];
}
export function validDashboardLayout(value: unknown): value is DashboardItem[] {
  return Array.isArray(value) && value.length === DASHBOARD_IDS.length
    && new Set(value.map(item => item?.id)).size === DASHBOARD_IDS.length
    && value.every(item => item && DASHBOARD_IDS.includes(item.id)
      && Number.isInteger(item.width) && item.width >= 3 && item.width <= 12
      && (item.height === null || (Number.isInteger(item.height) && item.height >= 220 && item.height <= 1200)));
}
export function moveDashboardItem(layout: DashboardItem[], source: DashboardId, target: DashboardId): DashboardItem[] {
  const result = [...layout];
  const from = result.findIndex(item => item.id === source);
  const to = result.findIndex(item => item.id === target);
  if (from < 0 || to < 0 || from === to) return layout;
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
