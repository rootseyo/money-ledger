import type { FixedExpenseItem } from './fixed-expenses';
import { scheduledDates } from './fixed-expense-schedule';

/**
 * 회사 회계형 가계부 (개인 일반과세자 기준)
 * - 매출(발행)·매입(수취) 세금계산서 관리
 * - 부가가치세 예상: 1기(1~6월) 7/25 확정, 2기(7~12월) 다음 해 1/25 확정,
 *   4/25·10/25 예정고지(직전 기 납부세액의 1/2, 50만 원 미만이면 고지 생략)
 * - 고정비·미수금·미지급금·부가세를 합친 월별 현금흐름 예측
 * 계산 결과는 참고용 추정치이며 실제 신고·고지 금액과 다를 수 있다.
 */

export type InvoiceKind = 'SALES' | 'PURCHASE';

export type TaxType =
  | 'VAT'          // 부가가치세
  | 'INCOME'       // 종합소득세
  | 'WITHHOLDING'  // 원천세
  | 'LOCAL'        // 지방소득세
  | 'FOUR_MAJOR'   // 4대보험
  | 'OTHER';       // 기타 세금·공과금

export const TAX_TYPE_NAMES: Record<TaxType, string> = {
  VAT: '부가가치세',
  INCOME: '종합소득세',
  WITHHOLDING: '원천세',
  LOCAL: '지방소득세',
  FOUR_MAJOR: '4대보험',
  OTHER: '기타 세금·공과금',
};

export interface TaxPayment {
  id: string;
  paidAt: string; // 납부일자 (YYYY-MM-DD)
  taxType: TaxType; // 세목
  amount: number; // 납부 금액
  period?: string; // 과세기간/귀속연도 (예: 2025년 2기 확정, 2025년 귀속 종합소득세)
  memo?: string; // 상세 메모
  taxOffice?: string; // 관할 세무서/구청
  transactionId?: string | null; // 장부 거래 연결 ID
  createdAt: string;
  updatedAt: string;
}

export interface TaxInvoice {
  id: string;
  kind: InvoiceKind;
  issueDate: string; // 작성일자 (YYYY-MM-DD) — 부가세 과세기간 판단 기준
  issued: boolean; // 매출: 홈택스 발행 완료 여부 / 매입: 수취 완료 여부
  counterparty: string; // 거래처
  bizNumber?: string; // 거래처 사업자등록번호
  item?: string; // 품목
  supplyAmount: number; // 공급가액
  vat: number; // 세액 (영세율·면세는 0)
  dueDate?: string | null; // 입금(지급) 예정일
  settledAt?: string | null; // 실제 입금(지급)일
  transactionId?: string | null; // 입금·지급 처리 시 함께 기록한 거래 ID
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyFinanceData {
  invoices: TaxInvoice[];
  taxPayments: TaxPayment[];
  cashBalance: number | null; // 현재 통장 잔액 (예상 잔액 계산용, 선택)
  openDate?: string | null; // 사업자 개업일자 (YYYY-MM-DD)
}

export const COMPANY_FINANCE_KEY = 'company_finance';
export const MAX_INVOICES = 5000;
export const MAX_TAX_PAYMENTS = 2000;
export const MAX_AMOUNT = 100_000_000_000;
export const VAT_PRELIM_MIN = 500_000;
export const INCOME_TAX_PRELIM_MIN = 500_000;

export const COMPANY_CATEGORIES = [
  { id: 'BIZ_SALES', name: '매출', type: 'INCOME', emoji: '💼', color: '#10b981', subcategories: ['용역 매출', '상품 매출', '기타 매출'] },
  { id: 'BIZ_OTHER_INCOME', name: '기타 수입', type: 'INCOME', emoji: '💰', color: '#14b8a6', subcategories: ['이자', '환급금', '지원금', '기타'] },
  { id: 'BIZ_PURCHASE', name: '매입', type: 'EXPENSE', emoji: '🧾', color: '#6366f1', subcategories: ['원재료·상품', '외주 용역', '기타 매입'] },
  { id: 'BIZ_RENT', name: '임차료', type: 'EXPENSE', emoji: '🏢', color: '#3b82f6', subcategories: ['사무실 임대료', '관리비'] },
  { id: 'BIZ_PAYROLL', name: '인건비', type: 'EXPENSE', emoji: '👥', color: '#8b5cf6', subcategories: ['급여', '상여', '퇴직금', '4대보험'] },
  { id: 'BIZ_TAX', name: '세금·공과금', type: 'EXPENSE', emoji: '🏛️', color: '#ef4444', subcategories: ['부가가치세', '종합소득세', '원천세', '지방세', '기타 공과금'] },
  { id: 'BIZ_COMM', name: '통신·구독', type: 'EXPENSE', emoji: '📡', color: '#0ea5e9', subcategories: ['통신비', '소프트웨어 구독', '호스팅·클라우드'] },
  { id: 'BIZ_SUPPLIES', name: '소모품·비품', type: 'EXPENSE', emoji: '🖇️', color: '#f59e0b', subcategories: ['소모품', '비품', '장비'] },
  { id: 'BIZ_MARKETING', name: '광고·마케팅', type: 'EXPENSE', emoji: '📣', color: '#ec4899', subcategories: ['광고비', '홍보물'] },
  { id: 'BIZ_TRAVEL', name: '여비·교통', type: 'EXPENSE', emoji: '🚗', color: '#22c55e', subcategories: ['교통비', '유류비', '출장비'] },
  { id: 'BIZ_MEAL', name: '복리후생·접대', type: 'EXPENSE', emoji: '🍽️', color: '#f97316', subcategories: ['식대', '접대비', '복리후생'] },
  { id: 'BIZ_FEES', name: '지급수수료', type: 'EXPENSE', emoji: '🧮', color: '#64748b', subcategories: ['세무기장료', '카드·PG 수수료', '은행 수수료'] },
  { id: 'BIZ_OTHER', name: '기타 지출', type: 'EXPENSE', emoji: '📌', color: '#94a3b8', subcategories: ['기타'] },
];

export class CompanyLedgerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) >= 2000;
}

