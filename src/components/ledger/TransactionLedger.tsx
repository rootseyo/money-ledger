'use client';
import { isIncomeSensitive } from '@/lib/card-income-privacy';
import { SCHEDULED_FIXED_PACKAGE } from '@/lib/fixed-expense-schedule';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Copy, ClipboardPaste, Paperclip, SlidersHorizontal, X } from 'lucide-react';
import { classifyTransactionRole, resolveCategoryInfo, type HouseholdCategory } from '@/lib/household-categories';
import { formatLedgerMerchant, formatLedgerTimestamp, hasImportedPlaceholderTime, type LedgerSortField } from '@/lib/card-ledger-display';
import { kstDate } from '@/lib/fixed-expense-schedule';
import { ListDragHandle, ListOrderStatus } from './ListOrderControls';
import LedgerDialog from './LedgerDialog';
import TransactionReceipts from './TransactionReceipts';
import LedgerNewRow from './LedgerNewRow';
import { SpreadsheetTable } from './SpreadsheetTable';
import TransactionCell from './TransactionCell';
import type { HouseholdPaymentMethod } from '@/lib/payment-methods';
import type { Transaction } from './ledger-types';
import { useCardFilterFields } from '@/hooks/use-card-filter-cookie';

interface Props {
  isClubLedger?: boolean;
  canEdit?: boolean;
  onCellSaved: (item: Transaction) => void;
  paymentMethods: HouseholdPaymentMethod[]; onCreated: (item: Transaction, date: string) => void;
  items: Transaction[]; all: Transaction[]; loading: boolean; categories: HouseholdCategory[];
  search: string; onSearch: (value: string) => void; filters: ReactNode; filterCount: number; onClear: () => void;
  sortField: LedgerSortField; sortOrder: 'asc' | 'desc'; onSort: (field: LedgerSortField, order?: 'asc' | 'desc') => void;
  order: { custom: boolean; saving: boolean; disabled: boolean; error: string; reset: () => void; move: (source: string, target: string) => void };
  selected: Set<string>; onSelect: (ids: Set<string>) => void; onDeleteSelected: () => void; deleting: boolean; confirmBulk: boolean;
  onEdit: (tx: Transaction) => void; onDelete: (id: string) => void; confirmDeleteId: string | null;
  /** Incremented to invite the user to add a transaction (e.g. after the tutorial). */
  entryInvite?: number;
  entryDate?: string;
  onEntryInviteHandled?: () => void;
  month: string; onPrevMonth: () => void; onNextMonth: () => void; onCurrentMonth: () => void; onBulkPasted: () => void;
}
export default function TransactionLedger(p: Props) {
  const allItems = p.items.filter(item => !item.fixedExpenseId && !item.scheduledFor && item.packageName !== SCHEDULED_FIXED_PACKAGE);
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(allItems.length / 80) - 1);
  const activePage = Math.min(page, lastPage);
  const items = allItems.slice(activePage * 80, (activePage + 1) * 80);
  const [copyDraft, setCopyDraft] = useState<{ item: Transaction; key: number } | null>(null);
  const [copiedRows, setCopiedRows] = useState<Transaction[]>([]);
  const [copiedFromMonth, setCopiedFromMonth] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteMessage, setPasteMessage] = useState('');
  const [details, setDetails] = useState<Transaction | null>(null);
  const [invite, setInvite] = useState<{ open: number; banner: boolean; first: boolean }>({ open: 0, banner: false, first: false });
  const hasAny = p.all.length > 0;
  useEffect(() => { setPage(0); p.onSelect(new Set()); }, [p.month, p.onSelect]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('ledger-row-clipboard') || 'null') as { month?: string; rows?: Transaction[] } | null;
      if (saved && Array.isArray(saved.rows)) { setCopiedRows(saved.rows); setCopiedFromMonth(saved.month || ''); }
    } catch { sessionStorage.removeItem('ledger-row-clipboard'); }
  }, []);
  useEffect(() => {
    const clearSelection = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !p.selected.size) return;
      p.onSelect(new Set()); setSelection(false);
    };
    document.addEventListener('keydown', clearSelection);
    return () => document.removeEventListener('keydown', clearSelection);
  }, [p.selected, p.onSelect]);
  useEffect(() => {
    if (!p.entryInvite) return;
    setInvite({ open: p.entryInvite, banner: true, first: !hasAny });
    p.onEntryInviteHandled?.();
    // Only a new invite should reopen the row; data changes must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.entryInvite]);
  const inviteOpened = useCallback(() => setInvite(current => ({ ...current, open: 0 })), []);
  const {
    filtersOpen: [filterPanel, setFilterPanel],
    contentVisibility: [contentVisibility, setContentVisibility],
  } = useCardFilterFields('card-history-ledger-view', { filtersOpen: 'closed', contentVisibility: 'auto' });
  const filtersOpen = filterPanel === 'open';
  const [selection, setSelection] = useState(false);
  const showContent = contentVisibility === 'auto' ? p.sortField === 'content' : contentVisibility === 'show';
  const columnCount = 6 + Number(selection) + Number(showContent);
  const widths = showContent ? [8, 35, 14, 17, 11, 15] : [8, 41, 16, 20, 15];
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const dataWidth = selection ? 92 : 96;
  const merchants = [...new Set(p.all.map(item => item.merchant || item.title).filter(Boolean))];
  const entryProps = { categories: p.categories, paymentMethods: p.paymentMethods, merchants, recentItems: p.all, selection, showContent, disabled: p.loading, month: p.month, onSaved: (item: Transaction, date: string) => {
    setInvite(current => current.banner ? { ...current, banner: false } : current);
    setPage(0);
    p.onCreated(item, date);
  } };
  const copy = (item: Transaction) => {
    setCopyDraft(current => ({ item, key: (current?.key || 0) + 1 }));
    requestAnimationFrame(() => document.querySelector<HTMLTableCellElement>('[data-grid-cell="new-transaction-top:merchant"]')?.focus());
  };
  const copySelected = useCallback(() => {
    const rows = p.all.filter(item => p.selected.has(item.id)).sort((a, b) => a.notifiedAt.localeCompare(b.notifiedAt));
    if (!rows.length) return;
    setCopiedRows(rows);
    setCopiedFromMonth(p.month);
    try { sessionStorage.setItem('ledger-row-clipboard', JSON.stringify({ month: p.month, rows })); } catch {}
    setPasteMessage(`${rows.length}개 행을 복사했습니다.`);
  }, [p.all, p.month, p.selected]);
  const pasteRows = useCallback(async () => {
    if (!copiedRows.length || pasteBusy || !/^\d{4}-\d{2}$/.test(p.month)) return;
    setPasteBusy(true); setPasteMessage('');
    const transactions = copiedRows.map(item => {
      const sourceDate = kstDate(item.notifiedAt);
      const day = Number(sourceDate.slice(8, 10));
      const [year, month] = p.month.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const date = `${p.month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
      return {
        sourceApp: item.sourceApp, type: item.type, amount: item.amount, merchant: item.merchant,
        category: item.category, title: item.title, content: item.content, balance: item.balance,
        cardOrAccount: item.cardOrAccount, packageName: item.packageName,
        notifiedAt: new Date(`${date}T12:00:00+09:00`).toISOString(),
      };
    });
    try {
      const response = await fetch('/api/card-transactions/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactions, skipFixedMatching: true }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '붙여넣지 못했습니다.');
      setPasteMessage(`${data.insertedCount}개 행을 ${p.month}에 붙여넣었습니다.${data.duplicateCount ? ` 중복 ${data.duplicateCount}개는 제외했습니다.` : ''}`);
      p.onBulkPasted();
    } catch (error) { setPasteMessage(error instanceof Error ? error.message : '붙여넣지 못했습니다.'); }
    finally { setPasteBusy(false); }
  }, [copiedRows, p.month, p.onBulkPasted, pasteBusy]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'c' && p.selected.size > 0) {
        event.preventDefault(); copySelected();
      } else if (key === 'v' && copiedRows.length > 0 && p.month !== copiedFromMonth) {
        event.preventDefault(); void pasteRows();
      }
    };
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, [copySelected, copiedFromMonth, copiedRows.length, p.month, p.selected.size, pasteRows]);
  const ids = items.map(tx => tx.id);
  const tx = details ? p.all.find(item => item.id === details.id) : null;
  const sort = (label: string, field: LedgerSortField) => <button type="button" className="ledger-column-sort" onClick={() => p.onSort(field, field === 'category' || field === 'content' || field === 'merchant' || field === 'paymentMethod' ? 'asc' : 'desc')} disabled={p.order.disabled}>{label}{p.sortField === field ? p.sortOrder === 'asc' ? <ArrowUp size={14}/> : <ArrowDown size={14}/> : <ArrowUpDown size={14}/>}</button>;
  const ariaSort = (field: LedgerSortField): 'ascending' | 'descending' | 'none' => !p.order.custom && p.sortField === field ? p.sortOrder === 'asc' ? 'ascending' : 'descending' : 'none';
  return <section className="ledger-surface" aria-busy={p.loading}>
    <header className="ledger-section-heading ledger-transactions-heading"><div><h2>{p.isClubLedger ? '이달의 회비·지출 내역' : '이달의 수입·지출 내역'}</h2><p className="ledger-muted">총 {allItems.length.toLocaleString()}건</p></div><nav className="ledger-inline-month-nav" aria-label="거래 내역 월 이동"><button className="btn btn-secondary" aria-label="지난달" title="지난달" onClick={p.onPrevMonth}><ChevronLeft size={16}/><span>지난달</span></button><strong>{p.month}</strong><button className="btn btn-secondary" aria-label="다음달" title="다음달" onClick={p.onNextMonth}><span>다음달</span><ChevronRight size={16}/></button><button className="btn btn-secondary" onClick={p.onCurrentMonth}>이번달</button></nav></header>
    <div className="ledger-search-row"><input aria-label="거래 검색" type="search" placeholder="사용처, 내역 검색" value={p.search} onChange={e => p.onSearch(e.target.value)}/><button type="button" className="btn btn-secondary" aria-expanded={filtersOpen} aria-controls="ledger-filters" onClick={() => setFilterPanel(v => v === 'open' ? 'closed' : 'open')}><SlidersHorizontal size={16}/>필터{p.filterCount > 0 ? ` ${p.filterCount}` : ''}</button><button className="btn btn-secondary" aria-pressed={selection} onClick={() => { setSelection(v => !v); p.onSelect(new Set()); }}>{selection ? '선택 종료' : '선택'}</button>{p.selected.size > 0 && <button type="button" className="btn btn-secondary" aria-keyshortcuts="Meta+C Control+C" title="⌘C / Ctrl+C" onClick={copySelected}><Copy size={14}/>복사하기</button>}</div>
    {p.filterCount > 0 && <div className="ledger-filter-notice"><span>저장된 필터 {p.filterCount}개 적용 중</span><button className="ledger-text-button" onClick={p.onClear}>초기화</button></div>}
    <div id="ledger-filters" hidden={!filtersOpen}><div className="ledger-filter-grid">{p.filters}<label className="ledger-field">상세내역 열<select value={showContent ? 'show' : 'hide'} onChange={e => setContentVisibility(e.target.value)}><option value="hide">숨기기</option><option value="show">표시하기</option></select></label></div></div>
    {copiedRows.length > 0 && <div className="ledger-paste-bar" role="group" aria-label="복사한 거래 붙여넣기"><span>{copiedRows.length}개 행 복사됨{copiedFromMonth ? ` · ${copiedFromMonth}에서 복사` : ''} · 대상 월 {p.month}</span><button className="btn btn-primary" aria-keyshortcuts="Meta+V Control+V" title="⌘V / Ctrl+V" disabled={pasteBusy || !/^\d{4}-\d{2}$/.test(p.month)} onClick={() => void pasteRows()}><ClipboardPaste size={15}/>{pasteBusy ? '붙여넣는 중…' : `${p.month}에 붙여넣기`}</button><button className="btn btn-secondary" onClick={() => { setCopiedRows([]); setCopiedFromMonth(''); setPasteMessage(''); sessionStorage.removeItem('ledger-row-clipboard'); }}>복사 취소</button></div>}
    {pasteMessage && <p className="ledger-paste-message" role="status">{pasteMessage}</p>}
    {invite.banner && <div className="ledger-entry-invite" role="status">
      <span aria-hidden="true" className="ledger-entry-invite-emoji">✍️</span>
      <div><strong>{invite.first ? '첫 번째 거래를 등록해 볼까요?' : '새 거래를 등록해 볼까요?'}</strong><p>금액·날짜·카테고리를 입력하세요. 사용처·결제수단·메모는 선택 사항이에요.</p></div>
      <button type="button" aria-label="안내 닫기" onClick={() => setInvite(current => ({ ...current, banner: false }))}><X size={16}/></button>
    </div>}
    <div className="ledger-grid-toolbar"><p className="ledger-grid-help">Shift+클릭·화살표·Page Up/Down으로 범위 선택 · ⌘/Ctrl+Backspace로 선택 행 삭제 · Esc로 선택 해제</p><div className="ledger-sort-links" role="group" aria-label="거래 정렬">
      <button type="button" className={p.sortField === 'notified' ? 'is-active' : ''} aria-pressed={p.sortField === 'notified'} disabled={p.order.disabled} onClick={() => p.onSort('notified', 'desc')}>날짜 {p.sortField === 'notified' && p.sortOrder === 'asc' ? '오래된순' : '최신순'}</button>
      <button type="button" className={p.sortField === 'amount' ? 'is-active' : ''} aria-pressed={p.sortField === 'amount'} disabled={p.order.disabled} onClick={() => p.onSort('amount', 'desc')}>금액 {p.sortField === 'amount' && p.sortOrder === 'asc' ? '낮은순' : '높은순'}</button>
    </div></div>
    <SpreadsheetTable label={p.isClubLedger ? '이달의 회비·지출 내역' : '이달의 수입·지출 내역'} disabled={p.loading || p.deleting} rowSelection={{
      ids: allItems.map(item => item.id), fields: ['notifiedAt', 'merchant', 'category', 'cardOrAccount', ...(showContent ? ['content'] : []), 'amount'],
      selected: p.selected, onChange: p.onSelect,
      onNavigateRow: (id, removedIds = []) => {
        const removed = new Set(removedIds);
        const index = allItems.filter(item => !removed.has(item.id)).findIndex(item => item.id === id);
        if (index >= 0) setPage(Math.floor(index / 80));
      },
    }} rowActions={rowId => {
      const item = items.find(candidate => candidate.id === rowId);
      if (!item) return [];
      return [
        { label: '상세 보기', onClick: () => setDetails(item) },
        { label: '영수증 첨부·보기', onClick: () => setDetails(item) },
        { label: '전체 수정', onClick: () => p.onEdit(item) },
        { label: '새 거래로 복사', onClick: () => copy(item) },
      ];
    }}>
      <colgroup><col style={{ width: '4%' }}/>{selection && <col style={{ width: '4%' }}/>}{widths.map((width, index) => <col key={index} style={{ width: `${width / totalWidth * dataWidth}%` }}/>)}</colgroup>
      <thead><tr>
      <th className="ledger-handle-column"><span className="sr-only">순서</span></th>
      {selection && <th><input type="checkbox" aria-label="표시된 거래 전체 선택" checked={ids.length > 0 && ids.every(id => p.selected.has(id))} onChange={e => p.onSelect(e.target.checked ? new Set(ids) : new Set())}/></th>}
      <th aria-sort={ariaSort('notified')}>{sort('날짜', 'notified')}</th><th aria-sort={ariaSort('merchant')}>{sort('사용처', 'merchant')}</th><th aria-sort={ariaSort('category')}>{sort('카테고리', 'category')}</th><th aria-sort={ariaSort('paymentMethod')}>{sort('결제수단', 'paymentMethod')}</th>
      {showContent && <th aria-sort={ariaSort('content')}>{sort('상세내역', 'content')}</th>}<th className="ledger-cell--end" aria-sort={ariaSort('amount')}>{sort('금액', 'amount')}</th>
    </tr></thead><tbody>
      <LedgerNewRow key={`top-${p.month}-${copyDraft?.key || 0}`} {...entryProps} position="top" neighbor={items[0]} seed={copyDraft?.item} openSignal={invite.open} entryDate={p.entryDate} onOpened={inviteOpened}/>
      {p.loading ? <tr><td colSpan={columnCount} className="ledger-empty" role="status">거래를 불러오는 중입니다…</td></tr> : !items.length ? <tr><td colSpan={columnCount} className="ledger-empty"><h3>{p.filterCount ? '조건에 맞는 거래가 없어요' : '아직 등록된 거래가 없어요'}</h3><p>{p.filterCount ? '필터를 초기화하거나 다른 검색어를 입력해 주세요.' : '위 또는 아래의 빈 셀에서 첫 거래를 입력하세요.'}</p>{p.filterCount > 0 && <button className="btn btn-secondary" onClick={p.onClear}>필터 초기화</button>}</td></tr> : items.map((item, index) => {
        const role = classifyTransactionRole(item); const isPositive = role === 'INCOME' || item.type === 'CANCEL'; const stamp = formatLedgerTimestamp(item.notifiedAt); const cat = resolveCategoryInfo(item.category || '', p.categories);
        const cell = { item, neighbor: items[index - 1] || items[index + 1], recentItems: p.all, categories: p.categories, onSaved: p.onCellSaved, disabled: p.loading, merchants, paymentMethods: p.paymentMethods };
        return <tr key={item.id} aria-selected={p.selected.has(item.id)} className={`ledger-spreadsheet-row${copiedRows.some(copied => copied.id === item.id) ? ' ledger-row--copied' : ''}`} onKeyDown={event => {
          if (event.altKey && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); setDetails(item); }
        }} data-order-id={item.id} data-transaction-id={item.id} data-sensitive-income={isIncomeSensitive(item, p.categories) ? 'true' : undefined}>
          <td className="ledger-handle-column"><ListDragHandle id={item.id} ids={ids} disabled={p.order.disabled} move={p.order.move}/></td>
          {selection && <td data-label="선택"><input type="checkbox" aria-label="거래 선택" checked={p.selected.has(item.id)} onChange={e => { const next = new Set(p.selected); if (e.target.checked) next.add(item.id); else next.delete(item.id); p.onSelect(next); }}/></td>}
          <TransactionCell {...cell} field="notifiedAt" label="날짜" className="ledger-date-cell"><span>{stamp.date}</span></TransactionCell>
          <TransactionCell {...cell} field="merchant" label="사용처"><div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', overflow: 'hidden' }}><span className="ledger-merchant" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatLedgerMerchant(item) || item.title || '거래 상세'}</span>{(item._count?.receipts || 0) > 0 && <span className="receipt-indicator" title={`${item._count!.receipts}개 영수증`}><Paperclip size={13}/>{item._count!.receipts}</span>}{item.duesPayment && <span className="club-status">{item.duesPayment.member?.name || '구성원'} 회비</span>}{role !== 'CONSUMPTION' && <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, background: isPositive ? 'rgba(239, 68, 68, 0.12)' : 'var(--ledger-subtle)', color: isPositive ? 'var(--income-color, #ef4444)' : 'var(--text-muted)' }}>{role === 'INCOME' ? '수입' : item.type === 'CANCEL' ? '취소' : role === 'SAVINGS' ? '저축' : '이체'}</span>}</div></TransactionCell>
          <TransactionCell {...cell} field="category" label="카테고리"><span className="ledger-category-label">{cat.emoji} {cat.label}</span></TransactionCell><TransactionCell {...cell} field="cardOrAccount" label="결제수단">{item.cardOrAccount || p.paymentMethods.find(method => method.id === item.sourceApp)?.name || item.sourceApp}</TransactionCell>{showContent && <TransactionCell {...cell} field="content" label="상세내역" className="ledger-content-cell">{item.content}</TransactionCell>}
          <TransactionCell {...cell} field="amount" label="금액" className="ledger-cell--end ledger-money"><span style={{ color: isPositive ? 'var(--income-color, #ef4444)' : 'var(--expense-color, #3b82f6)' }}>{isPositive ? '+' : '−'}₩{item.amount.toLocaleString()}</span></TransactionCell>
        </tr>;
      })}
      <LedgerNewRow key={`bottom-${p.month}`} {...entryProps} position="bottom" neighbor={items.at(-1)} entryDate={p.entryDate}/>
    </tbody></SpreadsheetTable>
    {lastPage > 0 && <nav className="ledger-pager" aria-label="거래 내역 페이지"><button className="btn btn-secondary" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>이전</button><span role="status">{activePage + 1} / {lastPage + 1} 페이지 · 80건씩</span><button className="btn btn-secondary" disabled={activePage === lastPage} onClick={() => setPage(activePage + 1)}>다음</button></nav>}
    <ListOrderStatus {...p.order}/>
    {tx && <LedgerDialog title="거래 상세" onClose={() => setDetails(null)}><div data-sensitive-income={isIncomeSensitive(tx, p.categories) ? 'true' : undefined}>
      <p className="ledger-detail-amount" style={{ color: (classifyTransactionRole(tx) === 'INCOME' || tx.type === 'CANCEL') ? 'var(--income-color, #ef4444)' : 'var(--expense-color, #3b82f6)' }}>
        {(classifyTransactionRole(tx) === 'INCOME' || tx.type === 'CANCEL') ? '+' : '−'}₩{tx.amount.toLocaleString()}
      </p><h3>{tx.merchant || tx.title}</h3><dl className="ledger-detail-list"><dt>일시</dt><dd>{new Date(tx.notifiedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</dd><dt>카테고리</dt><dd>{resolveCategoryInfo(tx.category || '', p.categories).label}</dd><dt>결제수단</dt><dd>{tx.cardOrAccount || tx.sourceApp}</dd><dt>리포트</dt><dd>{tx.isReported ? '전송됨' : '미전송'}</dd><dt>상세내역</dt><dd className="ledger-detail-content">{tx.content}</dd></dl>
      <TransactionReceipts transactionId={tx.id} canEdit={p.canEdit !== false} onChanged={p.onBulkPasted}/>
      {p.canEdit !== false && <div className="ledger-dialog-actions"><button className="btn btn-secondary" onClick={() => p.onDelete(tx.id)}>{p.confirmDeleteId === tx.id ? '정말 삭제하기' : '삭제'}</button><button className="btn btn-primary" onClick={() => { const itemToEdit = tx; setDetails(null); p.onEdit(itemToEdit); }}>수정</button></div>}
    </div></LedgerDialog>}
  </section>;
}
