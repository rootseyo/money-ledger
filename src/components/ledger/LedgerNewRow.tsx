'use client';

import { useEffect, useRef, useState } from 'react';
import { useLedgerHistory } from './LedgerHistory';
import { ledgerSuggestions, rankLedgerOptions } from './ledger-suggestions';
import { PlusCircle } from 'lucide-react';
import { isIncomeSensitive } from '@/lib/card-income-privacy';
import type { HouseholdCategory } from '@/lib/household-categories';
import type { HouseholdPaymentMethod } from '@/lib/payment-methods';
import { formatCellAmount } from '@/lib/ledger-cell';
import { defaultTransactionDate, kstDatetime, transactionDraft, transactionEntryPayload, type TransactionDraft } from '@/lib/transaction-entry';
import { SpreadsheetCell } from './SpreadsheetTable';
import type { Transaction } from './ledger-types';

interface Props {
  position: 'top' | 'bottom';
  categories: HouseholdCategory[];
  paymentMethods: HouseholdPaymentMethod[];
  merchants: string[];
  selection?: boolean;
  showContent?: boolean;
  disabled?: boolean;
  seed?: Transaction;
  neighbor?: Transaction;
  recentItems?: Transaction[];
  onSaved: (item: Transaction, date: string) => void;
  fixedMonth?: string;
  month?: string;
  orderColumn?: boolean;
  /** Non-zero value opens this row for entry (e.g. right after the tutorial). */
  openSignal?: number;
  entryDate?: string;
  onOpened?: () => void;
}

const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const emptyDraft = (date?: string): TransactionDraft => ({ ...transactionDraft(undefined, false, date), notifiedAt: '' });