const validAmount = (value: unknown, allowZero = false): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && (allowZero ? value >= 0 : value > 0) && value <= MAX_AMOUNT;

/** 세액 기본값: 공급가액의 10%, 원 미만 절사 */
export function defaultVat(supplyAmount: number) {
  return Math.max(0, Math.floor(supplyAmount / 10));
}

export const invoiceTotal = (invoice: Pick<TaxInvoice, 'supplyAmount' | 'vat'>) => invoice.supplyAmount + invoice.vat;

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** 입력값을 검증해 저장 가능한 세금계산서로 만든다. 입금 처리 정보는 별도 동작으로만 바꾼다. */
export function normalizeInvoice(input: Record<string, unknown>, existing: TaxInvoice | undefined, id: string, now = new Date()): TaxInvoice {
  const kind = input.kind;
  if (kind !== 'SALES' && kind !== 'PURCHASE') throw new CompanyLedgerError('매출·매입 구분을 선택해 주세요.');
  if (!validDate(input.issueDate)) throw new CompanyLedgerError('작성일자를 확인해 주세요.');
  const counterparty = text(input.counterparty, 60);
  if (!counterparty) throw new CompanyLedgerError('거래처를 입력해 주세요.');
  const bizNumber = text(input.bizNumber, 12).replace(/[^0-9-]/g, '');
  if (bizNumber && bizNumber.replace(/-/g, '').length !== 10) throw new CompanyLedgerError('사업자등록번호는 숫자 10자리로 입력해 주세요.');
  const supplyAmount = Number(input.supplyAmount);
  if (!validAmount(supplyAmount)) throw new CompanyLedgerError('공급가액을 확인해 주세요.');
  const vat = input.vat === undefined || input.vat === null || input.vat === '' ? defaultVat(supplyAmount) : Number(input.vat);
  if (!validAmount(vat, true)) throw new CompanyLedgerError('세액을 확인해 주세요.');
  const dueDate = input.dueDate === undefined || input.dueDate === null || input.dueDate === '' ? null : input.dueDate;
  if (dueDate !== null && !validDate(dueDate)) throw new CompanyLedgerError('입금·지급 예정일을 확인해 주세요.');
  if (existing?.transactionId && existing.kind !== kind) throw new CompanyLedgerError('거래 내역과 연결된 세금계산서는 구분을 바꿀 수 없습니다. 먼저 입금·지급 처리를 취소해 주세요.');
  const stamp = now.toISOString();
  return {
    id,
    kind,
    issueDate: input.issueDate,
    issued: input.issued !== false,
    counterparty,
    bizNumber: bizNumber || undefined,
    item: text(input.item, 100) || undefined,
    supplyAmount,
    vat,
    dueDate: dueDate as string | null,
    settledAt: existing?.settledAt ?? null,
    transactionId: existing?.transactionId ?? null,
    memo: text(input.memo, 500) || undefined,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}

export function normalizeTaxPayment(input: Record<string, unknown>, existing: TaxPayment | undefined, id: string, now = new Date()): TaxPayment {
  if (!validDate(input.paidAt)) throw new CompanyLedgerError('납부일자를 확인해 주세요.');
  const taxType = input.taxType as TaxType;
  if (!taxType || !TAX_TYPE_NAMES[taxType]) throw new CompanyLedgerError('세목을 선택해 주세요.');
  const amount = Number(input.amount);
  if (!validAmount(amount)) throw new CompanyLedgerError('납부 금액을 확인해 주세요.');
  const period = text(input.period, 60);
  const memo = text(input.memo, 500);
  const taxOffice = text(input.taxOffice, 60);
  const stamp = now.toISOString();

  return {
    id,
    paidAt: input.paidAt,
    taxType,
    amount,
    period: period || undefined,
    memo: memo || undefined,
    taxOffice: taxOffice || undefined,
    transactionId: existing?.transactionId ?? null,
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
}

export function parseCompanyFinance(value: string | null | undefined): CompanyFinanceData {
  if (!value) return { invoices: [], taxPayments: [], cashBalance: null, openDate: null };
  try {
    const parsed = JSON.parse(value);
    const invoices = Array.isArray(parsed?.invoices) ? parsed.invoices.filter((item: TaxInvoice) => item && typeof item.id === 'string' && validDate(item.issueDate)) : [];
    const taxPayments = Array.isArray(parsed?.taxPayments) ? parsed.taxPayments.filter((item: TaxPayment) => item && typeof item.id === 'string' && validDate(item.paidAt) && item.taxType && TAX_TYPE_NAMES[item.taxType]) : [];
    const cashBalance = Number.isSafeInteger(parsed?.cashBalance) ? parsed.cashBalance : null;
    const openDate = validDate(parsed?.openDate) ? parsed.openDate : null;
    return { invoices, taxPayments, cashBalance, openDate };
  } catch {
    return { invoices: [], taxPayments: [], cashBalance: null, openDate: null };
  }
}

// ── 부가가치세 (개인 일반과세자) ─────────────────────────────

export interface VatPeriod {
  year: number;
  half: 1 | 2;
  label: string; // 2026년 1기
  start: string;
  end: string;
  prelimDate: string; // 예정고지 납부기한
  finalDate: string; // 확정신고·납부기한
}

export function vatPeriodOf(date: string): VatPeriod {
  const year = Number(date.slice(0, 4));
  const half: 1 | 2 = Number(date.slice(5, 7)) <= 6 ? 1 : 2;
  return vatPeriod(year, half);
}

export function vatPeriod(year: number, half: 1 | 2): VatPeriod {
  return half === 1
    ? { year, half, label: `${year}년 1기`, start: `${year}-01-01`, end: `${year}-06-30`, prelimDate: `${year}-04-25`, finalDate: `${year}-07-25` }
    : { year, half, label: `${year}년 2기`, start: `${year}-07-01`, end: `${year}-12-31`, prelimDate: `${year}-10-25`, finalDate: `${year + 1}-01-25` };
}

export function previousVatPeriod(period: VatPeriod): VatPeriod {
  return period.half === 1 ? vatPeriod(period.year - 1, 2) : vatPeriod(period.year, 1);
}

export interface VatSummary {
  period: VatPeriod;
  salesSupply: number;
  salesVat: number;
  purchaseSupply: number;
  purchaseVat: number;
  payable: number; // 매출세액 − 매입세액 (음수면 환급 예상)
  prelim: number; // 예정고지 예상액
  finalPayment: number; // 확정신고 때 추가로 낼 금액 (예정고지 차감)
  hasPreviousData: boolean;
  pendingCount: number; // 발행·수취 대기 건수
}

const inPeriod = (invoice: TaxInvoice, period: VatPeriod) => invoice.issueDate >= period.start && invoice.issueDate <= period.end;

function periodTotals(invoices: TaxInvoice[], period: VatPeriod) {
  let salesSupply = 0, salesVat = 0, purchaseSupply = 0, purchaseVat = 0, count = 0, pendingCount = 0;
  for (const invoice of invoices) {
    if (!inPeriod(invoice, period)) continue;
    count += 1;
    if (!invoice.issued) pendingCount += 1;
    if (invoice.kind === 'SALES') { salesSupply += invoice.supplyAmount; salesVat += invoice.vat; }
    else { purchaseSupply += invoice.supplyAmount; purchaseVat += invoice.vat; }
  }
  return { salesSupply, salesVat, purchaseSupply, purchaseVat, payable: salesVat - purchaseVat, count, pendingCount };
}

/** 예정고지: 직전 기 납부세액의 1/2. 50만 원 미만이면 고지하지 않는다. */
export function prelimNotice(previousPayable: number) {
  const half = Math.floor(Math.max(0, previousPayable) / 2);
  return half < VAT_PRELIM_MIN ? 0 : half;
}

export function summarizeVat(invoices: TaxInvoice[], period: VatPeriod, taxPayments: TaxPayment[] = []): VatSummary {
  const current = periodTotals(invoices, period);
  const previous = periodTotals(invoices, previousVatPeriod(period));

  // 직전 기 부가세 실제 납부 내역이 있는 경우 해당 실납부액을 우선 기준세액으로 채택
  const prevPeriod = previousVatPeriod(period);
  const matchedPayment = taxPayments.find(p => p.taxType === 'VAT' && p.period && p.period.includes(prevPeriod.label));
  const previousPayable = matchedPayment ? matchedPayment.amount : previous.payable;

  const prelim = prelimNotice(previousPayable);
  return {
    period,
    salesSupply: current.salesSupply,
    salesVat: current.salesVat,
    purchaseSupply: current.purchaseSupply,
    purchaseVat: current.purchaseVat,
    payable: current.payable,
    prelim,
    finalPayment: Math.max(0, current.payable - prelim),
    hasPreviousData: matchedPayment != null || previous.count > 0,
    pendingCount: current.pendingCount,
  };
}

export interface TaxEvent { date: string; label: string; amount: number; taxType?: TaxType }

/** month(YYYY-MM)에 납부기한이 있는 부가세 및 종합소득세 세금 일정 */
export function taxEventsForMonth(invoices: TaxInvoice[], month: string, taxPayments: TaxPayment[] = []): TaxEvent[] {
  const year = Number(month.slice(0, 4));
  const mm = month.slice(5, 7);
  const events: TaxEvent[] = [];

  // 1) 부가가치세 (개인 일반과세자: 1/4/7/10월)
  if (mm === '04' || mm === '10') {
    const summary = summarizeVat(invoices, vatPeriod(year, mm === '04' ? 1 : 2), taxPayments);
    if (summary.prelim > 0) {
      events.push({ date: summary.period.prelimDate, label: `${summary.period.label} 부가세 예정고지`, amount: summary.prelim, taxType: 'VAT' });
    }
  } else if (mm === '01' || mm === '07') {
    const summary = summarizeVat(invoices, mm === '07' ? vatPeriod(year, 1) : vatPeriod(year - 1, 2), taxPayments);
    if (summary.finalPayment > 0 || summary.payable > 0) {
      events.push({ date: summary.period.finalDate, label: `${summary.period.label} 부가세 확정신고`, amount: summary.finalPayment, taxType: 'VAT' });
    }
  }

  // 2) 종합소득세 & 개인지방소득세 (5월 확정, 11월 중간예납)
  const incomeTaxes = taxPayments.filter(p => p.taxType === 'INCOME').sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const lastIncomeTax = incomeTaxes[0]?.amount || 0;

  if (mm === '05') {
    // 5월: 종합소득세 및 지방소득세 확정신고
    // 직전 납부 실적이 있으면 그 금액 기준, 없으면 당해 매출의 약 3.5% 추정
    let estIncomeTax = lastIncomeTax;
    if (!estIncomeTax) {
      const annualSales = invoices.filter(inv => inv.kind === 'SALES' && inv.issueDate.startsWith(String(year - 1))).reduce((sum, inv) => sum + inv.supplyAmount, 0);
      estIncomeTax = annualSales > 0 ? Math.floor(annualSales * 0.035) : 0;
    }
    if (estIncomeTax > 0) {
      events.push({ date: `${year}-05-31`, label: `${year - 1}년 귀속 종합소득세 확정신고`, amount: estIncomeTax, taxType: 'INCOME' });
      events.push({ date: `${year}-05-31`, label: `${year - 1}년 귀속 개인지방소득세`, amount: Math.floor(estIncomeTax * 0.1), taxType: 'LOCAL' });
    }
  } else if (mm === '11') {
    // 11월: 종합소득세 중간예납 (직전 연도 납부세액의 50%, 50만원 미만 면제)
    const prelimIncome = Math.floor(lastIncomeTax / 2);
    if (prelimIncome >= INCOME_TAX_PRELIM_MIN) {
      events.push({ date: `${year}-11-30`, label: `${year}년 종합소득세 중간예납`, amount: prelimIncome, taxType: 'INCOME' });
    }
  }

  return events;
}

/** 하위 호환을 위한 별칭 */
export function vatEventsForMonth(invoices: TaxInvoice[], month: string, taxPayments: TaxPayment[] = []): TaxEvent[] {
  return taxEventsForMonth(invoices, month, taxPayments).filter(e => e.taxType === 'VAT');
}

// ── 세금 예측 & 종합 분석 ───────────────────────────────

export interface TaxForecastItem {
  id: string;
  taxType: TaxType;
  label: string;
  dueDate: string;
  amount: number;
  basis: string;
  confidence: 'CONFIRMED' | 'HIGH' | 'ESTIMATED';
}

export interface TaxForecastSummary {
  totalPaid: number;
  paidByType: Record<TaxType, number>;
  historyCount: number;
  upcomingEvents: TaxForecastItem[];
  nextTax: TaxForecastItem | null;
  annualForecastTotal: number;
  monthlyReserveRecommendation: number;
  recentIncomeTaxPaid: number;
  recentVatPaid: number;
}

export function predictTaxes({
  invoices,
  taxPayments = [],
  today,
  openDate = null,
}: {
  invoices: TaxInvoice[];
  taxPayments?: TaxPayment[];
  today: string;
  openDate?: string | null;
}): TaxForecastSummary {
  const paidByType: Record<TaxType, number> = {
    VAT: 0,
    INCOME: 0,
    WITHHOLDING: 0,
    LOCAL: 0,
    FOUR_MAJOR: 0,
    OTHER: 0,
  };
  let totalPaid = 0;
  for (const payment of taxPayments) {
    if (paidByType[payment.taxType] !== undefined) {
      paidByType[payment.taxType] += payment.amount;
    }
    totalPaid += payment.amount;
  }

  const vatPayments = taxPayments.filter(p => p.taxType === 'VAT').sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const incomePayments = taxPayments.filter(p => p.taxType === 'INCOME').sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const recentVatPaid = vatPayments[0]?.amount || 0;
  const recentIncomeTaxPaid = incomePayments[0]?.amount || 0;

  const currentYear = Number(today.slice(0, 4));
  const upcomingEvents: TaxForecastItem[] = [];

  for (let offset = 0; offset < 12; offset++) {
    const month = shiftMonth(today.slice(0, 7), offset);
    const mYear = Number(month.slice(0, 4));
    const mm = month.slice(5, 7);

    if (mm === '01') {
      const p = vatPeriod(mYear - 1, 2);
      const summary = summarizeVat(invoices, p, taxPayments);
      const amount = summary.finalPayment;
      const dueDate = p.finalDate;
      if (dueDate >= today) {
        upcomingEvents.push({
          id: `${dueDate}-vat-final`,
          taxType: 'VAT',
          label: `${p.label} 부가가치세 확정신고`,
          dueDate,
          amount,
          basis: summary.hasPreviousData
            ? `매출세액(${summary.salesVat.toLocaleString()}원) − 매입세액(${summary.purchaseVat.toLocaleString()}원) − 예정고지 차감`
            : `최근 부가세 납부 실적 및 세금계산서 기준`,
          confidence: summary.hasPreviousData ? 'HIGH' : 'ESTIMATED',
        });
      }
    } else if (mm === '04') {
      const p = vatPeriod(mYear, 1);
      const summary = summarizeVat(invoices, p, taxPayments);
      const amount = summary.prelim;
      const dueDate = p.prelimDate;
      if (dueDate >= today) {
        upcomingEvents.push({
          id: `${dueDate}-vat-prelim`,
          taxType: 'VAT',
          label: `${p.label} 부가가치세 예정고지`,
          dueDate,
          amount,
          basis: amount > 0 ? `직전 기(${summary.period.year - 1}년 2기) 납부세액의 50%` : `50만 원 미만 고지 생략`,
          confidence: 'HIGH',
        });
      }
    } else if (mm === '05') {
      const dueDate = `${mYear}-05-31`;
      if (dueDate >= today) {
        let estIncomeTax = recentIncomeTaxPaid;
        let basis = `직전 종합소득세 실납부액(${recentIncomeTaxPaid.toLocaleString()}원) 기준`;
        let confidence: 'CONFIRMED' | 'HIGH' | 'ESTIMATED' = 'ESTIMATED';

        if (!estIncomeTax) {
          const annualSales = invoices
            .filter(inv => inv.kind === 'SALES' && inv.issueDate.startsWith(String(mYear - 1)))
            .reduce((sum, inv) => sum + inv.supplyAmount, 0);
          estIncomeTax = annualSales > 0 ? Math.floor(annualSales * 0.035) : 0;
          basis = annualSales > 0 ? `${mYear - 1}년 매출(${annualSales.toLocaleString()}원)의 약 3.5% 추정` : `등록된 실적 데이터 기반 추정`;
        } else {
          confidence = 'HIGH';
        }

        if (estIncomeTax > 0) {
          upcomingEvents.push({
            id: `${dueDate}-income-tax`,
            taxType: 'INCOME',
            label: `${mYear - 1}년 귀속 종합소득세 확정신고`,
            dueDate,
            amount: estIncomeTax,
            basis,
            confidence,
          });
          upcomingEvents.push({
            id: `${dueDate}-local-income-tax`,
            taxType: 'LOCAL',
            label: `${mYear - 1}년 귀속 개인지방소득세`,
            dueDate,
            amount: Math.floor(estIncomeTax * 0.1),
            basis: `종합소득세의 10%`,
            confidence,
          });
        }
      }
    } else if (mm === '07') {
      const p = vatPeriod(mYear, 1);
      const summary = summarizeVat(invoices, p, taxPayments);
      const amount = summary.finalPayment;
      const dueDate = p.finalDate;
      if (dueDate >= today) {
        upcomingEvents.push({
          id: `${dueDate}-vat-final`,
          taxType: 'VAT',
          label: `${p.label} 부가가치세 확정신고`,
          dueDate,
          amount,
          basis: `매출세액(${summary.salesVat.toLocaleString()}원) − 매입세액(${summary.purchaseVat.toLocaleString()}원) − 예정고지 차감`,
          confidence: summary.hasPreviousData ? 'HIGH' : 'ESTIMATED',
        });
      }
    } else if (mm === '10') {
      const p = vatPeriod(mYear, 2);
      const summary = summarizeVat(invoices, p, taxPayments);
      const amount = summary.prelim;
      const dueDate = p.prelimDate;
      if (dueDate >= today) {
        upcomingEvents.push({
          id: `${dueDate}-vat-prelim`,
          taxType: 'VAT',
          label: `${p.label} 부가가치세 예정고지`,
          dueDate,
          amount,
          basis: amount > 0 ? `직전 기(${summary.period.year}년 1기) 납부세액의 50%` : `50만 원 미만 고지 생략`,
          confidence: 'HIGH',
        });
      }
    } else if (mm === '11') {
      const dueDate = `${mYear}-11-30`;
      if (dueDate >= today) {
        const prelimIncome = Math.floor(recentIncomeTaxPaid / 2);
        if (prelimIncome >= INCOME_TAX_PRELIM_MIN) {
          upcomingEvents.push({
            id: `${dueDate}-income-prelim`,
            taxType: 'INCOME',
            label: `${mYear}년 종합소득세 중간예납`,
            dueDate,
            amount: prelimIncome,
            basis: `직전 종합소득세 납부액(${recentIncomeTaxPaid.toLocaleString()}원)의 50%`,
            confidence: 'HIGH',
          });
        }
      }
    }
  }

  upcomingEvents.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const nextTax = upcomingEvents[0] || null;

  const thisYearEvents = upcomingEvents.filter(e => e.dueDate.startsWith(String(currentYear)));
  const annualForecastTotal = thisYearEvents.reduce((sum, e) => sum + e.amount, 0);
  const monthlyReserveRecommendation = Math.ceil(annualForecastTotal / 12 / 10000) * 10000;

  return {
    totalPaid,
    paidByType,
    historyCount: taxPayments.length,
    upcomingEvents,
    nextTax,
    annualForecastTotal,
    monthlyReserveRecommendation,
    recentIncomeTaxPaid,
    recentVatPaid,
  };
}

// ── 세금계산서 상태 ──────────────────────────────────────

/** 매출 세금계산서 발행기한: 작성일이 속한 달의 다음 달 10일 */
export function issueDeadline(issueDate: string) {
  const year = Number(issueDate.slice(0, 4));
  const month = Number(issueDate.slice(5, 7));
  return month === 12 ? `${year + 1}-01-10` : `${year}-${String(month + 1).padStart(2, '0')}-10`;
}

export type InvoiceStatus = 'SETTLED' | 'OVERDUE' | 'OPEN';
export function invoiceStatus(invoice: TaxInvoice, today: string): InvoiceStatus {
  if (invoice.settledAt) return 'SETTLED';
  return invoice.dueDate && invoice.dueDate < today ? 'OVERDUE' : 'OPEN';
}

export function outstanding(invoices: TaxInvoice[], kind: InvoiceKind, today: string) {
  let total = 0, overdue = 0, count = 0;
  for (const invoice of invoices) {
    if (invoice.kind !== kind || invoice.settledAt) continue;
    total += invoiceTotal(invoice);
    count += 1;
    if (invoiceStatus(invoice, today) === 'OVERDUE') overdue += invoiceTotal(invoice);
  }
  return { total, overdue, count };
}

// ── 월별 현금흐름 예측 ────────────────────────────────────

export const shiftMonth = (month: string, offset: number) => {
  const [year, mm] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, mm - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
};

export interface ForecastRow {
  month: string;
  salesIn: number; // 입금 예정 (미수 매출)
  purchaseOut: number; // 지급 예정 (미지급 매입)
  fixedOut: number; // 고정비
  vatOut: number; // 부가세 납부
  net: number;
  balance: number | null; // 예상 잔액 (시작 잔액 입력 시)
  taxEvents: TaxEvent[];
}

/**
 * 오늘이 속한 달부터 months개월의 현금흐름을 예측한다.
 * - 입금·지급이 끝나지 않은 세금계산서는 예정일(없으면 작성일)이 속한 달로 잡되,
 *   이미 지난 건은 이번 달에 들어올(나갈) 것으로 본다.
 * - 고정비는 '고정비 관리'의 활성 항목 일정으로 계산한다.
 * - 이번 달은 오늘 이후의 고정비·세금 일정만 포함한다.
 */
export function buildForecast({ invoices, taxPayments = [], fixedExpenses, today, months = 6, cashBalance = null }: {
  invoices: TaxInvoice[]; taxPayments?: TaxPayment[]; fixedExpenses: FixedExpenseItem[]; today: string; months?: number; cashBalance?: number | null;
}): ForecastRow[] {
  const firstMonth = today.slice(0, 7);
  const rows: ForecastRow[] = Array.from({ length: months }, (_, index) => {
    const month = shiftMonth(firstMonth, index);
    // 이번 달은 오늘 이후 일정만 남은 지출로 본다 (이미 지난 고정비·세금은 잔액에 반영됐다고 가정).
    const upcoming = (date: string) => index > 0 || date >= today;
    const fixedOut = fixedExpenses.reduce((sum, item) => {
      try { return sum + scheduledDates(item, month).filter(upcoming).length * item.amount; } catch { return sum; }
    }, 0);
    const taxEvents = taxEventsForMonth(invoices, month, taxPayments).filter(event => upcoming(event.date));
    return { month, salesIn: 0, purchaseOut: 0, fixedOut, vatOut: taxEvents.reduce((sum, event) => sum + event.amount, 0), net: 0, balance: null, taxEvents };
  });
  const byMonth = new Map(rows.map(row => [row.month, row]));
  for (const invoice of invoices) {
    if (invoice.settledAt) continue;
    const expected = (invoice.dueDate || invoice.issueDate).slice(0, 7);
    const row = byMonth.get(expected < firstMonth ? firstMonth : expected);
    if (!row) continue;
    if (invoice.kind === 'SALES') row.salesIn += invoiceTotal(invoice);
    else row.purchaseOut += invoiceTotal(invoice);
  }
  let running = cashBalance;
  for (const row of rows) {
    row.net = row.salesIn - row.purchaseOut - row.fixedOut - row.vatOut;
    if (running !== null) { running += row.net; row.balance = running; }
  }
  return rows;
}
