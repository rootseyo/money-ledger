'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import './category-breakdown.css';

interface CategorySlice {
  name: string; label: string; emoji: string; color: string; amount: number; percent: number;
}

export default function CategoryBreakdown({ kind, total, items, pieData, selected, onSelect, savingsRate }: {
  kind: 'expense' | 'income' | 'savings'; total: number; items: CategorySlice[]; pieData: CategorySlice[];
  selected: string; onSelect: (category: string) => void;
  savingsRate?: number;
}) {
  const income = kind === 'income';
  const savings = kind === 'savings';
  const privateValue = income || savings;
  const label = income ? '수입' : savings ? '저축' : '지출';
  const color = income ? 'var(--income-color, #ef4444)' : savings ? '#10b981' : 'var(--expense-color, #3b82f6)';
  const icon = income ? '💰' : savings ? '🏦' : '💳';
  const shortTotal = total >= 10000 ? `${(total / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만` : total.toLocaleString('ko-KR');
  const toggle = (name: string) => onSelect(selected === name ? 'ALL' : name);
  return <section className="ledger-category-breakdown" data-empty={items.length ? undefined : 'true'} aria-label={`카테고리별 ${label}`}>
    <header className="ledger-category-heading">
      <h3>{icon} 카테고리별 {label}</h3>
      <strong style={{ color }} data-sensitive-income={privateValue ? 'true' : undefined}>₩{total.toLocaleString()}</strong>
      {savings && savingsRate !== undefined && (
        <span
          className="ledger-savings-rate-badge"
          data-sensitive-income="true"
          style={{
            fontSize: '0.72rem',
            color: '#10b981',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '1px 6px',
            borderRadius: '9999px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          저축률 {savingsRate.toFixed(1)}%
        </span>
      )}
      {selected !== 'ALL' && <button type="button" className="ledger-text-button" onClick={() => onSelect('ALL')}>초기화</button>}
    </header>
    {!items.length ? <p className="ledger-category-empty">{label} 내역이 없습니다.</p> : <div className="ledger-category-body">
      <div className="ledger-category-donut" data-sensitive-income={privateValue ? 'true' : undefined}>
        <ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie data={pieData} dataKey="amount" nameKey="label" cx="50%" cy="50%" innerRadius="58%" outerRadius="90%" paddingAngle={2}
            onClick={entry => {
              const name = entry?.payload?.name;
              // The aggregated slice is explored through the complete list alongside.
              if (typeof name === 'string' && items.some(item => item.name === name)) toggle(name);
            }}>
            {pieData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={item.color} stroke="var(--surface-color)" strokeWidth={2} cursor="pointer"/>) }
          </Pie>
          <Tooltip formatter={value => [`₩${Number(value).toLocaleString()}`, `${label}액`]} contentStyle={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)', borderRadius: 8, fontSize: 12 }}/>
        </PieChart></ResponsiveContainer>
        <div className="ledger-category-donut-total">
          <span>{label}</span>
          <strong style={{ color }}>₩{shortTotal}</strong>
          {savings && savingsRate !== undefined && (
            <span data-sensitive-income="true" style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
              저축률 {savingsRate.toFixed(1)}%
            </span>
          )}
        </div>
      </div>
      <div className="ledger-category-list" aria-label={`${label} 카테고리 필터`}>
        {items.map(item => <button key={item.name} type="button" className="ledger-category-item" aria-pressed={selected === item.name} onClick={() => toggle(item.name)}
          title={`${item.label}: ₩${item.amount.toLocaleString()} (${item.percent.toFixed(1)}%)`}>
          <span className="ledger-category-dot" style={{ background: item.color }}/>
          <span className="ledger-category-name">{item.emoji} {item.label}</span>
          <strong style={{ color }} data-sensitive-income={privateValue ? 'true' : undefined}>₩{item.amount.toLocaleString()}</strong>
          <span className="ledger-category-percent">{item.percent.toFixed(0)}%</span>
        </button>)}
      </div>
    </div>}
  </section>;
}
