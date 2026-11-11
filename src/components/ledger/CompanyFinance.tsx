'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  buildForecast,
  defaultVat,
  invoiceStatus,
  invoiceTotal,
  issueDeadline,
  outstanding,
  predictTaxes,
  previousVatPeriod,
  summarizeVat,
  TAX_TYPE_NAMES,
  vatPeriod,
  vatPeriodOf,
  type InvoiceKind,
  type TaxForecastItem,
  type TaxInvoice,
  type TaxPayment,
  type TaxType,
  type VatPeriod,
} from '@/lib/company-ledger';
import type { FixedExpenseItem } from '@/lib/fixed-expenses';
import LedgerDialog from './LedgerDialog';
import './club-ledger.css';
import './company-ledger.css';

type Data = {
  invoices: TaxInvoice[];
  taxPayments: TaxPayment[];
  cashBalance: number | null;
  openDate?: string | null;
  fixedExpenses: FixedExpenseItem[];
  today: string;
  canEdit: boolean;
};

type InvoiceForm = {
  id?: string;
  kind: InvoiceKind;
  issueDate: string;
  issued: boolean;
  counterparty: string;
  bizNumber: string;
  item: string;
  supply: string;
  vat: string;
  vatEdited: boolean;
  dueDate: string;
  memo: string;
  locked: boolean;
};

type SettleForm = {
  invoice: TaxInvoice;
  date: string;
  record: boolean;
};

type TaxPaymentForm = {
  id?: string;
  paidAt: string;
  taxType: TaxType;
  amount: string;
  period: string;
  taxOffice: string;
  memo: string;
  record: boolean;
};

const won = (value: number) => `₩${value.toLocaleString()}`;
const digits = (value: string) => value.replace(/[^0-9]/g, '');
const withCommas = (value: string) => (digits(value) ? Number(digits(value)).toLocaleString() : '');
const toNumber = (value: string) => Number(digits(value) || 0);

const dDay = (target: string, today: string) => {
  const diff = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
};

const shortMonth = (month: string) => `${month.slice(0, 4)}.${month.slice(5, 7)}`;
const nextPeriod = (period: VatPeriod) => (period.half === 1 ? vatPeriod(period.year, 2) : vatPeriod(period.year + 1, 1));

