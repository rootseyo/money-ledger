'use client';

import { useEffect, useId, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';
import { FinancialSummary } from '@/lib/financial-assets';
import { monthAfter, projectWealth, WEALTH_GOAL } from '@/lib/wealth-goal';
import { ArrowUpRight, Minus, Plus, RotateCcw, Target } from 'lucide-react';
import './analytics-dashboard.css';

type Month = { monthStr: string; income: number; expense: number; count: number; savings?: number };
export default function WealthGoalDashboard({ privacyMode, refreshKey, fixedIncome = 0, goalAmount = WEALTH_GOAL }: { privacyMode: boolean; refreshKey?: number; fixedIncome?: number; goalAmount?: number }) {
  const [data, setData] = useState<{ summary: FinancialSummary; months: Month[]; currentMonth: string; isDefault: boolean } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [manualGrowth, setManualGrowth] = useState('');
  const gradientId = useId().replace(/:/g, '');
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(false);
    const currentMonth = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date());
    const recent = [-6, -5, -4, -3, -2, -1].map(offset => monthAfter(currentMonth, offset));
    const years = [...new Set(recent.map(month => month.slice(0, 4)))];
    const read = async (url: string) => {
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('조회 실패');
      const body = await response.json();
      if (!body.success) throw new Error('조회 실패');
      return body;
    };
    Promise.all([read('/api/financial-assets'), ...years.map(year => read(`/api/card-transactions/stats?period=year&year=${year}`))])
      .then(([assets, ...stats]) => {
        if (controller.signal.aborted) return;
        const months: Month[] = stats.flatMap(stat => stat.monthlyData).filter((month: Month) => recent.includes(month.monthStr));
        setData({ summary: assets.summary, isDefault: assets.isDefault, months, currentMonth });
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refreshKey, retry]);
  const target = Number.isSafeInteger(goalAmount) && goalAmount > 0 ? goalAmount : WEALTH_GOAL;
  const goalLabel = target % 100_000_000 === 0 ? `${target / 100_000_000}억 원` : target % 10_000 === 0 ? `${(target / 10_000).toLocaleString()}만 원` : `${target.toLocaleString()}원`;
  const panel = { padding: '20px', border: '1px solid var(--surface-border)', borderRadius: '16px' };
  if (!data) return <section className="glass-panel" style={panel}><h3>🎯 {goalLabel} 모으기</h3>{error ? <><p>자산과 증가 속도를 불러오지 못했습니다.</p><button className="btn btn-secondary" onClick={() => setRetry(value => value + 1)}>다시 시도</button></> : <p role="status">목표 달성 현황을 불러오는 중입니다…</p>}</section>;
  // 기록이 없는 달을 0원으로 간주하지 않고, 최근 최대 6개월 중 데이터가 있는 달만 사용하여 저축 금액을 계산합니다.
  const recordedWithSavings = data.months.filter(month => (month.savings ?? 0) > 0);
  const recorded = recordedWithSavings.length > 0 ? recordedWithSavings : data.months.filter(month => month.count > 0);
  const average = recorded.length ? Math.round(recorded.reduce((sum, month) => sum + (month.savings ?? 0), 0) / recorded.length) : null;
  const growth = manualGrowth !== '' ? Number(manualGrowth) : average;
  const validGrowth = growth !== null && Number.isFinite(growth);
  const goal = projectWealth(data.summary.netWorth, validGrowth ? growth : 0, target);
  const hasAssets = !data.isDefault;
  const months = goal.months;
  const duration = months === 0 ? '목표 달성!' : months === null ? '증가 속도가 필요해요' : `${Math.floor(months / 12) ? `${Math.floor(months / 12)}년 ` : ''}${months % 12 ? `${months % 12}개월` : ''}`;
  const horizon = months !== null ? Math.max(1, Math.min(months, 1200)) : 60;
  const offsets = [...new Set(Array.from({ length: 25 }, (_, index) => Math.round(index * horizon / 24)))];
  const chart = offsets.map(offset => ({ month: monthAfter(data.currentMonth, offset), amount: data.summary.netWorth + (validGrowth ? growth : 0) * offset }));
  const money = (amount: number) => privacyMode ? '••••' : `₩${Math.round(amount).toLocaleString('ko-KR')}`;
  const arrival = months !== null && months > 0 && months < 95000 ? monthAfter(data.currentMonth, months) : null;
  const arrivalLabel = arrival ? `${arrival.slice(0, 4)}년 ${Number(arrival.slice(5))}월` : null;
  const baseline = projectWealth(data.summary.netWorth, average ?? 0, target).months;
  const savedMonths = manualGrowth !== '' && baseline !== null && months !== null ? baseline - months : 0;
  const adjust = (amount: number) => setManualGrowth(String(Math.max(0, (validGrowth ? growth : 0) + amount)));
  return <section className="glass-panel wealth-dashboard">
    <div className="analytics-section-heading">
      <div><span className="analytics-eyebrow"><Target size={13} /> 우리의 목표</span><h3>{goalLabel}까지, 한 걸음씩</h3></div>
      <span className="wealth-target">목표 {goalLabel}</span>
    </div>
    {!hasAssets ? <p className="analytics-note">자산 메뉴에 내 자산과 대출을 등록하면 시작할 수 있어요.</p> : <>
      <div className="wealth-layout">
        <div className="wealth-journey">
          <span className="analytics-eyebrow">{months === 0 ? `${goalLabel}을 모았어요` : '이 속도로 모으면'}</span>
          <div className="wealth-arrival">{privacyMode ? '••••' : months === 0 ? '목표 달성!' : arrivalLabel || '얼마씩 모을까요?'}</div>
          <p className="wealth-duration">{privacyMode ? '예상 기간 숨김' : months === 0 ? '새로운 목표를 향해 나아가요.' : months !== null ? `${goalLabel}까지 약 ${duration}` : '매달 모을 금액을 아래에서 정해보세요.'}</p>
          <div className="wealth-progress-heading"><span>지금까지 <strong>{privacyMode ? '••••' : `${goal.progress.toFixed(1)}%`}</strong></span><span>{goalLabel}</span></div>
          <div className="wealth-progress" role="progressbar" aria-label={`${goalLabel} 목표 달성률`} aria-valuenow={privacyMode ? undefined : goal.progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: privacyMode ? '0%' : `${goal.progress}%` }} /></div>
          <div className="wealth-facts">
            <div><span>현재 순자산</span><strong>{money(data.summary.netWorth)}</strong></div>
            <div><span>앞으로 모을 돈</span><strong>{money(goal.remaining)}</strong></div>
          </div>
        </div>
        <div className="wealth-chart-panel">
          <div className="analytics-section-heading"><span className="analytics-eyebrow">앞으로 모이는 돈</span><span className="wealth-chart-caption">매달 {validGrowth ? money(growth) : '—'}씩</span></div>
          {privacyMode ? <div className="wealth-chart-hidden">금액 숨김 모드</div> : <div className="wealth-chart">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
              <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#62a68a" stopOpacity={0.18} /><stop offset="100%" stopColor="#62a68a" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--surface-border)" strokeDasharray="3 6" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={60} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={value => `${value.slice(0, 4)}.${value.slice(5)}`} />
              <YAxis axisLine={false} tickLine={false} width={42} tickCount={4} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={value => `${Number((value / 100000000).toFixed(1))}억`} domain={['auto', Math.max(target, ...chart.map(point => point.amount))]} />
              <Tooltip formatter={value => [money(Number(value)), '모이는 돈']} labelFormatter={label => { const value = String(label); return `${value.slice(0, 4)}년 ${Number(value.slice(5))}월`; }} contentStyle={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)', borderRadius: 12, fontSize: 12 }} />
              <ReferenceLine y={target} stroke="#62a68a" strokeDasharray="4 6" label={{ value: goalLabel, fill: '#62a68a', position: 'insideTopRight', fontSize: 11 }} />
              <Area name="모이는 돈" type="linear" dataKey="amount" stroke="#62a68a" strokeWidth={2.5} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, stroke: 'var(--surface-color)', strokeWidth: 2 }} />
            </AreaChart></ResponsiveContainer>
          </div>}
        </div>
      </div>
      <div className="wealth-simulator">
        <div className="wealth-simulator-heading"><div><h4>매달 얼마씩 모을까요?</h4><p>금액을 바꾸면 {goalLabel}을 모으는 날도 달라져요.</p></div>{manualGrowth !== '' && <button type="button" className="wealth-reset" onClick={() => setManualGrowth('')}><RotateCcw size={12} />내 기록으로</button>}</div>
        <div className="wealth-simulator-controls">
          <div className="wealth-amount-input"><button type="button" onClick={() => adjust(-100000)} aria-label="매달 모을 돈 10만원 줄이기"><Minus size={16} /></button><label htmlFor="goal-monthly-growth" className="wealth-input-label"><input id="goal-monthly-growth" aria-label="매달 모을 돈, 만원 단위" type="number" min="0" step="10" placeholder="금액 입력" value={privacyMode && manualGrowth === '' ? '' : manualGrowth !== '' ? Number(manualGrowth) / 10000 : validGrowth ? Math.round(growth / 10000) : ''} onChange={event => { setManualGrowth(event.target.value === '' ? '' : String(Math.max(0, Number(event.target.value)) * 10000)); }} /><span>만원 / 월</span></label><button type="button" onClick={() => adjust(100000)} aria-label="매달 모을 돈 10만원 늘리기"><Plus size={16} /></button></div>
          <div className="wealth-quick-amounts">{[100, 200, 300, 500].map(amount => <button type="button" key={amount} aria-pressed={manualGrowth !== '' && Number(manualGrowth) === amount * 10000} onClick={() => setManualGrowth(String(amount * 10000))}>{amount}만원</button>)}</div>
          {savedMonths > 0 && !privacyMode && <span className="wealth-faster"><ArrowUpRight size={14} />{savedMonths}개월 더 빨라져요</span>}
        </div>
      </div>
      <div className="wealth-explanation"><span>{manualGrowth !== '' ? '직접 정한 금액으로 계산했어요.' : recorded.length ? `최근 ${recorded.length}개월 동안 매달 저축한 금액을 기준으로 계산했어요.` : '기록이 쌓이면 매달 모으는 돈을 자동으로 계산해요.'}</span><details><summary>계산 기준</summary><p>순자산은 내 자산에서 대출을 뺀 금액이에요. 매달 모으는 돈은 최근 최대 6개월간 기록된 저축 금액을 기준으로 계산했어요. 앞으로도 같은 금액을 모은다고 가정하며 투자 수익은 포함하지 않아요.{months !== null && months > 1200 && ' 그래프는 앞으로 100년까지만 보여드려요.'}</p></details></div>
    </>}
  </section>;
}
