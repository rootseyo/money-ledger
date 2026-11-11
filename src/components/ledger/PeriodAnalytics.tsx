'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Calendar as CalendarIcon,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Target,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowRight,
  Tag,
  CreditCard,
  Layers,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  X,
  Edit2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  HouseholdCategory,
  resolveCategoryInfo,
  DEFAULT_HOUSEHOLD_CATEGORIES,
} from '@/lib/household-categories';

import { AnalyticsLayout, AnalyticsWidget } from './AnalyticsLayout';
import { getKoreanHolidays } from '@/lib/korean-holidays';
import { formatCellAmount } from '@/lib/ledger-cell';
import './analytics-dashboard.css';

type PeriodMode = 'year' | 'month';

interface BudgetConfig {
  monthlyTotal: number;
  monthlyFixedIncome?: number;
  categoryBudgets: Record<string, number>;
  updatedAt?: string;
}

interface PeriodAnalyticsProps {
  privacyMode?: boolean;
  isClubLedger?: boolean;
  categories?: HouseholdCategory[];
  initialMonth?: string;
  budgetConfig?: BudgetConfig | null;
  refreshKey?: number;
  onEditTransaction?: (tx: any) => void;
  onDeleteTransaction?: (id: string) => void;
  onBudgetUpdated?: (newConfig: BudgetConfig) => void;
  onSelectMerchant?: (merchant: string, yearOrMonth?: string) => void;
}