export default function CompanyFinance({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'tax-forecast' | 'tax-payments'>('tax-forecast');
  const [period, setPeriod] = useState<VatPeriod | null>(null);
  const [kindFilter, setKindFilter] = useState<'ALL' | InvoiceKind>('ALL');
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm | null>(null);
  const [settleForm, setSettleForm] = useState<SettleForm | null>(null);
  const [taxPaymentForm, setTaxPaymentForm] = useState<TaxPaymentForm | null>(null);
  const [balanceInput, setBalanceInput] = useState<string | null>(null);

  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/company-finance', { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '불러오지 못했습니다.');
        setError('');
        setData(result);
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [version]);

  async function action(body: Record<string, unknown>, touchesLedger = false) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/company-finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
      refresh();
      if (touchesLedger) onChanged();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const today = data?.today || new Date().toISOString().slice(0, 10);
  const invoices = useMemo(() => data?.invoices || [], [data]);
  const taxPayments = useMemo(() => data?.taxPayments || [], [data]);

  const activePeriod = useMemo(() => period || vatPeriodOf(today), [period, today]);
  const vat = useMemo(() => summarizeVat(invoices, activePeriod, taxPayments), [invoices, activePeriod, taxPayments]);
  const receivable = useMemo(() => outstanding(invoices, 'SALES', today), [invoices, today]);
  const payable = useMemo(() => outstanding(invoices, 'PURCHASE', today), [invoices, today]);
  const pendingIssue = useMemo(
    () => invoices.filter(item => item.kind === 'SALES' && !item.issued).sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
    [invoices]
  );

  const forecast = useMemo(
    () =>
      buildForecast({
        invoices,
        taxPayments,
        fixedExpenses: data?.fixedExpenses || [],
        today,
        months: 6,
        cashBalance: data?.cashBalance ?? null,
      }),
    [invoices, taxPayments, data, today]
  );

  // 지금까지 낸 세금 데이터 기반 예측 모델
  const taxForecast = useMemo(
    () => predictTaxes({ invoices, taxPayments, today, openDate: data?.openDate }),
    [invoices, taxPayments, today, data?.openDate]
  );

  const nextDeadline =
    vat.prelim > 0 && today <= activePeriod.prelimDate
      ? { date: activePeriod.prelimDate, label: '예정고지 납부', amount: vat.prelim }
      : { date: activePeriod.finalDate, label: '확정신고·납부', amount: vat.finalPayment };

  const listed = invoices.filter(
    item =>
      (kindFilter === 'ALL' || item.kind === kindFilter) &&
      (showAllPeriods || (item.issueDate >= activePeriod.start && item.issueDate <= activePeriod.end))
  );

  const canEdit = !!data?.canEdit;

  function openNewInvoice(kind: InvoiceKind) {
    setInvoiceForm({
      kind,
      issueDate: today,
      issued: kind === 'PURCHASE',
      counterparty: '',
      bizNumber: '',
      item: '',
      supply: '',
      vat: '',
      vatEdited: false,
      dueDate: '',
      memo: '',
      locked: false,
    });
  }

  function openEditInvoice(invoice: TaxInvoice) {
    setInvoiceForm({
      id: invoice.id,
      kind: invoice.kind,
      issueDate: invoice.issueDate,
      issued: invoice.issued,
      counterparty: invoice.counterparty,
      bizNumber: invoice.bizNumber || '',
      item: invoice.item || '',
      supply: invoice.supplyAmount.toLocaleString(),
      vat: invoice.vat.toLocaleString(),
      vatEdited: invoice.vat !== defaultVat(invoice.supplyAmount),
      dueDate: invoice.dueDate || '',
      memo: invoice.memo || '',
      locked: !!invoice.transactionId,
    });
  }

  async function submitInvoiceForm() {
    if (!invoiceForm) return;
    const result = await action({
      action: 'save-invoice',
      invoice: {
        id: invoiceForm.id,
        kind: invoiceForm.kind,
        issueDate: invoiceForm.issueDate,
        issued: invoiceForm.issued,
        counterparty: invoiceForm.counterparty,
        bizNumber: invoiceForm.bizNumber,
        item: invoiceForm.item,
        supplyAmount: toNumber(invoiceForm.supply),
        vat: toNumber(invoiceForm.vat),
        dueDate: invoiceForm.dueDate || null,
        memo: invoiceForm.memo,
      },
    });
    if (result) setInvoiceForm(null);
  }

  function openNewTaxPayment(initialType: TaxType = 'VAT', initialPeriod = '') {
    setTaxPaymentForm({
      paidAt: today,
      taxType: initialType,
      amount: '',
      period: initialPeriod,
      taxOffice: '국세청 홈택스',
      memo: '',
      record: true,
    });
  }

  async function submitTaxPaymentForm() {
    if (!taxPaymentForm) return;
    const result = await action(
      {
        action: 'save-tax-payment',
        taxPayment: {
          id: taxPaymentForm.id,
          paidAt: taxPaymentForm.paidAt,
          taxType: taxPaymentForm.taxType,
          amount: toNumber(taxPaymentForm.amount),
          period: taxPaymentForm.period,
          taxOffice: taxPaymentForm.taxOffice,
          memo: taxPaymentForm.memo,
        },
        record: taxPaymentForm.record,
      },
      taxPaymentForm.record
    );
    if (result) setTaxPaymentForm(null);
  }

  const kindLabel = (kind: InvoiceKind) => (kind === 'SALES' ? '매출' : '매입');
  const settleLabel = (kind: InvoiceKind) => (kind === 'SALES' ? '입금' : '지급');

  return (
    <section className="ledger-surface club-ledger company-ledger" aria-busy={loading || busy}>
      <header className="club-section-title">
        <div>
          <h2>
            <Briefcase size={20} />회사 회계
            {data?.openDate && (
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--ledger-info)',
                  background: 'var(--ledger-control-bg)',
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--surface-border)',
                  marginLeft: 8,
                  verticalAlign: 'middle',
                }}
              >
                개업일 {data.openDate}
              </span>
            )}
          </h2>
        </div>
        <div className="club-form-actions">
          <button className="btn btn-secondary" onClick={refresh} aria-label="새로고침" title="새로고침">
            <RefreshCw size={14} />
          </button>
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={() => openNewTaxPayment()}>
                <Landmark size={14} />세금 납부 등록
              </button>
              <button className="btn btn-secondary" onClick={() => openNewInvoice('PURCHASE')}>
                <Plus size={14} />매입 등록
              </button>
              <button className="btn btn-primary" onClick={() => openNewInvoice('SALES')}>
                <Plus size={14} />매출 세금계산서 등록
              </button>
            </>
          )}
        </div>
      </header>
      {error && <p role="alert" className="club-feedback">{error}</p>}

      {/* 세그먼티드 서브 메뉴 (예상 세금, 세금계산서, 세금 납부 내역) */}
      <div className="company-sub-nav" role="tablist" aria-label="회사 회계 서브 메뉴">
        <button
          role="tab"
          aria-selected={activeSubTab === 'tax-forecast'}
          className={activeSubTab === 'tax-forecast' ? 'is-active' : ''}
          onClick={() => setActiveSubTab('tax-forecast')}
        >
          <TrendingUp size={15} />
          <span>예상 세금 & 현금흐름 예측</span>
        </button>
        <button
          role="tab"
          aria-selected={activeSubTab === 'invoices'}
          className={activeSubTab === 'invoices' ? 'is-active' : ''}
          onClick={() => setActiveSubTab('invoices')}
        >
          <FileText size={15} />
          <span>세금계산서 관리 ({invoices.length}건)</span>
        </button>
        <button
          role="tab"
          aria-selected={activeSubTab === 'tax-payments'}
          className={activeSubTab === 'tax-payments' ? 'is-active' : ''}
          onClick={() => setActiveSubTab('tax-payments')}
        >
          <Landmark size={15} />
          <span>세금 납부 내역 ({taxPayments.length}건)</span>
        </button>
      </div>

      {/* 핵심 세금 예측 브리핑 카드 (전체 화면 공통 상단) */}
      <div className="club-summary company-summary tax-kpi-summary">
        <div>
          <span>
            <CalendarClock size={13} /> 다음 납부 예정 세금
          </span>
          {taxForecast.nextTax ? (
            <>
              <strong data-sensitive-income="true">{won(taxForecast.nextTax.amount)}</strong>
              <small>
                {taxForecast.nextTax.label} · {taxForecast.nextTax.dueDate.slice(5).replace('-', '/')} (
                <em className="company-dday">{dDay(taxForecast.nextTax.dueDate, today)}</em>)
              </small>
            </>
          ) : (
            <>
              <strong>—</strong>
              <small>예정된 세금 일정이 없습니다.</small>
            </>
          )}
        </div>
        <div>
          <span>
            <PiggyBank size={13} /> 권장 월 세금 적립금
          </span>
          <strong data-sensitive-income="true">{won(taxForecast.monthlyReserveRecommendation)}</strong>
          <small>세금 통장에 매달 따로 모아둘 금액</small>
        </div>
        <div>
          <span>
            <TrendingUp size={13} /> 올해 예상 총 세액
          </span>
          <strong data-sensitive-income="true">{won(taxForecast.annualForecastTotal)}</strong>
          <small>부가세(예정+확정) · 종소세 · 지방세</small>
        </div>
        <div>
          <span>
            <Landmark size={13} /> 지금까지 낸 세금
          </span>
          <strong data-sensitive-income="true">{won(taxForecast.totalPaid)}</strong>
          <small>
            총 {taxForecast.historyCount}건 납부 기록{' '}
            <button
              type="button"
              className="ledger-text-button"
              style={{ marginLeft: 4 }}
              onClick={() => setActiveSubTab('tax-payments')}
            >
              내역 보기
            </button>
          </small>
        </div>
      </div>

      {/* 1. 예상 세금 & 현금흐름 예측 탭 */}
      {activeSubTab === 'tax-forecast' && (
        <>
          {/* 다가오는 예상 세금 납부 캘린더 / 타임라인 */}
          <div className="company-panel">
            <header className="club-section-title">
              <div>
                <h3>
                  <CalendarClock size={16} />향후 12개월 세금 납부 일정 및 예상 금액
                </h3>
              </div>
              {canEdit && (
                <button className="btn btn-secondary" onClick={() => openNewTaxPayment()}>
                  <Plus size={14} />납부 완료 등록
                </button>
              )}
            </header>
            <div className="club-table-scroll">
              <table className="club-member-table company-table">
                <thead>
                  <tr>
                    <th>납부기한</th>
                    <th>세목</th>
                    <th>세목명 및 내용</th>
                    <th>산출 근거 (실납부 실적/매출 기반)</th>
                    <th>예상 세액</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {taxForecast.upcomingEvents.map(event => (
                    <tr key={event.id}>
                      <td>
                        <strong>{event.dueDate}</strong>
                      </td>
                      <td>
                        <span className="club-status" data-kind={event.taxType === 'VAT' ? 'PURCHASE' : 'SALES'}>
                          {TAX_TYPE_NAMES[event.taxType] || event.taxType}
                        </span>
                      </td>
                      <td>
                        <strong>{event.label}</strong>
                      </td>
                      <td className="company-party">
                        <small style={{ color: 'var(--text-muted)' }}>{event.basis}</small>
                      </td>
                      <td className="club-amount" data-sensitive-income="true">
                        <strong>{won(event.amount)}</strong>
                      </td>
                      <td>
                        <span className="club-status company-pending">
                          <em className="company-dday">{dDay(event.dueDate, today)}</em>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!taxForecast.upcomingEvents.length && (
                    <tr>
                      <td colSpan={6}>예정된 세금 납부 일정이 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 부가가치세 상세 & 과세기간 이동 */}
          <div className="company-panel">
            <header className="club-section-title">
              <h3>
                <FileText size={16} />부가가치세 상세 · 개인 일반과세자
              </h3>
              <nav className="ledger-inline-month-nav" aria-label="부가세 과세기간">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPeriod(previousVatPeriod(activePeriod))}
                  aria-label="이전 기"
                >
                  <ChevronLeft size={16} />
                </button>
                <strong>{activePeriod.label}</strong>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPeriod(nextPeriod(activePeriod))}
                  aria-label="다음 기"
                >
                  <ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" onClick={() => setPeriod(null)}>
                  이번 기
                </button>
              </nav>
            </header>
            <div className="club-summary company-summary">
              <div>
                <span>매출세액</span>
                <strong data-sensitive-income="true">{won(vat.salesVat)}</strong>
                <small>공급가액 {won(vat.salesSupply)}</small>
              </div>
              <div>
                <span>매입세액</span>
                <strong>{won(vat.purchaseVat)}</strong>
                <small>공급가액 {won(vat.purchaseSupply)}</small>
              </div>
              <div>
                <span>{vat.payable >= 0 ? '예상 납부세액' : '예상 환급세액'}</span>
                <strong
                  data-sensitive-income="true"
                  className={vat.payable >= 0 ? 'company-negative' : 'company-positive'}
                >
                  {won(Math.abs(vat.payable))}
                </strong>
                <small>매출 − 매입</small>
              </div>
              <div>
                <span>
                  <CalendarClock size={13} /> {nextDeadline.label}
                </span>
                <strong>
                  {nextDeadline.date.slice(5).replace('-', '/')}{' '}
                  <em className="company-dday">{dDay(nextDeadline.date, today)}</em>
                </strong>
                <small data-sensitive-income="true">예상 {won(nextDeadline.amount)}</small>
              </div>
            </div>
          </div>

          {/* 6개월 현금흐름 예측 (부가세 + 종합소득세 + 지방세 통합 반영) */}
          <div className="company-panel">
            <header className="club-section-title">
              <div>
                <h3>
                  <CalendarClock size={16} />6개월 현금흐름 예상 (세금 납부 일정 반영)
                </h3>
              </div>
              <form
                className="company-balance"
                onSubmit={event => {
                  event.preventDefault();
                  if (balanceInput === null) return;
                  void action({
                    action: 'set-cash-balance',
                    cashBalance: balanceInput.trim() ? Number(balanceInput.replace(/[^0-9-]/g, '')) : null,
                  }).then(result => {
                    if (result) setBalanceInput(null);
                  });
                }}
              >
                <label className="ledger-field" style={{ margin: 0 }}>
                  현재 통장 잔액
                  <input
                    inputMode="numeric"
                    placeholder="0원"
                    disabled={!canEdit || busy}
                    value={balanceInput ?? (data?.cashBalance != null ? data.cashBalance.toLocaleString() : '')}
                    onChange={event => {
                      const negative = event.target.value.trim().startsWith('-');
                      const formatted = withCommas(event.target.value);
                      setBalanceInput(negative && formatted ? `-${formatted}` : formatted);
                    }}
                  />
                </label>
                {balanceInput !== null && (
                  <button className="btn btn-secondary" disabled={busy} type="submit">
                    저장
                  </button>
                )}
              </form>
            </header>
            <div className="club-table-scroll">
              <table className="club-member-table company-table">
                <thead>
                  <tr>
                    <th>월</th>
                    <th>입금 예정</th>
                    <th>지급 예정</th>
                    <th>고정비</th>
                    <th>세금 납부</th>
                    <th>순현금흐름</th>
                    {data?.cashBalance != null && <th>예상 잔액</th>}
                  </tr>
                </thead>
                <tbody>
                  {forecast.map(row => (
                    <tr key={row.month}>
                      <td>{shortMonth(row.month)}</td>
                      <td className="club-amount" data-sensitive-income="true">
                        {row.salesIn ? won(row.salesIn) : '—'}
                      </td>
                      <td className="club-amount">{row.purchaseOut ? won(row.purchaseOut) : '—'}</td>
                      <td className="club-amount">{row.fixedOut ? won(row.fixedOut) : '—'}</td>
                      <td
                        className="club-amount"
                        title={row.taxEvents.map(event => `${event.date} ${event.label} (${won(event.amount)})`).join('\n')}
                      >
                        {row.vatOut ? won(row.vatOut) : '—'}
                        {row.taxEvents.length > 0 && (
                          <small className="company-tax-tag">
                            {row.taxEvents.map(event => event.label.split(' ')[0]).join(', ')}
                          </small>
                        )}
                      </td>
                      <td
                        className={`club-amount ${row.net >= 0 ? 'company-positive' : 'company-negative'}`}
                        data-sensitive-income="true"
                      >
                        {won(row.net)}
                      </td>
                      {row.balance !== null && (
                        <td
                          className={`club-amount ${row.balance >= 0 ? '' : 'company-negative'}`}
                          data-sensitive-income="true"
                        >
                          {won(row.balance)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 2. 세금계산서 관리 탭 */}
      {activeSubTab === 'invoices' && (
        <div className="company-panel">
          <header className="club-section-title">
            <h3>
              <FileText size={16} />세금계산서 {showAllPeriods ? '전체' : activePeriod.label}
            </h3>
            <div className="company-filters" role="group" aria-label="세금계산서 필터">
              {(['ALL', 'SALES', 'PURCHASE'] as const).map(kind => (
                <button
                  key={kind}
                  className="btn btn-secondary"
                  aria-pressed={kindFilter === kind}
                  onClick={() => setKindFilter(kind)}
                >
                  {kind === 'ALL' ? '전체' : kindLabel(kind)}
                </button>
              ))}
              <label className="company-check">
                <input
                  type="checkbox"
                  checked={showAllPeriods}
                  onChange={event => setShowAllPeriods(event.target.checked)}
                />
                모든 기간
              </label>
            </div>
          </header>
          <div className="club-table-scroll">
            <table className="club-member-table company-table">
              <thead>
                <tr>
                  <th>작성일</th>
                  <th>구분</th>
                  <th>거래처 · 품목</th>
                  <th>공급가액</th>
                  <th>세액</th>
                  <th>합계</th>
                  <th>예정일</th>
                  <th>상태</th>
                  <th aria-label="관리" />
                </tr>
              </thead>
              <tbody>
                {listed.map(invoice => {
                  const status = invoiceStatus(invoice, today);
                  return (
                    <tr key={invoice.id}>
                      <td>{invoice.issueDate}</td>
                      <td>
                        <span className="club-status" data-kind={invoice.kind}>
                          {kindLabel(invoice.kind)}
                        </span>
                        {!invoice.issued && (
                          <span className="club-status company-pending">
                            {invoice.kind === 'SALES' ? '발행 전' : '수취 전'}
                          </span>
                        )}
                      </td>
                      <td className="company-party">
                        <strong>{invoice.counterparty}</strong>
                        {invoice.item && <small>{invoice.item}</small>}
                      </td>
                      <td
                        className="club-amount"
                        data-sensitive-income={invoice.kind === 'SALES' ? 'true' : undefined}
                      >
                        {won(invoice.supplyAmount)}
                      </td>
                      <td className="club-amount">{won(invoice.vat)}</td>
                      <td
                        className="club-amount"
                        data-sensitive-income={invoice.kind === 'SALES' ? 'true' : undefined}
                      >
                        <strong>{won(invoiceTotal(invoice))}</strong>
                      </td>
                      <td>{invoice.dueDate || '—'}</td>
                      <td>
                        {status === 'SETTLED' ? (
                          <span className="club-status" data-paid="true">
                            {settleLabel(invoice.kind)} {invoice.settledAt?.slice(5)}
                          </span>
                        ) : (
                          <span className={`club-status${status === 'OVERDUE' ? ' company-overdue' : ''}`}>
                            {status === 'OVERDUE' ? '기한 지남' : invoice.kind === 'SALES' ? '미수' : '미지급'}
                          </span>
                        )}
                      </td>
                      <td className="company-row-actions">
                        {canEdit && (
                          <>
                            {invoice.settledAt ? (
                              <button
                                className="ledger-text-button"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `${settleLabel(invoice.kind)} 처리를 취소할까요?${
                                        invoice.transactionId ? ' 함께 기록한 거래 내역도 삭제됩니다.' : ''
                                      }`
                                    )
                                  )
                                    void action({ action: 'unsettle', id: invoice.id }, true);
                                }}
                              >
                                {settleLabel(invoice.kind)} 취소
                              </button>
                            ) : (
                              <button
                                className="ledger-text-button"
                                disabled={busy}
                                onClick={() => setSettleForm({ invoice, date: today, record: true })}
                              >
                                {settleLabel(invoice.kind)} 처리
                              </button>
                            )}
                            <button
                              className="ledger-text-button"
                              disabled={busy}
                              onClick={() => openEditInvoice(invoice)}
                            >
                              수정
                            </button>
                            <button
                              className="ledger-text-button"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  confirm(
                                    `${invoice.counterparty} 세금계산서를 삭제할까요?${
                                      invoice.transactionId ? ' 함께 기록한 거래 내역도 삭제됩니다.' : ''
                                    }`
                                  )
                                )
                                  void action({ action: 'delete-invoice', id: invoice.id }, !!invoice.transactionId);
                              }}
                            >
                              삭제
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!listed.length && (
                  <tr>
                    <td colSpan={9}>{loading ? '불러오는 중…' : '등록된 세금계산서가 없습니다.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. 세금 납부 내역 탭 */}
      {activeSubTab === 'tax-payments' && (
        <div className="company-panel">
          <header className="club-section-title">
            <div>
              <h3>
                <Landmark size={16} />세금 납부 내역 ({taxPayments.length}건)
              </h3>
            </div>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => openNewTaxPayment()}>
                <Plus size={14} />세금 납부 등록
              </button>
            )}
          </header>
          <div className="club-table-scroll">
            <table className="club-member-table company-table">
              <thead>
                <tr>
                  <th>납부일자</th>
                  <th>세목</th>
                  <th>과세기간 / 귀속</th>
                  <th>납부 금액</th>
                  <th>관할 관공서</th>
                  <th>메모</th>
                  <th>장부 반영</th>
                  <th aria-label="관리" />
                </tr>
              </thead>
              <tbody>
                {taxPayments.map(payment => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.paidAt}</strong>
                    </td>
                    <td>
                      <span className="club-status" data-kind="PURCHASE">
                        {TAX_TYPE_NAMES[payment.taxType] || payment.taxType}
                      </span>
                    </td>
                    <td>{payment.period || '—'}</td>
                    <td className="club-amount" data-sensitive-income="true">
                      <strong>{won(payment.amount)}</strong>
                    </td>
                    <td>{payment.taxOffice || '—'}</td>
                    <td className="company-party">
                      <small>{payment.memo || '—'}</small>
                    </td>
                    <td>
                      {payment.transactionId ? (
                        <span className="club-status" data-paid="true">
                          지출 반영됨
                        </span>
                      ) : (
                        <span className="company-pending" style={{ fontSize: 12 }}>
                          미반영
                        </span>
                      )}
                    </td>
                    <td className="company-row-actions">
                      {canEdit && (
                        <button
                          className="ledger-text-button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `세금 납부 내역을 삭제할까요?${
                                  payment.transactionId ? ' 함께 기록한 거래 내역도 삭제됩니다.' : ''
                                }`
                              )
                            ) {
                              void action({ action: 'delete-tax-payment', id: payment.id }, !!payment.transactionId);
                            }
                          }}
                        >
                          <Trash2 size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!taxPayments.length && (
                  <tr>
                    <td colSpan={8}>
                      {loading ? '불러오는 중…' : '등록된 세금 납부 내역이 없습니다. [+ 세금 납부 등록]을 눌러 납부 내역을 추가해 보세요.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 세금계산서 등록/수정 모달 */}
      {invoiceForm && (
        <LedgerDialog
          title={`${kindLabel(invoiceForm.kind)} 세금계산서 ${invoiceForm.id ? '수정' : '등록'}`}
          onClose={() => {
            if (!busy) setInvoiceForm(null);
          }}
        >
          <form
            className="club-form"
            onSubmit={event => {
              event.preventDefault();
              void submitInvoiceForm();
            }}
          >
            <div className="club-form-grid">
              <label className="ledger-field">
                구분
                <select
                  value={invoiceForm.kind}
                  disabled={invoiceForm.locked}
                  onChange={event => setInvoiceForm({ ...invoiceForm, kind: event.target.value as InvoiceKind })}
                >
                  <option value="SALES">매출 (발행)</option>
                  <option value="PURCHASE">매입 (수취)</option>
                </select>
              </label>
              <label className="ledger-field">
                작성일자
                <input
                  type="date"
                  required
                  value={invoiceForm.issueDate}
                  onChange={event => setInvoiceForm({ ...invoiceForm, issueDate: event.target.value })}
                />
              </label>
            </div>
            <label className="company-check">
              <input
                type="checkbox"
                checked={invoiceForm.issued}
                onChange={event => setInvoiceForm({ ...invoiceForm, issued: event.target.checked })}
              />
              {invoiceForm.kind === 'SALES'
                ? `홈택스 발행 완료 (발행기한 ${
                    invoiceForm.issueDate ? issueDeadline(invoiceForm.issueDate) : '—'
                  })`
                : '세금계산서 수취 완료'}
            </label>
            <div className="club-form-grid">
              <label className="ledger-field">
                거래처
                <input
                  required
                  maxLength={60}
                  value={invoiceForm.counterparty}
                  onChange={event => setInvoiceForm({ ...invoiceForm, counterparty: event.target.value })}
                />
              </label>
              <label className="ledger-field">
                사업자등록번호 (선택)
                <input
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="000-00-00000"
                  value={invoiceForm.bizNumber}
                  onChange={event =>
                    setInvoiceForm({
                      ...invoiceForm,
                      bizNumber: event.target.value.replace(/[^0-9-]/g, ''),
                    })
                  }
                />
              </label>
            </div>
            <label className="ledger-field">
              품목 (선택)
              <input
                maxLength={100}
                value={invoiceForm.item}
                onChange={event => setInvoiceForm({ ...invoiceForm, item: event.target.value })}
              />
            </label>
            <div className="club-form-grid">
              <label className="ledger-field">
                공급가액 (원)
                <input
                  inputMode="numeric"
                  required
                  value={invoiceForm.supply}
                  onChange={event => {
                    const supply = withCommas(event.target.value);
                    setInvoiceForm({
                      ...invoiceForm,
                      supply,
                      vat: invoiceForm.vatEdited ? invoiceForm.vat : withCommas(String(defaultVat(toNumber(supply)))),
                    });
                  }}
                />
              </label>
              <label className="ledger-field">
                세액 (원)
                <input
                  inputMode="numeric"
                  required
                  value={invoiceForm.vat}
                  onChange={event =>
                    setInvoiceForm({
                      ...invoiceForm,
                      vat: withCommas(event.target.value) || '0',
                      vatEdited: true,
                    })
                  }
                />
                <small className="ledger-muted">
                  기본 10% · 영세율·면세는 0{' '}
                  <button
                    type="button"
                    className="ledger-text-button"
                    onClick={() =>
                      setInvoiceForm({
                        ...invoiceForm,
                        vat: withCommas(String(defaultVat(toNumber(invoiceForm.supply)))) || '0',
                        vatEdited: false,
                      })
                    }
                  >
                    10%로
                  </button>
                </small>
              </label>
            </div>
            <p className="company-total">
              합계 <strong>{won(toNumber(invoiceForm.supply) + toNumber(invoiceForm.vat))}</strong>
            </p>
            <label className="ledger-field">
              {invoiceForm.kind === 'SALES' ? '입금 예정일' : '지급 예정일'} (선택 · 현금흐름 예측에 사용)
              <input
                type="date"
                value={invoiceForm.dueDate}
                onChange={event => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })}
              />
            </label>
            <label className="ledger-field">
              메모
              <textarea
                rows={2}
                maxLength={500}
                value={invoiceForm.memo}
                onChange={event => setInvoiceForm({ ...invoiceForm, memo: event.target.value })}
              />
            </label>

            {error && <p role="alert">{error}</p>}
            <div className="ledger-dialog-actions">
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        </LedgerDialog>
      )}

      {/* 세금계산서 입금/지급 처리 모달 */}
      {settleForm && (
        <LedgerDialog
          title={`${settleForm.invoice.counterparty} ${settleLabel(settleForm.invoice.kind)} 처리`}
          onClose={() => {
            if (!busy) setSettleForm(null);
          }}
        >
          <form
            className="club-form"
            onSubmit={async event => {
              event.preventDefault();
              const result = await action(
                {
                  action: 'settle',
                  id: settleForm.invoice.id,
                  date: settleForm.date,
                  record: settleForm.record,
                },
                settleForm.record
              );
              if (result) setSettleForm(null);
            }}
          >
            <p>
              합계{' '}
              <strong data-sensitive-income={settleForm.invoice.kind === 'SALES' ? 'true' : undefined}>
                {won(invoiceTotal(settleForm.invoice))}
              </strong>{' '}
              (공급가액 {won(settleForm.invoice.supplyAmount)} + 세액 {won(settleForm.invoice.vat)})
            </p>
            <label className="ledger-field">
              {settleLabel(settleForm.invoice.kind)}일
              <input
                type="date"
                required
                value={settleForm.date}
                onChange={event => setSettleForm({ ...settleForm, date: event.target.value })}
              />
            </label>
            <label className="company-check">
              <input
                type="checkbox"
                checked={settleForm.record}
                onChange={event => setSettleForm({ ...settleForm, record: event.target.checked })}
              />
              거래내역에 {settleForm.invoice.kind === 'SALES' ? '수입(매출)' : '지출(매입)'}으로 함께 기록
            </label>

            {error && <p role="alert">{error}</p>}
            <div className="ledger-dialog-actions">
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? '처리 중…' : `${settleLabel(settleForm.invoice.kind)} 완료`}
              </button>
            </div>
          </form>
        </LedgerDialog>
      )}

      {/* 세금 납부 등록 모달 */}
      {taxPaymentForm && (
        <LedgerDialog
          title="세금 납부 내역 등록"
          onClose={() => {
            if (!busy) setTaxPaymentForm(null);
          }}
        >
          <form
            className="club-form"
            onSubmit={async event => {
              event.preventDefault();
              await submitTaxPaymentForm();
            }}
          >
            <div className="club-form-grid">
              <label className="ledger-field">
                납부일자
                <input
                  type="date"
                  required
                  value={taxPaymentForm.paidAt}
                  onChange={event => setTaxPaymentForm({ ...taxPaymentForm, paidAt: event.target.value })}
                />
              </label>
              <label className="ledger-field">
                세목
                <select
                  value={taxPaymentForm.taxType}
                  onChange={event => setTaxPaymentForm({ ...taxPaymentForm, taxType: event.target.value as TaxType })}
                >
                  <option value="VAT">부가가치세</option>
                  <option value="INCOME">종합소득세</option>
                  <option value="LOCAL">개인지방소득세</option>
                  <option value="WITHHOLDING">원천세</option>
                  <option value="FOUR_MAJOR">4대보험</option>
                  <option value="OTHER">기타 세무·공과금</option>
                </select>
              </label>
            </div>

            <label className="ledger-field">
              납부 금액 (원)
              <input
                inputMode="numeric"
                required
                placeholder="0"
                value={taxPaymentForm.amount}
                onChange={event => setTaxPaymentForm({ ...taxPaymentForm, amount: withCommas(event.target.value) })}
              />
            </label>

            <label className="ledger-field">
              과세기간 / 귀속연도
              <input
                placeholder="예: 2025년 2기 확정, 2025년 귀속 종합소득세"
                value={taxPaymentForm.period}
                onChange={event => setTaxPaymentForm({ ...taxPaymentForm, period: event.target.value })}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '2px 8px', minHeight: 24 }}
                  onClick={() => setTaxPaymentForm({ ...taxPaymentForm, period: `${activePeriod.label} 확정` })}
                >
                  {activePeriod.label} 확정
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '2px 8px', minHeight: 24 }}
                  onClick={() => setTaxPaymentForm({ ...taxPaymentForm, period: `${activePeriod.label} 예정` })}
                >
                  {activePeriod.label} 예정
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '2px 8px', minHeight: 24 }}
                  onClick={() => setTaxPaymentForm({ ...taxPaymentForm, period: `${Number(today.slice(0, 4)) - 1}년 귀속 종소세` })}
                >
                  {Number(today.slice(0, 4)) - 1}년 귀속 종소세
                </button>
              </div>
            </label>

            <label className="ledger-field">
              관할 관공서 (선택)
              <input
                placeholder="국세청 홈택스, 역삼세무서, 관할 구청 등"
                value={taxPaymentForm.taxOffice}
                onChange={event => setTaxPaymentForm({ ...taxPaymentForm, taxOffice: event.target.value })}
              />
            </label>

            <label className="ledger-field">
              메모 (선택)
              <textarea
                rows={2}
                maxLength={500}
                placeholder="신고 내역 및 특이사항 메모"
                value={taxPaymentForm.memo}
                onChange={event => setTaxPaymentForm({ ...taxPaymentForm, memo: event.target.value })}
              />
            </label>

            <label className="company-check">
              <input
                type="checkbox"
                checked={taxPaymentForm.record}
                onChange={event => setTaxPaymentForm({ ...taxPaymentForm, record: event.target.checked })}
              />
              거래내역에 지출(세금·공과금)으로 함께 기록
            </label>

            {error && <p role="alert">{error}</p>}
            <div className="ledger-dialog-actions">
              <button className="btn btn-primary" disabled={busy} type="submit">
                {busy ? '등록 중…' : '세금 납부 등록'}
              </button>
            </div>
          </form>
        </LedgerDialog>
      )}
    </section>
  );
}