export default function LedgerNewRow(p: Props) {
  const history = useLedgerHistory();
  const lastEscape = useRef(0);
  const draftUndo = useRef<TransactionDraft[]>([]);
  const activeMonth = p.fixedMonth || p.month;
  const defaultDate = defaultTransactionDate(activeMonth, p.entryDate);
  const initial = p.seed ? transactionDraft(p.seed, true, defaultDate) : emptyDraft(defaultDate);
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(draft);
  const [busy, setBusy] = useState(false);
  const [keepEntering, setKeepEntering] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const generation = useRef(0);
  const row = useRef<HTMLTableRowElement>(null);
  const pending = useRef(false);
  const entryId = useRef<string | null>(null);
  const prefix = `new-${p.fixedMonth ? 'fixed' : 'transaction'}-${p.position}`;
  const update = (values: Partial<TransactionDraft>) => {
    draftUndo.current.push({ ...draftRef.current });
    draftRef.current = { ...draftRef.current, ...values };
    setDraft(draftRef.current); setError('');
  };
  const begin = () => {
    if (!draftRef.current.notifiedAt) update({ notifiedAt: defaultDate });
  };
  const reset = (record = true, returnFocus = true) => {
    if (record) draftUndo.current.push({ ...draftRef.current }); else draftUndo.current = [];
    draftRef.current = emptyDraft(defaultDate); setDraft(draftRef.current);
    entryId.current = null; setError(''); setMobileOpen(false); setRevision(++generation.current);
    if (returnFocus) requestAnimationFrame(() => row.current?.querySelector<HTMLTableCellElement>('[data-grid-cell]')?.focus());
  };
  const openMobileForm = () => {
    const currentDate = draftRef.current.notifiedAt || defaultDate;
    if (!draftRef.current.notifiedAt) update({ notifiedAt: currentDate });
    setMobileOpen(true);
    requestAnimationFrame(() => {
      const input = row.current?.querySelector<HTMLInputElement>('[data-mobile-amount]') || row.current?.querySelector<HTMLInputElement>('[data-mobile-merchant]');
      input?.focus();
      window.setTimeout(() => input?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: scrollBehavior() }), 180);
    });
  };
  const openSignalHandler = useRef<() => void>(() => {});
  openSignalHandler.current = () => {
    if (pending.current) return;
    const targetDate = p.entryDate && (!activeMonth || p.entryDate.slice(0, 7) === activeMonth) ? p.entryDate : defaultDate;
    update({ notifiedAt: targetDate });
    const mobileCell = row.current?.querySelector<HTMLElement>('.ledger-new-row-mobile');
    if (mobileCell && getComputedStyle(mobileCell).display !== 'none') { openMobileForm(); return; }
    begin();
    requestAnimationFrame(() => {
      row.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: scrollBehavior() });
      row.current?.querySelector<HTMLTableCellElement>(`[data-grid-cell="${prefix}:amount"]`)?.focus({ preventScroll: true });
    });
  };
  const { openSignal, onOpened } = p;
  useEffect(() => {
    if (!openSignal) return;
    openSignalHandler.current();
    onOpened?.();
  }, [openSignal, onOpened]);
  const setMobilePayment = (id: string) => {
    const method = p.paymentMethods.find(item => item.id === id);
    update({ sourceApp: id, cardOrAccount: method?.name || '' });
  };
  const save = async () => {
    if (pending.current || p.disabled) return;
    try {
      const current = draftRef.current;
      const values = transactionEntryPayload({ ...current, merchant: current.merchant.trim() || (p.fixedMonth ? '' : current.category || (current.type === 'DEPOSIT' ? '수입' : '지출')) });
      if (p.fixedMonth && current.notifiedAt.slice(0, 7) !== p.fixedMonth) throw new Error('납부일은 선택한 월 안에서 입력해 주세요.');
      pending.current = true; setBusy(true); setError(''); setNotice('');
      entryId.current ||= crypto.randomUUID();
      const payload = {
        ...values, title: values.merchant,
        content: values.content || (p.fixedMonth ? '월별 고정비' : ''),
        rawData: { manual: true, entryId: entryId.current },
        ...(p.fixedMonth ? { month: p.fixedMonth, action: 'create', entryId: entryId.current } : {}),
      };
      const response = await fetch(p.fixedMonth ? '/api/card-transactions/monthly-fixed-expenses' : '/api/card-transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.transaction) throw new Error(data.error || '등록하지 못했습니다. 다시 시도해 주세요.');
      const savedEntryId = entryId.current;
      for (const key of ['merchant', 'category', 'sourceApp'] as const) history.remember(key, current[key]);
      p.onSaved(data.transaction, kstDatetime(data.transaction.notifiedAt).slice(0, 10));
      if (keepEntering) {
        draftRef.current = { ...current, merchant: '', amount: '', content: '' };
        setDraft(draftRef.current); draftUndo.current = []; entryId.current = null;
        setRevision(++generation.current);
        requestAnimationFrame(() => {
          const mobile = row.current?.querySelector<HTMLInputElement>('[data-mobile-amount]');
          if (mobile && mobile.getClientRects().length) mobile.focus();
          else row.current?.querySelector<HTMLTableCellElement>(`[data-grid-cell="${prefix}:amount"]`)?.focus();
        });
      } else reset(false);
      // The transaction has already committed. A history failure must never invite another save.
      try { await history.perform({ action: 'track-create', id: data.transaction.id, entryId: savedEntryId }); }
      catch { setNotice('저장되었습니다. 실행 취소 이력은 남기지 못했어요. 수정·삭제는 내역에서 할 수 있어요.'); }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '등록에 실패했습니다.';
      setError(message);
      throw new Error(message);
    } finally { pending.current = false; setBusy(false); }
  };
  const actions = draft.notifiedAt && <span className="ledger-new-row-actions">
    <button type="button" className="ledger-new-row-save" disabled={busy || p.disabled} onClick={() => { void save().catch(() => {}); }}>{busy ? '저장 중…' : '등록'}</button>
    <button type="button" className="ledger-new-row-reset" disabled={busy} onClick={() => reset()}>취소</button>
  </span>;
  const field = (key: keyof TransactionDraft, label: string, options?: { value: string; label: string }[]) => <SpreadsheetCell
    key={`${key}-${revision}`} id={`${prefix}:${key}`} label={`새 ${p.fixedMonth ? '고정비' : '거래'} ${label}`}
    placeholder={key === 'merchant' ? (p.fixedMonth ? '고정비 항목 입력' : '사용처 입력') : key === 'amount' ? '금액 입력' : key === 'content' ? '상세내역 입력 (선택)' : undefined}
    value={key === 'notifiedAt' && p.fixedMonth ? draft.notifiedAt.slice(0, 10) : draft[key]} disabled={busy || p.disabled}
    activateOnClick onBegin={begin} initialValue={key === 'notifiedAt' ? () => {
      const date = draftRef.current.notifiedAt || defaultDate;
      return date.slice(0, 10);
    } : undefined}
    type={key === 'notifiedAt' ? 'date' : 'text'} numeric={key === 'amount'} options={options ? rankLedgerOptions(options, ledgerSuggestions(key, p.neighbor, p.recentItems || [], history.recent)) : undefined}
    suggestions={key === 'merchant' ? ledgerSuggestions(key, p.neighbor, p.recentItems || [], history.recent, p.merchants) : undefined} className={key === 'amount' ? 'ledger-cell--end ledger-money' : ''}
    onSave={async value => {
      if (revision !== generation.current) return;
      const values: Partial<TransactionDraft> = { [key]: value };
      if (key === 'notifiedAt' && p.fixedMonth) values.notifiedAt = value ? `${value}T12:00` : '';
      if (key === 'category') {
        const category = p.categories.find(c => c.name === value);
        if (category) values.type = category.type === 'INCOME' ? 'DEPOSIT' : 'PAYMENT';
      }
      if (key === 'sourceApp') values.cardOrAccount = p.paymentMethods.find(method => method.id === value)?.name || '';
      update(values);
      history.remember(key, value.trim());
    }} onSubmit={save} submitOnEnter={key === 'amount'}>
    {key === 'sourceApp' ? (draft.notifiedAt ? p.paymentMethods.find(method => method.id === draft.sourceApp)?.name || '결제수단 미지정' : '')
      : key === 'amount' ? (draft.amount ? `${draft.type === 'DEPOSIT' ? '+' : '−'}₩${formatCellAmount(draft.amount)}` : '')
      : key === 'notifiedAt' ? draft.notifiedAt.slice(0, 10)
      : draft[key]}
    {key === 'amount' && <>{actions}{error && <span role="alert" className="ledger-grid-feedback ledger-error">{error}</span>}</>}
  </SpreadsheetCell>;
  const categoryOptions = [{ value: '', label: '카테고리 선택' }, ...p.categories.filter(category => !p.fixedMonth || category.type === 'EXPENSE' || category.type === 'INCOME').map(category => ({ value: category.name, label: `${category.emoji} ${category.name}` }))];
  const paymentOptions = [{ value: 'MANUAL', label: '결제수단 선택' }, ...p.paymentMethods.filter(method => method.id !== 'MANUAL').map(method => ({ value: method.id, label: `${method.emoji || ''} ${method.name}` }))];
  const extras = (mobile: boolean) => <div className="ledger-entry-extras">
    <label>구분<select aria-label="구분" disabled={busy} value={draft.type} onChange={event => { begin(); update({ type: event.target.value, category: '' }); }}><option value="PAYMENT">지출</option><option value="DEPOSIT">수입</option>{!p.fixedMonth && <><option value="WITHDRAWAL">출금</option><option value="CANCEL">취소</option></>}</select></label>
    {(mobile || !p.showContent) && <label className="ledger-entry-memo">한 줄 메모 (선택)<input aria-label="한 줄 메모 (선택)" disabled={busy} value={draft.content} placeholder="기억하고 싶은 한 줄" onChange={event => update({ content: event.target.value })}/></label>}
    <label>메모에 이모지 추가 (선택)<select aria-label="메모에 이모지 추가 (선택)" disabled={busy} value="" onChange={event => { if (event.target.value) update({ content: `${draftRef.current.content}${draftRef.current.content ? ' ' : ''}${event.target.value}` }); }}><option value="">선택 안 함</option>{['🙂', '☕', '🌿', '🎁', '✨', '🍚'].map(emoji => <option key={emoji} value={emoji}>{emoji}</option>)}</select></label>
    <label className="ledger-entry-continue"><input type="checkbox" disabled={busy} checked={keepEntering} onChange={event => setKeepEntering(event.target.checked)}/>계속 입력 · 날짜와 분류 유지</label>
  </div>;
  const mobileColumnCount = p.fixedMonth ? 6 : 6 + Number(p.selection) + Number(p.showContent);
  return <><tr ref={row} data-ledger-tour={!p.fixedMonth && p.position === 'top' ? 'new-entry' : undefined} className={`ledger-new-row ${draft.notifiedAt ? 'has-draft' : ''}`} data-sensitive-income={isIncomeSensitive(draft, p.categories) ? 'true' : undefined}
    onKeyDownCapture={event => {
      if (event.nativeEvent.isComposing || event.repeat || busy || p.disabled || history.busy) return;
      if (event.key === 'Escape') {
        const now = Date.now();
        if (lastEscape.current && now - lastEscape.current < 1000) {
          event.preventDefault(); event.stopPropagation(); lastEscape.current = 0; reset(); return;
        }
        lastEscape.current = now;
      } else lastEscape.current = 0;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        if (event.key === 'Backspace') { event.preventDefault(); event.stopPropagation(); reset(); return; }
        if (event.key.toLowerCase() === 'z' && !(event.target as HTMLElement).closest('input, select, textarea') && draftUndo.current.length) {
          event.preventDefault(); event.stopPropagation();
          draftRef.current = draftUndo.current.pop()!; setDraft(draftRef.current); setError(''); setRevision(++generation.current);
          requestAnimationFrame(() => row.current?.querySelector<HTMLTableCellElement>('[data-grid-cell]')?.focus()); return;
        }
      }
      const direction = p.position === 'top' ? 'ArrowDown' : 'ArrowUp';
      const modifier = (event.metaKey && !event.ctrlKey) || (event.ctrlKey && !event.metaKey);
      if (event.key !== direction || !modifier || !event.altKey || !event.shiftKey || event.nativeEvent.isComposing) return;
      event.preventDefault(); event.stopPropagation();
      if (event.repeat || busy || p.disabled) return;
      if (!p.neighbor) { setError('복제할 거래가 없습니다.'); return; }
      const cellId = (event.target as HTMLElement).closest<HTMLElement>('[data-grid-cell]')?.dataset.gridCell;
      const copied = transactionDraft(p.neighbor, true, defaultDate);
      copied.notifiedAt = draftRef.current.notifiedAt || defaultDate;
      if (p.fixedMonth && !copied.type) copied.type = 'PAYMENT';
      draftUndo.current.push({ ...draftRef.current });
      draftRef.current = copied; setDraft(copied); setError('');
      entryId.current = null; setRevision(++generation.current);
      requestAnimationFrame(() => {
        const cells = row.current?.querySelectorAll<HTMLTableCellElement>('[data-grid-cell]');
        const target = cells && (Array.from(cells).find(cell => cell.dataset.gridCell === cellId) || cells[0]);
        target?.focus();
      });
    }}>{p.orderColumn && <td className="ledger-handle-column" aria-hidden="true"/>}
    {!p.fixedMonth && <td className="ledger-handle-column"><span className="ledger-new-row-marker" title="새 거래 입력"><PlusCircle size={14}/></span></td>}
    {p.selection && <td/>}
    {field('notifiedAt', p.fixedMonth ? '납부일' : '날짜')}
    {field('merchant', p.fixedMonth ? '항목' : '사용처')}
    {field('category', '카테고리', categoryOptions)}
    {field('sourceApp', '결제수단', paymentOptions)}
    {p.showContent && field('content', '상세내역')}
    {field('amount', '금액')}
    <td className="ledger-new-row-mobile" colSpan={mobileColumnCount}>
      {!mobileOpen ? <button type="button" className="ledger-mobile-add-trigger" onClick={openMobileForm} disabled={p.disabled}><PlusCircle size={16}/>{p.fixedMonth ? '고정비 추가' : '새 거래 추가'}</button> : <form className="ledger-mobile-entry-form" onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} onSubmit={event => { event.preventDefault(); void save().catch(() => {}); }}>
        <fieldset disabled={busy || p.disabled} className="ledger-mobile-entry-fields">
        <div className="ledger-mobile-entry-heading"><strong>{p.fixedMonth ? '이달의 고정비 입력' : '새 거래 입력'}</strong><button type="button" onClick={() => reset(true, false)} disabled={busy}>취소</button></div>
        <label>날짜<input aria-label="날짜" data-mobile-date type="date" value={draft.notifiedAt.slice(0, 10)} required onChange={event => update({ notifiedAt: event.target.value })}/></label>
        <label>결제수단<select aria-label="결제수단" value={draft.sourceApp || 'MANUAL'} onChange={event => setMobilePayment(event.target.value)}><option value="MANUAL">미지정 (선택)</option>{p.paymentMethods.filter(method => method.id !== 'MANUAL').map(method => <option key={method.id} value={method.id}>{method.emoji ? `${method.emoji} ` : ''}{method.name}</option>)}</select></label>
        <label>카테고리<select aria-label="카테고리" value={draft.category} onChange={event => {
          const category = p.categories.find(item => item.name === event.target.value);
          update({ category: event.target.value, ...(category ? { type: category.type === 'INCOME' ? 'DEPOSIT' as const : 'PAYMENT' as const } : {}) });
        }}><option value="">카테고리 선택</option>{p.categories.filter(category => !p.fixedMonth || category.type === 'EXPENSE' || category.type === 'INCOME').map(category => <option key={category.id} value={category.name}>{category.emoji} {category.name}</option>)}</select></label>
        <label className="ledger-mobile-entry-field--merchant">{p.fixedMonth ? '고정비 항목' : '사용처 (선택)'}<input aria-label="사용처 (선택)" data-mobile-merchant type="text" value={draft.merchant} placeholder={p.fixedMonth ? '예: 관리비' : '예: 마트, 식당'} onChange={event => update({ merchant: event.target.value })}/></label>
        <label>금액<input aria-label="금액" data-mobile-amount type="text" inputMode="numeric" value={formatCellAmount(draft.amount)} placeholder="0" required onChange={event => update({ amount: formatCellAmount(event.target.value) })}/></label>
        {extras(true)}
        {error && <p role="alert" className="ledger-error">{error}</p>}
        <button className="ledger-mobile-entry-submit" type="submit" disabled={busy || p.disabled}>{busy ? '저장 중…' : p.fixedMonth ? '고정비 등록' : '거래 등록'}</button>
        </fieldset>
      </form>}
    </td>
  </tr>{draft.notifiedAt && <tr className="ledger-entry-options"><td colSpan={mobileColumnCount + (p.orderColumn ? 1 : 0)}>{extras(false)}</td></tr>}
    {notice && <tr className="ledger-entry-notice"><td colSpan={mobileColumnCount + (p.orderColumn ? 1 : 0)} role="status">{notice}</td></tr>}
  </>;
}
