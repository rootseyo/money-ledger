'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './HouseholdCalendar.module.css';
import { classifyTransactionRole, resolveCategoryInfo, type HouseholdCategory } from '@/lib/household-categories';
import { SCHEDULED_FIXED_PACKAGE } from '@/lib/fixed-expense-schedule';

export interface CalendarTransaction {
  id: string;
  sourceApp?: string;
  notifiedAt: string;
  type?: string | null;
  amount: number;
  merchant?: string | null;
  category?: string | null;
  cardOrAccount?: string | null;
  content?: string | null;
  title?: string | null;
  isReported?: boolean;
  fixedExpenseId?: string | null;
  scheduledFor?: string | null;
  packageName?: string | null;
}

export function isFixedExpenseTx(tx: Pick<CalendarTransaction, 'fixedExpenseId' | 'scheduledFor' | 'packageName'>) {
  return !!tx.fixedExpenseId || !!tx.scheduledFor || tx.packageName === SCHEDULED_FIXED_PACKAGE;
}

export interface DaySummary {
  income: number;
  expense: number;
  savings: number;
  txs: CalendarTransaction[];
}

interface Props {
  month: string;
  selectedDate: string | null;
  data: { year: number; month: number; firstDay: number; lastDate: number; dayMap: Map<number, DaySummary> };
  onMonthChange: (month: string) => void;
  onSelect: (date: string, bounds: DOMRect) => void;
  categories?: HouseholdCategory[];
}

function compactAmount(value: number) {
  if (Math.abs(value) >= 10000) return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value / 10000)}만`;
  return value.toLocaleString('ko-KR');
}

// 정렬 순서: 저축 -> 지출 -> 소득 -> 기타
function getRolePriority(role: string): number {
  if (role === 'SAVINGS') return 1;
  if (role === 'CONSUMPTION') return 2;
  if (role === 'INCOME') return 3;
  return 4;
}

export default function HouseholdCalendar({ month, selectedDate, data, onMonthChange, onSelect, categories = [] }: Props) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const cellCount = Math.ceil((data.firstDay + data.lastDate) / 7) * 7;
  const moveMonth = (offset: number) => {
    const next = new Date(data.year, data.month - 1 + offset, 1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };

  return <section className={styles.calendar} aria-label="월간 가계부 달력">
    <header className={styles.toolbar}>
      <div><h2>{data.month}월 <span>{data.year}</span></h2><p>날짜를 선택해 거래를 확인하고 기록하세요</p></div>
      <div className={styles.navigation}>
        <button type="button" onClick={() => onMonthChange(today.slice(0, 7))}>오늘</button>
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
        <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
      </div>
    </header>
    <div className={styles.legend}>
      <span data-kind="savings">저축</span>
      <span data-kind="expense">지출</span>
      <span data-kind="income">소득</span>
      <span data-kind="fixed">고정비(합산)</span>
      <span className={styles.unit}>단위: 원</span>
    </div>
    <div className={styles.weekdays} aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map((day, index) => <span key={day} data-weekend={index === 0 || index === 6}>{day}</span>)}</div>
    <div className={styles.grid}>
      {Array.from({ length: cellCount }, (_, index) => {
        const day = index - data.firstDay + 1;
        const inMonth = day >= 1 && day <= data.lastDate;
        if (!inMonth) {
          const adjacent = new Date(data.year, data.month - 1, day);
          return <div key={index} className={styles.outside} aria-hidden="true"><span className={styles.date}>{adjacent.getDate()}</span></div>;
        }
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const summary = data.dayMap.get(day);
        const count = summary?.txs.length ?? 0;

        // 고정비는 한 줄로 압축, 나머지 거래는 전부 표시 (저축 -> 지출 -> 소득 순)
        const rawTxs = summary?.txs || [];
        const fixedTxs = rawTxs.filter(isFixedExpenseTx);
        const fixedTotal = fixedTxs.reduce((sum, tx) => sum + (tx.type === 'CANCEL' ? -tx.amount : tx.amount), 0);
        const visibleTxs = rawTxs.filter(tx => !isFixedExpenseTx(tx)).sort((a, b) => {
          const pA = getRolePriority(classifyTransactionRole(a));
          const pB = getRolePriority(classifyTransactionRole(b));
          if (pA !== pB) return pA - pB;
          return b.amount - a.amount;
        });

        return <button key={index} type="button" className={styles.day} data-selected={selectedDate === date} data-today={today === date}
          aria-pressed={selectedDate === date} aria-current={today === date ? 'date' : undefined}
          aria-label={`${data.month}월 ${day}일, ${count ? `거래 ${count}건` : '거래 없음'}`}
          onClick={event => onSelect(date, event.currentTarget.getBoundingClientRect())}>
          <span className={styles.dayHeader}><span className={styles.date} data-weekend={index % 7 === 0 || index % 7 === 6}>{day}</span>{count > 0 && <span className={styles.count}>{count}건</span>}</span>
          {count > 0 && <span className={styles.events}>
            {fixedTxs.length > 0 && (
              <span
                data-kind="fixed"
                className={styles.event}
                title={`고정비 ${fixedTxs.length}건: −₩${fixedTotal.toLocaleString('ko-KR')}\n${fixedTxs.map(tx => `· ${tx.merchant || tx.title || '고정비'} ₩${tx.amount.toLocaleString('ko-KR')}`).join('\n')}`}
              >
                <span className={styles.eventLabel}>
                  <span aria-hidden="true" style={{ fontSize: '0.85em', marginRight: '2px' }}>📌</span>
                  <span className={styles.eventTitle}>고정비 {fixedTxs.length}건</span>
                </span>
                <span className={styles.amount}>
                  <span className={styles.fullAmount}>−₩{fixedTotal.toLocaleString('ko-KR')}</span>
                  <span className={styles.shortAmount}>−{compactAmount(fixedTotal)}</span>
                </span>
              </span>
            )}
            {visibleTxs.map((tx) => {
              const role = classifyTransactionRole(tx);
              const cat = resolveCategoryInfo(tx.category || '', categories);
              const isIncome = role === 'INCOME';
              const isSavings = role === 'SAVINGS';
              const isCancel = tx.type === 'CANCEL';
              const kind = isSavings ? 'savings' : isIncome ? 'income' : 'expense';
              const prefix = isSavings ? '' : isIncome ? '+' : isCancel ? '+환급 ' : '−';
              const title = tx.merchant || tx.title || cat.label || '거래';

              return (
                <span
                  key={tx.id}
                  data-kind={kind}
                  data-sensitive-income={isIncome ? 'true' : undefined}
                  className={styles.event}
                  title={`${cat.emoji} ${title} (${cat.label}): ${prefix}₩${tx.amount.toLocaleString('ko-KR')}`}
                >
                  <span className={styles.eventLabel}>
                    <span aria-hidden="true" style={{ fontSize: '0.85em', marginRight: '2px' }}>{cat.emoji}</span>
                    <span className={styles.eventTitle}>{title}</span>
                  </span>
                  <span className={styles.amount}>
                    <span className={styles.fullAmount}>{prefix}₩{tx.amount.toLocaleString('ko-KR')}</span>
                    <span className={styles.shortAmount}>{prefix}{compactAmount(tx.amount)}</span>
                  </span>
                </span>
              );
            })}
          </span>}
        </button>;
      })}
    </div>
  </section>;
}