export default function PeriodAnalytics({
  privacyMode = false,
  isClubLedger = false,
  categories = DEFAULT_HOUSEHOLD_CATEGORIES,
  initialMonth,
  budgetConfig,
  refreshKey,
  onEditTransaction,
  onDeleteTransaction,
  onBudgetUpdated,
  onSelectMerchant,
}: PeriodAnalyticsProps) {
  const [period, setPeriod] = useState<PeriodMode>('month');

  // 날짜 선택 상태
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return initialMonth ? parseInt(initialMonth.split('-')[0], 10) : new Date().getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (initialMonth && /^\d{4}-\d{2}$/.test(initialMonth)) return initialMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const holidays = useMemo(() => getKoreanHolidays(Number(selectedMonth.slice(0, 4))), [selectedMonth]);

  // 부모에서 initialMonth 변경 시 (대량 등록/빠른 등록/월 이동 등) 내부 선택 월 동기화
  useEffect(() => {
    if (initialMonth) {
      if (/^\d{4}-\d{2}$/.test(initialMonth)) {
        setSelectedMonth(initialMonth);
        setSelectedYear(parseInt(initialMonth.split('-')[0], 10));
      } else if (/^\d{4}$/.test(initialMonth)) {
        setSelectedYear(parseInt(initialMonth, 10));
      }
    }
  }, [initialMonth]);

  const [stats, setStats] = useState<any | null>(null);
  const [yearStats, setYearStats] = useState<any | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // 월 지출 분포 파이 차트 범례 및 카테고리 표시 제어 (범례 기본값: ON, Top 5 기본)
  const [showMonthlyPieLegend, setShowMonthlyPieLegend] = useState(true);
  const [showAllMonthlyCategories, setShowAllMonthlyCategories] = useState(false);

  // 연간 지출 분포 파이 차트 범례 및 카테고리 표시 제어 (범례 기본값: ON, Top 5 기본)
  const [showYearlyPieLegend, setShowYearlyPieLegend] = useState(true);
  const [showAllYearlyCategories, setShowAllYearlyCategories] = useState(false);

  // 📊 일별 지출 추이 그래프에서 선택된 날짜 상태
  const [selectedDailyChartDate, setSelectedDailyChartDate] = useState<string | null>(null);

  // 월/연도/기간 모드 변경 시 차트 선택 날짜 초기화
  useEffect(() => {
    setSelectedDailyChartDate(null);
  }, [selectedMonth, selectedYear, period]);

  // 📆 타임라인 일별 상세 모달 상태
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string | null>(null);
  const [timelineModalAnchor, setTimelineModalAnchor] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!selectedTimelineDate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTimelineDate(null);
        setTimelineModalAnchor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTimelineDate]);

  // 타임라인 모달: 선택한 셀에 따른 상대 위치 동적 계산
  const timelinePopupPos = useMemo(() => {
    if (!timelineModalAnchor || typeof window === 'undefined') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(440px, calc(100vw - 32px))',
      };
    }

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100vw - 32px)',
        maxWidth: '440px',
      };
    }

    const popupWidth = Math.min(440, window.innerWidth - 32);
    const popupEstHeight = 400;

    let left = timelineModalAnchor.left;
    if (timelineModalAnchor.left + popupWidth > window.innerWidth - 24) {
      left = timelineModalAnchor.right - popupWidth;
    }
    if (left < 16) left = 16;
    if (left + popupWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popupWidth - 16);
    }

    const spaceBelow = window.innerHeight - timelineModalAnchor.bottom;
    const spaceAbove = timelineModalAnchor.top;
    let top = timelineModalAnchor.bottom + 8;

    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      top = Math.max(16, timelineModalAnchor.top - popupEstHeight - 8);
    } else {
      if (top + popupEstHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - popupEstHeight - 16);
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${popupWidth}px`,
    };
  }, [timelineModalAnchor]);

  // 선택된 날짜의 dailyData 찾기 (타임라인 모달용)
  const selectedDayData = useMemo(() => {
    if (!selectedTimelineDate || !stats?.dailyData) return null;
    return stats.dailyData.find((d: any) => d.dateStr === selectedTimelineDate) || null;
  }, [selectedTimelineDate, stats?.dailyData]);

  // 일별 지출 추이 차트에서 선택된 날짜의 dailyData 찾기 (그래프 하단 상세용)
  const selectedDailyChartData = useMemo(() => {
    if (!selectedDailyChartDate || !stats?.dailyData) return null;
    return stats.dailyData.find((d: any) => d.dateStr === selectedDailyChartDate) || null;
  }, [selectedDailyChartDate, stats?.dailyData]);

  // 타임라인 상세 모달에서 항목 삭제
  const handleDeleteItem = async (id: string) => {
    if (!confirm('정말 이 거래 내역을 삭제하시겠습니까?')) return;
    if (onDeleteTransaction) {
      onDeleteTransaction(id);
    } else {
      try {
        await fetch(`/api/card-transactions/${id}`, { method: 'DELETE' });
      } catch (e) {
        console.error('Delete failed:', e);
      }
    }
    setTimeout(() => {
      fetchStats();
    }, 250);
  };

  // 월별 카테고리 Top 5 및 잔여 카테고리 계산
  const monthlyTop5Categories = useMemo(() => {
    if (!stats?.categoryBreakdown) return [];
    return stats.categoryBreakdown.slice(0, 5);
  }, [stats?.categoryBreakdown]);

  // 연간 카테고리 Top 5 계산
  const yearlyTop5Categories = useMemo(() => {
    if (!stats?.categoryBreakdown) return [];
    return stats.categoryBreakdown.slice(0, 5);
  }, [stats?.categoryBreakdown]);

  const remainingCategories = useMemo(() => {
    if (!stats?.categoryBreakdown || stats.categoryBreakdown.length <= 5) return [];
    return stats.categoryBreakdown.slice(5);
  }, [stats?.categoryBreakdown]);

  const remainingAmount = useMemo(() => {
    return remainingCategories.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  }, [remainingCategories]);

  const remainingPercentage = useMemo(() => {
    return remainingCategories.reduce((sum: number, c: any) => sum + (c.percentage || 0), 0);
  }, [remainingCategories]);

  const overviewTrend = useMemo(() => {
    if (!stats) return [];
    if (period === 'year') {
      return (stats.monthlyData || []).map((item: any) => ({
        label: item.month,
        expense: item.expense || 0,
        income: item.income || 0,
      }));
    }
    return (stats.dailyData || [])
      .filter((item: any) => (item.expense || 0) > 0 || (item.income || 0) > 0)
      .slice(-14)
      .map((item: any) => ({
        label: item.day || `${Number(item.dayNum || item.dateStr?.slice(-2))}일`,
        expense: item.expense || 0,
        income: item.income || 0,
      }));
  }, [period, stats]);

  const overviewPeak = useMemo(
    () => overviewTrend.reduce((peak: any, item: any) => item.expense > (peak?.expense || 0) ? item : peak, null),
    [overviewTrend]
  );
  const overviewCategories = (stats?.categoryBreakdown || []).slice(0, 4);

  // 월간 상세와 연간 요약을 함께 조회합니다.
  const fetchVersion = React.useRef(0);
  const fetchStats = useCallback(async () => {
    const version = ++fetchVersion.current;
    setLoading(true);
    setStatsError(false);
    setStats(null);
    setYearStats(null);
    try {
      const read = async (query: string) => {
        const response = await fetch(`/api/card-transactions/stats?${query}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('통계 조회 실패');
        const body = await response.json();
        if (!body.success) throw new Error('통계 조회 실패');
        return body;
      };
      const [monthly, yearly] = await Promise.all([
        read(`period=month&month=${selectedMonth}`),
        read(`period=year&year=${selectedMonth.slice(0, 4)}`),
      ]);
      if (version !== fetchVersion.current) return;
      setStats(monthly);
      setYearStats(yearly);
    } catch (err) {
      if (version === fetchVersion.current) setStatsError(true);
      console.error('Failed to fetch period statistics:', err);
    } finally {
      if (version === fetchVersion.current) setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchStats();
    return () => { fetchVersion.current++; };
  }, [fetchStats, refreshKey]);

  // 월 이동
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };
  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };



  // 고정 수익 인라인 설정 상태
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState<string>('');
  const [savingIncome, setSavingIncome] = useState(false);
  const [localFixedIncome, setLocalFixedIncome] = useState<number>(budgetConfig?.monthlyFixedIncome || 0);

  useEffect(() => {
    if (budgetConfig?.monthlyFixedIncome !== undefined) {
      setLocalFixedIncome(budgetConfig.monthlyFixedIncome);
    }
  }, [budgetConfig?.monthlyFixedIncome]);

  // 예산 정보 (순수 소비 기준: 저축·투자는 자산 증식이므로 소비 지출에서 제외)
  const totalBudget = budgetConfig?.monthlyTotal || 1500000;
  const currentNetExpense = stats?.consumptionExpense ?? stats?.totalExpense ?? 0;
  const netFlow = (stats?.totalIncome || 0) - currentNetExpense;
  const budgetSpentRatio = totalBudget > 0 ? (currentNetExpense / totalBudget) * 100 : 0;
  const remainingBudget = Math.max(0, totalBudget - currentNetExpense);

  // 고정 수익 & 수익 대비 소비율 계산
  const effectiveFixedIncome = localFixedIncome > 0 ? localFixedIncome : (budgetConfig?.monthlyFixedIncome || 0);
  const consumptionRatio = effectiveFixedIncome > 0 ? (currentNetExpense / effectiveFixedIncome) * 100 : 0;
  const remainingIncomeForSavings = Math.max(0, effectiveFixedIncome - currentNetExpense);
  const remainingIncomeRate = effectiveFixedIncome > 0 ? (remainingIncomeForSavings / effectiveFixedIncome) * 100 : 0;

  // 고정 수익 저장 핸들러 (매달 자동 적용)
  const handleSaveFixedIncome = async (val?: number) => {
    const targetVal = val !== undefined ? val : (parseInt(incomeInput.replace(/[^0-9]/g, ''), 10) || 0);
    if (targetVal <= 0) return;
    setSavingIncome(true);
    try {
      const res = await fetch('/api/card-transactions/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyFixedIncome: targetVal,
          monthlyTotal: budgetConfig?.monthlyTotal || 1500000,
          categoryBudgets: budgetConfig?.categoryBudgets || {},
        }),
      });
      if (res.ok) {
        setLocalFixedIncome(targetVal);
        setIsEditingIncome(false);
        onBudgetUpdated?.({
          monthlyTotal: budgetConfig?.monthlyTotal || 1500000,
          monthlyFixedIncome: targetVal,
          categoryBudgets: budgetConfig?.categoryBudgets || {},
        });
      }
    } catch (err) {
      console.error('Failed to save monthly fixed income:', err);
    } finally {
      setSavingIncome(false);
    }
  };

  return (
    <AnalyticsLayout isClubLedger={isClubLedger}>
      <AnalyticsWidget id="summary"><section className="glass-panel analytics-summary" aria-label="월간 연간 통합 요약">
        <div className="analytics-section-heading">
          <div><span className="analytics-eyebrow">수입과 지출</span><h3>이번 달과 한 해를 한눈에</h3></div>
          <div className="analytics-month-picker">
            <button type="button" className="btn btn-secondary" onClick={handlePrevMonth} aria-label="이전 달"><ChevronLeft size={16} /></button>
            <input type="month" aria-label="분석할 월" value={selectedMonth} onChange={event => { if (event.target.value) setSelectedMonth(event.target.value); }} />
            <button type="button" className="btn btn-secondary" onClick={handleNextMonth} aria-label="다음 달"><ChevronRight size={16} /></button>
            <button type="button" className="btn btn-secondary" onClick={fetchStats} aria-label="통계 새로고침"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button>
          </div>
        </div>
        {statsError ? <p role="alert">요약을 불러오지 못했어요. 새로고침을 눌러 주세요.</p> : <>
          <div className="analytics-summary-scroll">
            <table className="analytics-summary-table">
              <thead><tr><th scope="col">기간</th><th scope="col">{!isClubLedger ? '수입' : '회비·수입'}</th><th scope="col">{!isClubLedger ? '소비' : '공동 지출'}</th>{!isClubLedger && <th scope="col">저축·투자</th>}<th scope="col">{!isClubLedger ? '남은 돈' : '잔액 증감'}</th></tr></thead>
              <tbody>{[{ label: `${Number(selectedMonth.slice(5))}월`, data: stats }, { label: `${selectedMonth.slice(0, 4)}년 누적`, data: yearStats }].map(row => <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td data-sensitive-income="true">{loading ? '…' : privacyMode ? '••••' : `₩${(row.data?.totalIncome || 0).toLocaleString()}`}</td>
                <td>{loading ? '…' : `₩${(row.data?.consumptionExpense ?? row.data?.totalExpense ?? 0).toLocaleString()}`}</td>
                {!isClubLedger && <td>{loading ? '…' : `₩${(row.data?.totalSavings || 0).toLocaleString()}`}</td>}
                <td className="analytics-summary-growth" data-sensitive-income="true">{loading ? '…' : privacyMode ? '••••' : `₩${((row.data?.totalIncome || 0) - (row.data?.consumptionExpense ?? row.data?.totalExpense ?? 0)).toLocaleString()}`}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="analytics-note">{!isClubLedger ? '남은 돈은 수입에서 소비를 뺀 금액이에요. 저축·투자로 옮긴 돈은 소비에 넣지 않아요.' : '모임 수입에서 공동 지출을 뺀 금액으로 해당 기간의 잔액 증감을 확인합니다.'}</p>
          <div className="analytics-section-heading analytics-trend-heading"><h3>{selectedMonth.slice(0, 4)}년 월별 흐름</h3><div className="analytics-chart-legend"><span><i style={{ background: '#6c91bc' }} />소비</span>{!privacyMode && <span><i style={{ background: '#62a68a' }} />수입</span>}</div></div>
          <div className="analytics-year-chart">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={yearStats?.monthlyData || []} barGap={3} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={value => `${Math.round(value / 10000)}만`} width={50} />
              <RechartsTooltip cursor={{ fill: 'var(--ledger-subtle)' }} formatter={(value, name) => [`₩${Number(value).toLocaleString()}`, name]} contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="expense" name="소비" fill="#6c91bc" radius={[4, 4, 0, 0]} maxBarSize={18} onClick={(entry: any) => { if (entry?.monthStr) setSelectedMonth(entry.monthStr); }} style={{ cursor: 'pointer' }} />
              {!privacyMode && <Bar dataKey="income" name="수입" fill="#62a68a" radius={[4, 4, 0, 0]} maxBarSize={18} onClick={(entry: any) => { if (entry?.monthStr) setSelectedMonth(entry.monthStr); }} style={{ cursor: 'pointer' }} />}
            </BarChart></ResponsiveContainer>
          </div>
          <p className="analytics-note">월별 막대를 누르면 아래 지출 내역도 그 달로 바뀌어요.</p>
        </>}
      </section></AnalyticsWidget>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. 모드별 상세 통계 콘텐츠 */}
      {/* ───────────────────────────────────────────────────────────── */}

      <section className="ledger-advanced ledger-advanced--open" aria-labelledby="ledger-advanced-heading">
        <header className="ledger-advanced-heading">
          <div>
            <h2 id="ledger-advanced-heading">{Number(selectedMonth.slice(5))}월 {!isClubLedger ? '지출' : '모임 회계'} 살펴보기</h2>
            <p>{!isClubLedger ? '예산 → 날짜별 지출 → 소비 분야와 사용처 순으로 확인해 보세요.' : '회비와 공동 지출을 날짜별로 확인해 보세요.'}</p>
          </div>
        </header>
        <div className="ledger-advanced-body">
      {/* [B] 월별 분석 뷰 (MONTHLY) */}
      {period === 'month' && (
        <div className="analytics-detail-grid">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* 🎯 수익 대비 소비율 (월 고정 수익 기준 소비 & 저축 여력 분석) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {!isClubLedger && <AnalyticsWidget id="budget"><div className="glass-panel analytics-budget-panel" style={{ padding: '12px 16px', borderLeft: '3px solid #10b981' }}>
            {effectiveFixedIncome === 0 ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={16} color="#38bdf8" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      수익 대비 소비율 설정
                    </span>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--ledger-info)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      월 고정 수입 미설정
                    </span>
                  </div>
                  {stats?.totalIncome > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSaveFixedIncome(stats.totalIncome)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.4)', whiteSpace: 'nowrap' }}
                    >
                      당월 수입(<span data-sensitive-income="true">₩{stats.totalIncome.toLocaleString()}</span>)으로 자동 설정
                    </button>
                  )}
                </div>

                <p style={{ margin: '6px 0 8px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  매달 고정 수익(급여, 기본 수입 등)을 한 번 등록해두시면 매월 자동으로 수익 대비 소비율과 저축 여력이 계산됩니다.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    data-sensitive-income="true"
                    value={formatCellAmount(incomeInput)}
                    onChange={(e) => setIncomeInput(formatCellAmount(e.target.value))}
                    placeholder="예: 3,500,000"
                    className="input"
                    style={{ width: '150px', padding: '4px 8px', fontSize: '0.78rem', background: 'var(--ledger-control-bg)' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>원</span>
                  <button
                    type="button"
                    disabled={savingIncome || !incomeInput}
                    onClick={() => handleSaveFixedIncome()}
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                  >
                    {savingIncome ? '저장 중...' : '고정 수익 저장'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <Target size={16} color="#10b981" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      수익 대비 소비율
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        background: 'var(--ledger-control-bg)',
                        color: 'var(--text-main)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span data-sensitive-income="true">월 고정 수입: ₩{effectiveFixedIncome.toLocaleString()}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIncomeInput(effectiveFixedIncome ? formatCellAmount(String(effectiveFixedIncome)) : '');
                          setIsEditingIncome((prev) => !prev);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--ledger-info)',
                          cursor: 'pointer',
                          fontSize: '0.66rem',
                          textDecoration: 'underline',
                          padding: 0,
                          marginLeft: '3px',
                        }}
                      >
                        {isEditingIncome ? '닫기' : '수정'}
                      </button>
                    </span>

                    {/* Status Badge */}
                    <span data-sensitive-income="true"
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background:
                          consumptionRatio > 90
                            ? 'rgba(239, 68, 68, 0.15)'
                            : consumptionRatio > 70
                            ? 'rgba(245, 158, 11, 0.15)'
                            : consumptionRatio > 50
                            ? 'rgba(6, 182, 212, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                        color:
                          consumptionRatio > 90
                            ? "var(--danger)"
                            : consumptionRatio > 70
                            ? "var(--warning)"
                            : consumptionRatio > 50
                            ? "var(--ledger-info)"
                            : "var(--success)",
                      }}
                    >
                      {consumptionRatio > 90
                        ? '🚨 과소비 위험'
                        : consumptionRatio > 70
                        ? '⚠️ 소비 주의'
                        : consumptionRatio > 50
                        ? '👍 건전 소비'
                        : '✨ 최적 소비'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color:
                        consumptionRatio > 90
                          ? "var(--danger)"
                          : consumptionRatio > 70
                          ? "var(--warning)"
                          : "var(--success)",
                    }}
                  >
                    소비 ₩{currentNetExpense.toLocaleString()} / <span data-sensitive-income="true">₩{effectiveFixedIncome.toLocaleString()} ({consumptionRatio.toFixed(1)}%)</span>
                  </span>
                </div>

                {/* Inline Editing Form */}
                {isEditingIncome && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontSize: '0.74rem',
                    }}
                  >
                    <span style={{ color: 'var(--ledger-info)', fontWeight: 600 }}>월 고정 수입 변경:</span>
                    <input
                      type="text"
                      data-sensitive-income="true"
                      value={formatCellAmount(incomeInput)}
                      onChange={(e) => setIncomeInput(formatCellAmount(e.target.value))}
                      className="input"
                      style={{ width: '130px', padding: '3px 6px', fontSize: '0.74rem' }}
                    />
                    <span style={{ color: 'var(--text-main)' }}>원</span>
                    <button
                      type="button"
                      disabled={savingIncome}
                      onClick={() => handleSaveFixedIncome()}
                      className="btn btn-primary"
                      style={{ padding: '3px 8px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingIncome(false)}
                      className="btn btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
                    >
                      취소
                    </button>
                  </div>
                )}

                {/* Progress Bar */}
                <div data-sensitive-income="true" style={{ width: '100%', height: '8px', background: 'var(--ledger-control-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, consumptionRatio)}%`,
                      height: '100%',
                      background:
                        consumptionRatio > 90
                          ? '#ef4444'
                          : consumptionRatio > 70
                          ? '#f59e0b'
                          : consumptionRatio > 50
                          ? '#06b6d4'
                          : '#10b981',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>

                {/* Footer Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '6px' }}>
                  <span data-sensitive-income="true" style={{ fontWeight: 600, color: remainingIncomeForSavings > 0 ? "var(--ledger-info)" : "var(--danger)" }}>
                    남은 저축·투자 여력: ₩{remainingIncomeForSavings.toLocaleString()} ({remainingIncomeRate.toFixed(1)}%)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: "var(--ledger-info)", fontWeight: 700 }}>
                      🌱 당월 실제 저축·투자: ₩{(stats?.totalSavings || 0).toLocaleString()} (<span data-sensitive-income="true">저축률 {(stats?.savingsRate ?? 0).toFixed(1)}%</span>)
                    </span>
                    <span>•</span>
                    <span>피크 소비일: {stats?.peakDay?.day || '-'} (₩{(stats?.peakDay?.expense || 0).toLocaleString()})</span>
                  </span>
                </div>
              </div>
            )}
          </div></AnalyticsWidget>}

          {/* 📆 월간 일별 지출 타임라인 */}
          <AnalyticsWidget id="timeline"><div className="glass-panel analytics-timeline-panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📆 {selectedMonth} 월간 일별 지출 타임라인
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                토요일은 파랑 · 일요일과 공휴일은 빨강 (날짜에 마우스를 올리면 공휴일명 확인)
              </span>
            </div>

            <div className="ledger-daily-timeline-grid">
              {(stats?.dailyData || []).map((d: any) => {
                const hasExpense = (d.expense || 0) > 0;
                const hasIncome = (d.income || 0) > 0;
                const isSelected = selectedTimelineDate === d.dateStr;
                const formattedExpense = d.expense >= 10000
                  ? `${(d.expense / 10000).toFixed(d.expense % 10000 === 0 ? 0 : 1)}만`
                  : d.expense.toLocaleString();
                const formattedIncome = d.income >= 10000
                  ? `${Math.round(d.income / 10000)}만`
                  : d.income.toLocaleString();
                const dow = new Date(`${d.dateStr}T00:00:00`).getDay();
                const holiday = holidays[d.dateStr];
                const weekend = holiday || dow === 0 ? 'sun' : dow === 6 ? 'sat' : undefined;

                return (
                  <div
                    key={d.dateStr}
                    data-weekend={weekend}
                    onClick={(e) => {
                      if (selectedTimelineDate === d.dateStr) {
                        setSelectedTimelineDate(null);
                        setTimelineModalAnchor(null);
                      } else {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTimelineModalAnchor({
                          top: rect.top,
                          bottom: rect.bottom,
                          left: rect.left,
                          right: rect.right,
                          width: rect.width,
                          height: rect.height,
                        });
                        setSelectedTimelineDate(d.dateStr);
                      }
                    }}
                    style={{
                      cursor: 'pointer',
                      borderRadius: '8px',
                      background: isSelected
                        ? 'rgba(56, 189, 248, 0.22)'
                        : hasExpense
                        ? 'rgba(239, 68, 68, 0.08)'
                        : 'var(--ledger-subtle)',
                      border: isSelected
                        ? '1.5px solid #38bdf8'
                        : hasExpense
                        ? '1px solid rgba(239, 68, 68, 0.25)'
                        : '1px solid var(--ledger-control-bg)',
                      boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.45)' : undefined,
                      color: isSelected ? 'var(--text-main)' : hasExpense ? "var(--text-main)" : "var(--text-muted)",
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                    className="ledger-daily-timeline-day"
                    title={`${d.dateStr}${holiday ? ` (${holiday})` : ''}: 지출 ₩${(d.expense || 0).toLocaleString()} (클릭하여 항목 상세 보기)`}
                  >
                    <span className="ledger-daily-timeline-number" >
                      {Number(d.dateStr.slice(-2))}
                    </span>
                    <span className="ledger-daily-timeline-amount" style={{ color: isSelected ? 'var(--text-main)' : hasExpense ? 'var(--danger)' : "var(--text-muted)" }}>
                      {hasExpense ? formattedExpense : '-'}
                    </span>
                    {hasIncome && (
                      <span className="ledger-daily-timeline-income" data-sensitive-income="true">
                        +{formattedIncome}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div></AnalyticsWidget>

          {/* 팝업 모달: 타임라인 일자 선택 시 거래 내역 팝업 */}
          {selectedTimelineDate && selectedDayData && (
            <div
              onClick={() => {
                setSelectedTimelineDate(null);
                setTimelineModalAnchor(null);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(2px)',
                zIndex: 9999,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  ...timelinePopupPos,
                  maxHeight: 'min(520px, calc(100vh - 32px))',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--ledger-control-bg)',
                  borderRadius: '14px',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--ledger-control-bg)',
                  animation: 'fadeIn 0.15s ease-out',
                }}
              >
                {(() => {
                  const dayTxs = selectedDayData.txs || [];
                  const hasExpense = (selectedDayData.expense || 0) > 0;
                  const hasIncome = (selectedDayData.income || 0) > 0;

                  const dateParts = selectedTimelineDate.split('-').map(Number);
                  const dayOfWeekName = ['일', '월', '화', '수', '목', '금', '토'][
                    new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay()
                  ];
                  const formattedDateStr = `${dateParts[0]}년 ${dateParts[1]}월 ${dateParts[2]}일 (${dayOfWeekName})`;

                  return (
                    <>
                      {/* 팝업 헤더 */}
                      <div
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--surface-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--ledger-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1rem' }}>📆</span>
                          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                            {formattedDateStr}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTimelineDate(null);
                            setTimelineModalAnchor(null);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: '4px',
                            borderRadius: '6px',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="닫기 (ESC)"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* 일별 지출/수입 요약 바 */}
                      <div
                        style={{
                          padding: '8px 16px',
                          background: 'var(--ledger-subtle)',
                          borderBottom: '1px solid var(--surface-border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>
                          총 <b style={{ color: 'var(--text-main)' }}>{dayTxs.length}건</b>의 거래 내역
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {hasExpense && (
                            <span style={{ color: 'var(--expense-color, #3b82f6)', fontWeight: 700 }}>
                              지출 ₩{(selectedDayData.expense || 0).toLocaleString()}
                            </span>
                          )}
                          {hasIncome && (
                            <span data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)', fontWeight: 700 }}>
                              수입 +₩{(selectedDayData.income || 0).toLocaleString()}
                            </span>
                          )}
                          {!hasExpense && !hasIncome && (
                            <span style={{ color: 'var(--text-muted)' }}>지출/수입 없음</span>
                          )}
                        </div>
                      </div>

                      {/* 팝업 본문 (스크롤 리스트) */}
                      <div
                        style={{
                          padding: '12px 14px',
                          overflowY: 'auto',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          maxHeight: '360px',
                        }}
                      >
                        {dayTxs.length === 0 ? (
                          <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>해당 일자의 거래 내역이 없습니다.</p>
                          </div>
                        ) : (
                          dayTxs.map((tx: any) => {
                            const cat = resolveCategoryInfo(tx.category, categories);
                            const isDeposit = tx.type === 'DEPOSIT';
                            const isExpense = tx.type === 'PAYMENT' || tx.type === 'WITHDRAWAL';
                            return (
                              <div
                                key={tx.id}
                                data-sensitive-income={isDeposit || cat.type === 'INCOME' ? 'true' : undefined}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '9px 12px',
                                  background: 'var(--ledger-subtle)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--surface-border)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.emoji || '💳'}</span>
                                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: '0.84rem',
                                        color: 'var(--text-main)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                    title={privacyMode && (isDeposit || cat.type === 'INCOME') ? undefined : tx.merchant || tx.cardOrAccount || tx.title}
                                    >
                                      {tx.merchant || tx.cardOrAccount || tx.title}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      <span>
                                        {new Date(tx.notifiedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span>•</span>
                                      <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                        {cat.label || cat.name}
                                      </span>
                                      {(tx.cardOrAccount || tx.sourceApp) && (
                                        <>
                                          <span>•</span>
                                          <span>{tx.cardOrAccount || tx.sourceApp}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                                  <span data-sensitive-income={isDeposit ? 'true' : undefined}
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '0.88rem',
                                      color: isDeposit ? 'var(--income-color, #ef4444)' : isExpense ? 'var(--expense-color, #3b82f6)' : 'var(--text-muted)',
                                    }}
                                  >
                                    {isDeposit ? '+' : isExpense ? '-' : ''}₩{tx.amount.toLocaleString()}
                                  </span>
                                  {onEditTransaction && (
                                    <button
                                      onClick={() => {
                                        onEditTransaction(tx);
                                        setSelectedTimelineDate(null);
                                        setTimelineModalAnchor(null);
                                      }}
                                      className="btn btn-secondary"
                                      title="수정"
                                      style={{ padding: '4px 6px', fontSize: '0.72rem' }}
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteItem(tx.id)}
                                    className="btn btn-secondary"
                                    title="삭제"
                                    style={{ padding: '4px 6px', fontSize: '0.72rem', color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 팝업 하단 푸터 (순 소비 합계) */}
                      {dayTxs.length > 0 && (
                        <div
                          style={{
                            padding: '10px 16px',
                            borderTop: '1px solid var(--surface-border)',
                            background: 'var(--ledger-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.76rem',
                          }}
                        >
                          <div style={{ color: 'var(--text-muted)' }}>
                            당일 순 지출:{' '}
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              <span data-sensitive-income="true">₩{Math.max(0, (selectedDayData.expense || 0) - (selectedDayData.income || 0)).toLocaleString()}원</span>
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            esc 키 또는 바깥 클릭 시 닫힘
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 차트 그리드: 카테고리 도넛 차트 & 일별 지출 바 차트 */}
          <div className="analytics-detail-charts">
            {/* 카테고리별 비중 */}
            <AnalyticsWidget id="category"><div className="glass-panel analytics-category-panel" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PieChartIcon size={16} color="#f59e0b" /> 카테고리별 지출 분포
                  <span style={{ fontSize: '0.68rem', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Top 5
                  </span>
                </h3>
                <button
                  onClick={() => setShowMonthlyPieLegend((prev) => !prev)}
                  className="btn"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    background: showMonthlyPieLegend ? 'rgba(56, 189, 248, 0.12)' : 'var(--ledger-control-bg)',
                    border: showMonthlyPieLegend ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid var(--surface-border)',
                    color: showMonthlyPieLegend ? "var(--ledger-info)" : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="파이 차트 범례 표시/숨김 전환"
                >
                  범례 {showMonthlyPieLegend ? 'ON' : 'OFF'}
                </button>
              </div>

              {(!stats?.categoryBreakdown || stats.categoryBreakdown.length === 0) ? (
                <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: '170px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  해당 월의 지출 데이터가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="analytics-category-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthlyTop5Categories}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy={showMonthlyPieLegend ? '40%' : '50%'}
                          innerRadius={45}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {monthlyTop5Categories.map((entry: any, index: number) => (
                            <Cell key={`monthly-top5-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '지출액']}
                          contentStyle={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)', borderRadius: '8px', fontSize: '0.8rem' }}
                        />
                        {showMonthlyPieLegend && (
                          <Legend
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{
                              paddingTop: '6px',
                              fontSize: '0.74rem',
                              lineHeight: '1.4',
                            }}
                            formatter={(value: any) => {
                              const item = monthlyTop5Categories.find((c: any) => c.name === value);
                              return (
                                <span style={{ color: 'var(--text-main)', fontSize: '0.74rem', marginRight: '6px' }}>
                                  {value} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({item?.percentage ?? 0}%)</span>
                                </span>
                              );
                            }}
                          />
                        )}
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
                    {(showAllMonthlyCategories ? stats.categoryBreakdown : monthlyTop5Categories).map((cat: any, idx: number) => (
                      <div key={cat.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            background: idx < 3 ? `${cat.color}22` : 'var(--ledger-control-bg)',
                            color: idx < 3 ? cat.color : 'var(--text-muted)',
                            border: `1px solid ${cat.color}44`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{cat.name}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({cat.percentage}%)</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                          ₩{cat.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {stats.categoryBreakdown.length > 5 && (
                    <div style={{ marginTop: '2px', paddingTop: '6px', borderTop: '1px dashed var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                      {!showAllMonthlyCategories ? (
                        <>
                          <span style={{ color: 'var(--text-muted)' }}>
                            그 외 {remainingCategories.length}개: <strong style={{ color: 'var(--text-main)' }}>₩{remainingAmount.toLocaleString()}</strong> ({remainingPercentage.toFixed(1)}%)
                          </span>
                          <button
                            onClick={() => setShowAllMonthlyCategories(true)}
                            className="btn"
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.68rem',
                              color: 'var(--ledger-info)',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            + 전체 {stats.categoryBreakdown.length}개 펼치기
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setShowAllMonthlyCategories(false)}
                          className="btn"
                          style={{
                            width: '100%',
                            padding: '2px',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          ▲ Top 5만 보기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div></AnalyticsWidget>

            {/* 일별 지출 추이 바 차트 */}
            <AnalyticsWidget id="daily"><div className="glass-panel analytics-daily-panel" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BarChart3 size={16} color="#38bdf8" /> 1일 ~ 말일 일별 지출 추이
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {selectedDailyChartDate ? (
                    <span style={{ color: 'var(--ledger-info)', fontWeight: 600 }}>
                      선택된 일자: {parseInt(selectedDailyChartDate.split('-')[2], 10)}일
                    </span>
                  ) : (
                    '막대 클릭 시 일별 상세 거래 내역 조회'
                  )}
                </span>
              </div>

              {(!stats?.dailyData || stats.dailyData.length === 0) ? (
                <div style={{ display: 'grid', placeItems: 'center', flex: 1, minHeight: '170px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  일별 데이터가 없습니다.
                </div>
              ) : (
                <div className="analytics-daily-chart-scroll" role="region" aria-label="일별 지출 차트, 좌우로 스크롤할 수 있습니다" tabIndex={0}><div className="analytics-daily-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.dailyData}
                      margin={{ top: 28, right: 18, left: 0, bottom: 8 }}
                    >
                      <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} interval={0} tickLine={false} axisLine={false} tickFormatter={value => `${parseInt(String(value), 10)}일`} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} width={52} tickLine={false} axisLine={false} tickFormatter={value => value >= 10000 ? `${Number((value / 10000).toFixed(1))}만` : Number(value).toLocaleString()} />
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [`₩${Number(value).toLocaleString()}`, name]}
                        contentStyle={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)', borderRadius: '8px', fontSize: '0.8rem' }}
                      />
                      <Bar
                        dataKey="expense"
                        name="지출"
                        radius={[3, 3, 0, 0]}
                        cursor="pointer"
                        maxBarSize={22}
                        onClick={(entry: any) => {
                          if (entry?.dateStr) setSelectedDailyChartDate(previous => previous === entry.dateStr ? null : entry.dateStr);
                        }}
                      >
                        {stats.dailyData.map((entry: any, index: number) => {
                          const isSelected = selectedDailyChartDate === entry.dateStr;
                          return (
                            <Cell
                              key={`daily-bar-cell-${index}`}
                              fill={isSelected ? '#38bdf8' : '#3b82f6'}
                              stroke={isSelected ? '#ffffff' : 'none'}
                              strokeWidth={isSelected ? 1.5 : 0}
                              cursor="pointer"
                              style={{
                                filter: isSelected ? 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.75))' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                            />
                          );
                        })}
                        <LabelList
                          dataKey="expense"
                          position="top"
                          formatter={(val: any) => {
                            const num = Number(val);
                            if (!num || num <= 0) return '';
                            if (num >= 10000) {
                              const man = num / 10000;
                              return man >= 10 ? `${Math.round(man)}만` : `${Number(man.toFixed(1))}만`;
                            }
                            if (num >= 1000) {
                              return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}천`;
                            }
                            return `${num}`;
                          }}
                          fill="var(--text-muted)"
                          fontSize={10}
                          fontWeight={600}
                          offset={5}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div></div>
              )}
              <p className="analytics-daily-swipe-hint">↔ 좌우로 밀어 1일부터 말일까지 확인해요. 막대를 누르면 상세 내역이 나와요.</p>

              {/* 선택된 날짜의 거래 내역 상세 (그래프 하단) */}
              {selectedDailyChartDate && selectedDailyChartData ? (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px 14px',
                    background: 'rgba(56, 189, 248, 0.04)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    animation: 'fadeIn 0.15s ease-out',
                  }}
                >
                  {(() => {
                    const txs = selectedDailyChartData.txs || [];
                    const dateParts = selectedDailyChartDate.split('-').map(Number);
                    const dayOfWeekName = ['일', '월', '화', '수', '목', '금', '토'][
                      new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay()
                    ];
                    const formattedDateStr = `${dateParts[0]}년 ${dateParts[1]}월 ${dateParts[2]}일 (${dayOfWeekName})`;
                    const hasExpense = (selectedDailyChartData.expense || 0) > 0;
                    const hasIncome = (selectedDailyChartData.income || 0) > 0;

                    return (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid var(--ledger-control-bg)',
                            paddingBottom: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.95rem' }}>📅</span>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                              {formattedDateStr}
                            </span>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '1px 7px',
                                borderRadius: '12px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: 'var(--ledger-info)',
                                fontWeight: 600,
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              총 {txs.length}건
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem' }}>
                              {hasExpense && (
                                <span style={{ color: 'var(--expense-color, #3b82f6)', fontWeight: 700 }}>
                                  지출 ₩{(selectedDailyChartData.expense || 0).toLocaleString()}
                                </span>
                              )}
                              {hasIncome && (
                                <span data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)', fontWeight: 700 }}>
                                  수입 +₩{(selectedDailyChartData.income || 0).toLocaleString()}
                                </span>
                              )}
                              {!hasExpense && !hasIncome && (
                                <span style={{ color: 'var(--text-muted)' }}>지출/수입 없음</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedDailyChartDate(null)}
                              className="btn btn-secondary"
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.72rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                color: 'var(--text-muted)',
                              }}
                              title="선택 해제"
                            >
                              <X size={12} /> 닫기
                            </button>
                          </div>
                        </div>

                        {txs.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '14px 0' }}>
                            해당 일자의 거래 내역이 없습니다.
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              maxHeight: '260px',
                              overflowY: 'auto',
                              paddingRight: '4px',
                            }}
                          >
                            {txs.map((tx: any) => {
                              const cat = resolveCategoryInfo(tx.category, categories);
                              const isDeposit = tx.type === 'DEPOSIT';
                              const isExpense = tx.type === 'PAYMENT' || tx.type === 'WITHDRAWAL';
                              const isTransfer = tx.type === 'TRANSFER';

                              return (
                                <div
                                  key={tx.id}
                                  data-sensitive-income={isDeposit || cat.type === 'INCOME' ? 'true' : undefined}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    background: 'var(--ledger-subtle)',
                                    borderRadius: '7px',
                                    border: '1px solid var(--surface-border)',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cat.emoji || '💳'}</span>
                                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          color: 'var(--text-main)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          cursor: onSelectMerchant && tx.merchant ? 'pointer' : 'default',
                                        }}
                                        onClick={() => {
                                          if (onSelectMerchant && tx.merchant) {
                                            onSelectMerchant(tx.merchant, selectedMonth);
                                          }
                                        }}
                                        title={privacyMode && (isDeposit || cat.type === 'INCOME') ? undefined : tx.merchant ? `${tx.merchant} 장부에서 검색` : (tx.cardOrAccount || tx.title)}
                                      >
                                        {tx.merchant || tx.cardOrAccount || tx.title}
                                        {onSelectMerchant && tx.merchant && (
                                          <span style={{ fontSize: '0.65rem', color: 'var(--ledger-accent)', marginLeft: '4px' }}>↗</span>
                                        )}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--text-muted)',
                                          marginTop: '2px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          flexWrap: 'wrap',
                                        }}
                                      >
                                        <span>
                                          {new Date(tx.notifiedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span>•</span>
                                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                          {cat.label || cat.name}
                                        </span>
                                        {(tx.cardOrAccount || tx.sourceApp) && (
                                          <>
                                            <span>•</span>
                                            <span>{tx.cardOrAccount || tx.sourceApp}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                                    <span
                                      style={{
                                        fontWeight: 800,
                                        fontSize: '0.84rem',
                                        color: isDeposit ? 'var(--income-color, #ef4444)' : isExpense ? 'var(--expense-color, #3b82f6)' : isTransfer ? "var(--ledger-info)" : 'var(--text-muted)',
                                      }}
                                    >
                                      {isDeposit ? '+' : isExpense ? '-' : ''}₩{tx.amount.toLocaleString()}
                                    </span>
                                    {onEditTransaction && (
                                      <button
                                        type="button"
                                        onClick={() => onEditTransaction(tx)}
                                        className="btn btn-secondary"
                                        style={{ padding: '2px 5px', color: 'var(--text-muted)' }}
                                        title="수정"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(tx.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '2px 5px', color: 'var(--danger)' }}
                                      title="삭제"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '7px 10px',
                    background: 'var(--ledger-subtle)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ color: 'var(--ledger-info)' }}>💡</span>
                  <span>
                    그래프에서 특정 일자 막대를 클릭하면 그 날의 상세 거래 항목을 바로 확인할 수 있습니다.
                  </span>
                </div>
              )}

              {stats?.spendingPattern && (
                <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--surface-border)', paddingTop: '14px', marginTop: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>평일(주중) 지출</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      ₩{stats.spendingPattern.weekdayAmount.toLocaleString()} ({stats.spendingPattern.weekdayRate}%)
                    </div>
                  </div>
                  <div style={{ height: '30px', width: '1px', background: 'var(--surface-border)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>주말 지출</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      ₩{stats.spendingPattern.weekendAmount.toLocaleString()} ({stats.spendingPattern.weekendRate}%)
                    </div>
                  </div>
                </div>
              )}
            </div></AnalyticsWidget>
          </div>

          {/* Top 5 사용처 및 결제수단 통계 */}
          <div className="analytics-detail-lists">
            {/* Top 5 사용처 */}
            <AnalyticsWidget id="merchants"><div className="glass-panel analytics-merchants-panel" style={{ padding: '12px 16px' }}>
              <h4 className="analytics-card-title">
                <Tag size={16} aria-hidden="true" /> 주요 지출처 Top 5
              </h4>
              {(!stats?.topMerchants || stats.topMerchants.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '14px 0' }}>데이터 없음</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stats.topMerchants.slice(0, 5).map((m: any, idx: number) => (
                    <div key={m.merchant} className={`analytics-merchant-row${onSelectMerchant ? ' is-clickable' : ''}`}
                      onClick={() => onSelectMerchant?.(m.merchant, selectedMonth)}
                      role={onSelectMerchant ? 'button' : undefined}
                      tabIndex={onSelectMerchant ? 0 : undefined}
                      onKeyDown={event => {
                        if (onSelectMerchant && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          onSelectMerchant(m.merchant, selectedMonth);
                        }
                      }}
                      title={onSelectMerchant ? `${m.merchant} 거래 내역 보기` : m.merchant}>
                      <span className="analytics-merchant-rank">{idx + 1}</span>
                      <div className="analytics-merchant-info"><span className="analytics-merchant-name">{m.merchant}</span><span className="analytics-merchant-count">{m.count}건</span></div>
                      <span className="analytics-merchant-amount">₩{m.amount.toLocaleString()}{onSelectMerchant && <ArrowRight size={12} aria-hidden="true" />}</span>
                    </div>
                  ))}
                </div>
              )}
            </div></AnalyticsWidget>

            {/* 결제수단별 비중 */}
            <AnalyticsWidget id="payments"><div className="glass-panel analytics-payments-panel" style={{ padding: '12px 16px' }}>
              <h4 className="analytics-card-title">
                <CreditCard size={16} aria-hidden="true" /> 결제 수단별 비중
              </h4>
              {(!stats?.appBreakdown || stats.appBreakdown.length === 0) ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>데이터 없음</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.appBreakdown.map((app: any) => (
                    <div key={app.sourceApp} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{app.sourceApp}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({app.count}건)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.percentage}%</span>
                        <span style={{ fontWeight: 700, color: 'var(--ledger-info)' }}>₩{app.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div></AnalyticsWidget>
          </div>
        </div>
      )}

        </div>
      </section>
    </AnalyticsLayout>
  );
}
