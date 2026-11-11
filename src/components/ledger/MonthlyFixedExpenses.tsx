'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Plus, RefreshCw, Settings } from 'lucide-react';
import { kstDate, SCHEDULED_FIXED_PACKAGE } from '@/lib/fixed-expense-schedule';
import type { Transaction } from './ledger-types';
import LedgerDialog from './LedgerDialog';
import { SpreadsheetTable, SpreadsheetCell } from './SpreadsheetTable';
import TransactionCell from './TransactionCell';
import LedgerNewRow from './LedgerNewRow';
import { ListDragHandle } from './ListOrderControls';
import { useCardListOrder } from '@/hooks/use-card-list-order';
import { classifyTransactionRole, resolveCategoryInfo, type HouseholdCategory } from '@/lib/household-categories';
import type { HouseholdPaymentMethod } from '@/lib/payment-methods';

interface Props { categories: HouseholdCategory[]; paymentMethods: HouseholdPaymentMethod[]; onCellSaved: (item: Transaction) => void; month: string; refreshKey: number; actual: Transaction[]; onChanged: () => void; onManage: () => void; onEdit: (tx: Transaction) => void; initialExpanded?: boolean; }
export default function MonthlyFixedExpenses({ categories, paymentMethods, month, refreshKey, actual, onChanged, onCellSaved, onManage, onEdit, initialExpanded = true }: Props) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [removing, setRemoving] = useState<Transaction | null>(null);
  const [items, setItems] = useState<Transaction[]>([]);
  const [imported, setImported] = useState(false);
  const [expanded, setExpanded] = useState(initialExpanded);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [linking, setLinking] = useState<Transaction | null>(null);
  const [actualId, setActualId] = useState('');
  const [sortBy, setSortBy] = useState<{ field: 'date' | 'merchant' | 'category' | 'paymentMethod' | 'amount'; direction: 'asc' | 'desc' } | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/card-transactions/monthly-fixed-expenses?month=${month}`, { signal, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (signal?.aborted) return;
      const txs: Transaction[] = data.transactions || [];
      setItems(txs); setImported(data.imported);

      const serverChecked = txs.filter(tx => Boolean((tx.rawData as any)?.checked)).map(tx => tx.id);
      let localChecked: string[] = [];
      try { localChecked = JSON.parse(localStorage.getItem(`monthly-fixed-checked:${month}`) || '[]'); } catch {}

      const missingOnServer = localChecked.filter(id => !serverChecked.includes(id) && txs.some(tx => tx.id === id));
      if (missingOnServer.length > 0) {
        const merged = Array.from(new Set([...serverChecked, ...missingOnServer]));
        setCheckedItems(merged);
        void fetch('/api/card-transactions/monthly-fixed-expenses', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'syncChecked', month, checkedIds: merged }),
        }).then(() => {
          if (mounted.current) onChanged();
        });
      } else {
        setCheckedItems(serverChecked);
        try { localStorage.setItem(`monthly-fixed-checked:${month}`, JSON.stringify(serverChecked)); } catch {}
      }
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : '고정비 조회 실패'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [month, onChanged]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, refreshKey]);
  useEffect(() => { setExpanded(initialExpanded); setLinking(null); setMessage(''); setItems([]); setImported(false); }, [month, initialExpanded]);
  const toggleChecked = async (id: string) => {
    const isCurrentlyChecked = checkedItems.includes(id);
    const nextChecked = !isCurrentlyChecked;
    const nextList = nextChecked ? [...checkedItems, id] : checkedItems.filter(item => item !== id);

    setCheckedItems(nextList);
    setItems(current => current.map(tx => tx.id === id ? { ...tx, rawData: { ...((tx.rawData as any) || {}), checked: nextChecked } } : tx));
    try { localStorage.setItem(`monthly-fixed-checked:${month}`, JSON.stringify(nextList)); } catch {}

    try {
      const res = await fetch('/api/card-transactions/monthly-fixed-expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleCheck', id, checked: nextChecked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (mounted.current) onChanged();
    } catch (e) {
      setCheckedItems(checkedItems);
      setItems(current => current.map(tx => tx.id === id ? { ...tx, rawData: { ...((tx.rawData as any) || {}), checked: isCurrentlyChecked } } : tx));
      try { localStorage.setItem(`monthly-fixed-checked:${month}`, JSON.stringify(checkedItems)); } catch {}
      setError(e instanceof Error ? e.message : '체크 상태 저장 실패');
    }
  };
  const mutate = async (method: 'POST' | 'PATCH' | 'DELETE', body: object) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/card-transactions/monthly-fixed-expenses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      if (!mounted.current) return;
      if (method === 'POST') {
        if (!data.count) {
          setMessage('해당 월에 적용할 고정비가 없습니다. 고정비 관리에서 항목과 시작일을 확인해 주세요.');
        } else if (data.addedCount > 0) {
          setMessage(`${data.count}건의 고정비를 반영했습니다. (신규 ${data.addedCount}건 추가)`);
        } else if (data.updatedCount > 0) {
          setMessage(`${data.count}건의 고정비를 최신 정보로 갱신했습니다.`);
        } else {
          setMessage(`${data.count}건의 고정비가 모두 반영되어 있습니다.`);
        }
      }
      setLinking(null); setRemoving(null); await load(); if (mounted.current) onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : '저장 실패'); } finally { setBusy(false); }
  };
  const isIncomeTx = (tx: Transaction) => classifyTransactionRole(tx, categories) === 'INCOME' || tx.type === 'DEPOSIT';
  const expenseItems = items.filter(tx => !isIncomeTx(tx));
  const incomeItems = items.filter(tx => isIncomeTx(tx));

  const totalExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const checkedExpense = expenseItems.filter(tx => checkedItems.includes(tx.id)).reduce((sum, item) => sum + item.amount, 0);
  const pendingExpense = totalExpense - checkedExpense;

  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const checkedIncome = incomeItems.filter(tx => checkedItems.includes(tx.id)).reduce((sum, item) => sum + item.amount, 0);
  const pendingIncome = totalIncome - checkedIncome;

  const order = useCardListOrder('monthly-fixed-expenses', items, items);
  const orderedItems = sortBy ? [...order.ordered].sort((a, b) => {
    let result = 0;
    if (sortBy.field === 'amount') result = a.amount - b.amount;
    else if (sortBy.field === 'date') result = (a.scheduledFor || a.notifiedAt).localeCompare(b.scheduledFor || b.notifiedAt);
    else {
      const key = sortBy.field === 'paymentMethod' ? 'cardOrAccount' : sortBy.field;
      result = String(a[key] || '').localeCompare(String(b[key] || ''), 'ko-KR');
    }
    return sortBy.direction === 'asc' ? result : -result;
  }) : order.ordered;
  const sortHeader = (label: string, field: NonNullable<typeof sortBy>['field']) => <button type="button" className="ledger-column-sort" onClick={() => setSortBy(current => ({ field, direction: current?.field === field && current.direction === 'asc' ? 'desc' : 'asc' }))} aria-label={`${label} ${sortBy?.field === field && sortBy.direction === 'asc' ? '내림차순' : '오름차순'} 정렬`}>{label}{sortBy?.field === field ? sortBy.direction === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/> : <ArrowUpDown size={14}/>}</button>;
  const merchants = [...new Set([...items, ...actual].map(tx => tx.merchant || tx.title).filter(Boolean))];
  const entryProps = { categories, paymentMethods, merchants, recentItems: [...items, ...actual], fixedMonth: month, disabled: loading || busy,
    onSaved: (created: Transaction) => {
      setItems(current => [...current.filter(item => item.id !== created.id), created].sort((a, b) => (a.scheduledFor || '').localeCompare(b.scheduledFor || '')));
      setImported(true); onCellSaved(created);
    },
  };
  return <section className={`ledger-surface ledger-fixed-section${expanded ? '' : ' ledger-fixed-section--collapsed'}`} aria-busy={loading}>
    <div data-ledger-tour="monthly-fixed" className="ledger-section-heading">
      <div className="ledger-fixed-heading-group"><button type="button" className="ledger-section-toggle" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} aria-controls="monthly-fixed-list">
        <ChevronDown size={18} style={{ transform: expanded ? 'rotate(180deg)' : undefined }}/><h2>이달의 고정비</h2><span className="ledger-muted">{loading ? '불러오는 중…' : `${items.length}건`}</span>
      </button><button type="button" className="btn btn-secondary ledger-icon-button" aria-label="고정비 관리" title="고정비 관리" onClick={onManage}><Settings size={17}/></button></div>
      <div className="ledger-fixed-summary" aria-live="polite">
        <span>지출 반영 <strong>{loading ? '…' : `₩${checkedExpense.toLocaleString()}`}</strong></span>
        <span>예정 <strong>{loading ? '…' : `₩${pendingExpense.toLocaleString()}`}</strong></span>
        {incomeItems.length > 0 && <>
          <span style={{ color: 'var(--income-color, #ef4444)' }}>수입 반영 <strong>{loading ? '…' : `+₩${checkedIncome.toLocaleString()}`}</strong></span>
          <span style={{ color: 'var(--income-color, #ef4444)' }}>수입 예정 <strong>{loading ? '…' : `+₩${pendingIncome.toLocaleString()}`}</strong></span>
        </>}
        {!expanded && <span>{incomeItems.length > 0 ? `순지출 ₩${Math.max(0, totalExpense - totalIncome).toLocaleString()}` : `합계 ₩${totalExpense.toLocaleString()}`}</span>}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy || loading}
        onClick={() => void mutate('POST', { month, force: true })}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        {imported ? <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> : <Plus size={15} />}
        {busy ? '불러오는 중…' : imported ? '고정비 다시 불러오기' : '이달의 고정비 불러오기'}
      </button>
    </div>
    {error && <p role="alert" className="ledger-error">{error} <button type="button" className="btn btn-secondary" onClick={() => void load()}>다시 불러오기</button></p>}
    {message && <p role="status">{message}</p>}
    <div id="monthly-fixed-list" hidden={!expanded}>
      <p className="ledger-muted" style={{ margin: '4px 0 10px', fontSize: '12px' }}>체크박스를 선택하면 해당 금액이 이달의 지출 집계에 반영됩니다.</p>
      <div className="ledger-fixed-mobile-sort">
        <label className="ledger-field">정렬 기준<select value={sortBy?.field || ''} onChange={event => setSortBy(event.target.value ? { field: event.target.value as NonNullable<typeof sortBy>['field'], direction: sortBy?.direction || 'asc' } : null)}><option value="">직접 정렬</option><option value="date">일시</option><option value="merchant">사용처</option><option value="category">카테고리</option><option value="paymentMethod">결제수단</option><option value="amount">금액</option></select></label>
        <button type="button" className="btn btn-secondary" disabled={!sortBy} onClick={() => setSortBy(current => current ? { ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' } : null)}>{sortBy?.direction === 'desc' ? '내림차순 ↓' : '오름차순 ↑'}</button>
      </div>
      <SpreadsheetTable label="이달의 고정비" disabled={loading || busy} rowActions={rowId => {
        const tx = orderedItems.find(item => item.id === rowId);
        if (!tx) return [];
        return [
          { label: '상세 수정', disabled: busy, onClick: () => onEdit(tx) },
          ...(tx.packageName === SCHEDULED_FIXED_PACKAGE ? [{ label: '실제 결제 연결', disabled: busy, onClick: () => { setLinking(tx); setActualId(''); } }] : []),
          { label: '이달에서 제외', danger: true, disabled: busy, onClick: () => setRemoving(tx) },
        ];
      }}>
        <colgroup><col style={{ width: '4%' }}/>{[8, 41, 16, 20, 15].map((width, index) => <col key={index} style={{ width: `${width * 0.96}%` }}/>)}</colgroup>
        <thead><tr><th className="ledger-handle-column"><span className="sr-only">순서</span></th><th>{sortHeader('일시', 'date')}</th><th>{sortHeader('사용처', 'merchant')}</th><th>{sortHeader('카테고리', 'category')}</th><th>{sortHeader('결제수단', 'paymentMethod')}</th><th className="ledger-cell--end">{sortHeader('금액', 'amount')}</th></tr></thead><tbody>
        <LedgerNewRow {...entryProps} orderColumn position="top" neighbor={orderedItems[0]}/>
        {orderedItems.map((tx, index) => {
          const role = classifyTransactionRole(tx, categories);
          const isIncome = role === 'INCOME' || tx.type === 'DEPOSIT';
          const isPositive = isIncome || tx.type === 'CANCEL';
          const cat = resolveCategoryInfo(tx.category || '', categories);
          const cell = { item: tx, neighbor: orderedItems[index - 1] || orderedItems[index + 1], recentItems: [...items, ...actual], categories: categories.filter(category => category.type === 'EXPENSE' || category.type === 'INCOME'), merchants, paymentMethods, disabled: loading || busy, onSaved: (updated: Transaction) => {
            setItems(current => current.map(item => item.id === updated.id ? updated : item));
            onCellSaved(updated);
          } };
          const date = tx.scheduledFor ? kstDate(tx.scheduledFor).slice(5).replace('-', '.') : '—';
          const isChecked = checkedItems.includes(tx.id);
          return <tr key={tx.id} className={`ledger-spreadsheet-row${isChecked ? ' ledger-fixed-row--checked' : ''}`} data-order-id={tx.id} data-transaction-id={tx.id} onKeyDown={event => {
            if (event.altKey && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onEdit(tx); }
          }}>
            <td className="ledger-handle-column"><ListDragHandle id={tx.id} ids={orderedItems.map(item => item.id)} disabled={order.disabled || busy || Boolean(sortBy)} move={order.move}/></td>
            {tx.packageName === SCHEDULED_FIXED_PACKAGE
              ? <TransactionCell {...cell} field="notifiedAt" label="납부일" className="ledger-date-cell"><span>{date}</span></TransactionCell>
              : <SpreadsheetCell id={`${tx.id}:notifiedAt`} label={`${isIncome ? '입금일' : '납부일'} (실제 거래 연결됨, 읽기 전용)`} value={date} className="ledger-date-cell"><span>{date}</span></SpreadsheetCell>}
            <TransactionCell {...cell} field="merchant" label="고정비 항목"><span className="ledger-fixed-merchant"><input type="checkbox" aria-label={`${tx.merchant || tx.title} ${isIncome ? '입금' : '납부'} 완료`} checked={isChecked} onChange={() => toggleChecked(tx.id)} onClick={event => event.stopPropagation()}/><span className="ledger-fixed-merchant-label">{tx.merchant || tx.title}</span>{isIncome && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: 'rgba(239, 68, 68, 0.12)', color: 'var(--income-color, #ef4444)', marginLeft: '4px' }}>수입</span>}</span></TransactionCell>
            <TransactionCell {...cell} field="category" label="고정비 카테고리"><span className="ledger-category-label">{cat.emoji} {cat.label}</span></TransactionCell>
            <TransactionCell {...cell} field="cardOrAccount" label="결제수단">{tx.cardOrAccount || '결제수단 미지정'}</TransactionCell>
            <TransactionCell {...cell} field="amount" label="고정비 금액" className="ledger-cell--end ledger-money"><span style={{ color: isPositive ? 'var(--income-color, #ef4444)' : 'var(--expense-color, #3b82f6)' }}>{isPositive ? '+' : '−'}₩{tx.amount.toLocaleString()}</span></TransactionCell>
          </tr>;
        })}
        {!items.length && <tr><td colSpan={6} className="ledger-empty">{loading ? '고정비를 불러오는 중입니다…' : ''}</td></tr>}
        <LedgerNewRow {...entryProps} orderColumn position="bottom" neighbor={orderedItems.at(-1)}/>
      </tbody></SpreadsheetTable>
    </div>
    {removing && <LedgerDialog title="이달의 고정비에서 제외" onClose={() => { if (!busy) setRemoving(null); }}>
      <p>{removing.merchant || removing.title} 항목을 이달의 고정비에서 제외할까요?</p>
      <p className="ledger-muted">{removing.packageName === SCHEDULED_FIXED_PACKAGE ? '이달의 예정 내역과 집계에서 제외합니다.' : '연결된 실제 결제는 일반 수입·지출 내역에 남습니다.'} 고정비 관리 목록과 다른 달의 내역은 유지됩니다.</p>
      {error && <p role="alert" className="ledger-error">{error}</p>}
      <div className="ledger-dialog-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => setRemoving(null)}>취소</button><button className="btn btn-primary" disabled={busy} onClick={() => void mutate('DELETE', { id: removing.id })}>{busy ? '제외 중…' : '이달에서 제외'}</button></div>
    </LedgerDialog>}
    {linking && (() => {
      const linkingIsIncome = classifyTransactionRole(linking, categories) === 'INCOME' || linking.type === 'DEPOSIT';
      const linkingCandidates = actual.filter(tx => !tx.fixedExpenseId && (linkingIsIncome ? tx.type === 'DEPOSIT' : ['PAYMENT', 'WITHDRAWAL'].includes(tx.type)));
      return <LedgerDialog title={`실제 ${linkingIsIncome ? '입금' : '결제'} 연결`} onClose={() => { if (!busy) setLinking(null); }}>
        <p>{linking.merchant}에 해당하는 {linkingIsIncome ? '수입(입금)' : '지출'}을 선택해 주세요. 예정 금액 대신 선택한 거래의 실제 금액을 한 번만 집계합니다.</p>
        <label className="ledger-field">이달의 {linkingIsIncome ? '입금' : '결제'}<select value={actualId} onChange={e => setActualId(e.target.value)}><option value="">거래 선택</option>{linkingCandidates.map(tx => <option key={tx.id} value={tx.id}>{kstDate(tx.notifiedAt)} · {tx.merchant || tx.title} · {tx.type === 'DEPOSIT' ? '+' : '−'}₩{tx.amount.toLocaleString()}</option>)}</select></label>
        {!linkingCandidates.length && <p className="ledger-muted">연결할 {linkingIsIncome ? '입금 내역이' : '지출이'} 없습니다. 실제 {linkingIsIncome ? '입금을' : '결제를'} 먼저 등록해 주세요.</p>}
        {error && <p role="alert" className="ledger-error">{error}</p>}
        <div className="ledger-dialog-actions"><button className="btn btn-secondary" disabled={busy} onClick={() => setLinking(null)}>취소</button><button className="btn btn-primary" disabled={!actualId || busy} onClick={() => void mutate('PATCH', { scheduledId: linking.id, actualId })}>{busy ? '연결 중…' : '연결하기'}</button></div>
      </LedgerDialog>;
    })()}
  </section>;
}
