import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildForecast, defaultVat, invoiceStatus, issueDeadline, normalizeInvoice, normalizeTaxPayment, outstanding, parseCompanyFinance,
  predictTaxes, prelimNotice, summarizeVat, vatEventsForMonth, vatPeriod, vatPeriodOf, type TaxInvoice, type TaxPayment,
} from '../src/lib/company-ledger';
import type { FixedExpenseItem } from '../src/lib/fixed-expenses';

let seq = 0;
function invoice(partial: Partial<TaxInvoice> & Pick<TaxInvoice, 'kind' | 'issueDate' | 'supplyAmount'>): TaxInvoice {
  seq += 1;
  return {
    id: `00000000-0000-0000-0000-${String(seq).padStart(12, '0')}`,
    issued: true, counterparty: '거래처', vat: defaultVat(partial.supplyAmount), dueDate: null, settledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...partial,
  };
}

test('VAT periods follow the individual general taxpayer schedule', () => {
  assert.deepEqual(vatPeriodOf('2026-03-15'), vatPeriod(2026, 1));
  assert.equal(vatPeriod(2026, 1).finalDate, '2026-07-25');
  assert.equal(vatPeriod(2026, 1).prelimDate, '2026-04-25');
  assert.equal(vatPeriodOf('2026-07-01').label, '2026년 2기');
  assert.equal(vatPeriod(2026, 2).finalDate, '2027-01-25');
});

test('default VAT truncates below one won and invoices are validated', () => {
  assert.equal(defaultVat(1_234_567), 123_456);
  const valid = normalizeInvoice({ kind: 'SALES', issueDate: '2026-11-09', counterparty: ' ACME ', supplyAmount: 1_000_000, bizNumber: '123-45-67890' }, undefined, 'id-1', new Date('2026-11-09T00:00:00Z'));
  assert.equal(valid.counterparty, 'ACME');
  assert.equal(valid.vat, 100_000);
  assert.equal(valid.issued, true);
  assert.equal(normalizeInvoice({ kind: 'PURCHASE', issueDate: '2026-11-09', counterparty: '면세', supplyAmount: 5000, vat: 0 }, undefined, 'id-2').vat, 0);
  assert.throws(() => normalizeInvoice({ kind: 'SALES', issueDate: '2026-02-30', counterparty: 'A', supplyAmount: 1 }, undefined, 'x'), /작성일자/);
  assert.throws(() => normalizeInvoice({ kind: 'SALES', issueDate: '2026-02-01', counterparty: '', supplyAmount: 1 }, undefined, 'x'), /거래처/);
  assert.throws(() => normalizeInvoice({ kind: 'SALES', issueDate: '2026-02-01', counterparty: 'A', supplyAmount: -1 }, undefined, 'x'), /공급가액/);
  assert.throws(() => normalizeInvoice({ kind: 'SALES', issueDate: '2026-02-01', counterparty: 'A', supplyAmount: 1, bizNumber: '123' }, undefined, 'x'), /사업자등록번호/);
});

test('editing keeps settlement state and blocks kind changes on linked invoices', () => {
  const linked = invoice({ kind: 'SALES', issueDate: '2026-05-01', supplyAmount: 100, settledAt: '2026-05-10', transactionId: 'tx' });
  const edited = normalizeInvoice({ kind: 'SALES', issueDate: '2026-05-02', counterparty: 'B', supplyAmount: 200, settledAt: null }, linked, linked.id);
  assert.equal(edited.settledAt, '2026-05-10');
  assert.equal(edited.transactionId, 'tx');
  assert.equal(edited.createdAt, linked.createdAt);
  assert.throws(() => normalizeInvoice({ kind: 'PURCHASE', issueDate: '2026-05-02', counterparty: 'B', supplyAmount: 200 }, linked, linked.id), /구분/);
});

test('VAT summary nets purchase tax and applies the preliminary notice rule', () => {
  const invoices = [
    invoice({ kind: 'SALES', issueDate: '2025-08-01', supplyAmount: 30_000_000 }), // 2025-2기 매출세액 3,000,000
    invoice({ kind: 'PURCHASE', issueDate: '2025-09-01', supplyAmount: 10_000_000 }), // 매입세액 1,000,000 → 납부 2,000,000
    invoice({ kind: 'SALES', issueDate: '2026-02-01', supplyAmount: 40_000_000 }),
    invoice({ kind: 'PURCHASE', issueDate: '2026-03-01', supplyAmount: 5_000_000, issued: false }),
  ];
  const summary = summarizeVat(invoices, vatPeriod(2026, 1));
  assert.equal(summary.salesVat, 4_000_000);
  assert.equal(summary.purchaseVat, 500_000);
  assert.equal(summary.payable, 3_500_000);
  assert.equal(summary.prelim, 1_000_000);
  assert.equal(summary.finalPayment, 2_500_000);
  assert.equal(summary.pendingCount, 1);
  assert.deepEqual(vatEventsForMonth(invoices, '2026-04').map(event => event.amount), [1_000_000]);
  assert.deepEqual(vatEventsForMonth(invoices, '2026-07').map(event => event.amount), [2_500_000]);
  assert.deepEqual(vatEventsForMonth(invoices, '2026-01').map(event => event.date), ['2026-01-25']);
  assert.deepEqual(vatEventsForMonth(invoices, '2026-05'), []);
});

test('preliminary notice is skipped below 500,000 won and refunds are not paid', () => {
  assert.equal(prelimNotice(999_998), 0);
  assert.equal(prelimNotice(1_000_000), 500_000);
  assert.equal(prelimNotice(-3_000_000), 0);
  const refund = summarizeVat([invoice({ kind: 'PURCHASE', issueDate: '2026-08-01', supplyAmount: 1_000_000 })], vatPeriod(2026, 2));
  assert.equal(refund.payable, -100_000);
  assert.equal(refund.finalPayment, 0);
});

test('invoice status, issue deadline and outstanding totals', () => {
  assert.equal(issueDeadline('2026-11-30'), '2026-12-10');
  assert.equal(issueDeadline('2026-12-03'), '2027-01-10');
  const overdue = invoice({ kind: 'SALES', issueDate: '2026-10-01', supplyAmount: 1_000_000, dueDate: '2026-10-31' });
  const open = invoice({ kind: 'SALES', issueDate: '2026-11-01', supplyAmount: 500_000, dueDate: '2026-12-15' });
  const paid = invoice({ kind: 'SALES', issueDate: '2026-09-01', supplyAmount: 700_000, settledAt: '2026-09-30' });
  assert.equal(invoiceStatus(overdue, '2026-11-09'), 'OVERDUE');
  assert.equal(invoiceStatus(open, '2026-11-09'), 'OPEN');
  assert.equal(invoiceStatus(paid, '2026-11-09'), 'SETTLED');
  assert.deepEqual(outstanding([overdue, open, paid], 'SALES', '2026-11-09'), { total: 1_650_000, overdue: 1_100_000, count: 2 });
});

test('forecast combines receivables, payables, fixed costs and VAT with a running balance', () => {
  const fixed: FixedExpenseItem = {
    id: 'rent', name: '임대료', amount: 1_000_000, category: '임차료', paymentMethod: '법인통장', cycle: 'MONTHLY', payDay: '5',
    startDate: '2026-01-01', endDate: null, isAutoPay: true, isActive: true, createdAt: '', updatedAt: '',
  };
  const invoices = [
    invoice({ kind: 'SALES', issueDate: '2026-10-01', supplyAmount: 2_000_000, dueDate: '2026-10-31' }), // 연체 → 이번 달
    invoice({ kind: 'SALES', issueDate: '2026-11-01', supplyAmount: 3_000_000, dueDate: '2026-12-10' }),
    invoice({ kind: 'PURCHASE', issueDate: '2026-11-02', supplyAmount: 1_000_000 }), // 예정일 없음 → 작성월
    invoice({ kind: 'SALES', issueDate: '2026-08-01', supplyAmount: 10_000_000, settledAt: '2026-08-20' }),
  ];
  const rows = buildForecast({ invoices, fixedExpenses: [fixed], today: '2026-11-09', months: 3, cashBalance: 5_000_000 });
  assert.deepEqual(rows.map(row => row.month), ['2026-11', '2026-12', '2027-01']);
  // 11월: 임대료 5일은 이미 지남 → 제외
  assert.equal(rows[0].fixedOut, 0);
  assert.equal(rows[0].salesIn, 2_200_000);
  assert.equal(rows[0].purchaseOut, 1_100_000);
  assert.equal(rows[0].net, 1_100_000);
  assert.equal(rows[0].balance, 6_100_000);
  assert.equal(rows[1].salesIn, 3_300_000);
  assert.equal(rows[1].fixedOut, 1_000_000);
  // 2026-2기 부가세: 매출세액 1,500,000 − 매입세액 100,000 = 1,400,000 (1/25 납부)
  assert.equal(rows[2].vatOut, 1_400_000);
  assert.equal(rows[2].net, -2_400_000);
  assert.equal(rows[2].balance, 6_100_000 + 2_300_000 - 2_400_000);
  assert.equal(buildForecast({ invoices, fixedExpenses: [], today: '2026-11-09', months: 1 })[0].balance, null);
});

test('stored company data is parsed defensively', () => {
  assert.deepEqual(parseCompanyFinance(null), { invoices: [], taxPayments: [], cashBalance: null, openDate: null });
  assert.deepEqual(parseCompanyFinance('not json'), { invoices: [], taxPayments: [], cashBalance: null, openDate: null });
  const parsed = parseCompanyFinance(JSON.stringify({ invoices: [invoice({ kind: 'SALES', issueDate: '2026-01-01', supplyAmount: 1 }), { id: 1 }], cashBalance: 1.5, openDate: '2025-01-01' }));
  assert.equal(parsed.invoices.length, 1);
  assert.equal(parsed.cashBalance, null);
  assert.equal(parsed.openDate, '2025-01-01');
  assert.deepEqual(parsed.taxPayments, []);
});

test('tax payment normalization and validation', () => {
  const payment = normalizeTaxPayment({
    paidAt: '2026-05-15',
    taxType: 'INCOME',
    amount: 3_500_000,
    period: '2025년 귀속 종합소득세',
    memo: '국세청 홈택스 납부',
  }, undefined, 'tp-1');

  assert.equal(payment.id, 'tp-1');
  assert.equal(payment.taxType, 'INCOME');
  assert.equal(payment.amount, 3_500_000);
  assert.equal(payment.period, '2025년 귀속 종합소득세');

  assert.throws(() => normalizeTaxPayment({ paidAt: 'invalid', taxType: 'INCOME', amount: 100 }, undefined, 'x'), /납부일자/);
  assert.throws(() => normalizeTaxPayment({ paidAt: '2026-05-15', taxType: 'INVALID', amount: 100 }, undefined, 'x'), /세목/);
  assert.throws(() => normalizeTaxPayment({ paidAt: '2026-05-15', taxType: 'VAT', amount: -500 }, undefined, 'x'), /납부 금액/);
});

test('predicts upcoming taxes based on past tax payment history and invoices', () => {
  const taxPayments: TaxPayment[] = [
    {
      id: 'tp-1',
      paidAt: '2025-07-24',
      taxType: 'VAT',
      amount: 4_000_000,
      period: '2025년 1기 확정',
      createdAt: '2025-07-24T00:00:00Z',
      updatedAt: '2025-07-24T00:00:00Z',
    },
    {
      id: 'tp-2',
      paidAt: '2026-01-20',
      taxType: 'VAT',
      amount: 5_000_000,
      period: '2025년 2기 확정',
      createdAt: '2026-01-20T00:00:00Z',
      updatedAt: '2026-01-20T00:00:00Z',
    },
    {
      id: 'tp-3',
      paidAt: '2025-05-28',
      taxType: 'INCOME',
      amount: 6_000_000,
      period: '2024년 귀속 종합소득세',
      createdAt: '2025-05-28T00:00:00Z',
      updatedAt: '2025-05-28T00:00:00Z',
    },
  ];

  const invoices = [
    invoice({ kind: 'SALES', issueDate: '2026-02-15', supplyAmount: 50_000_000 }), // 2026-1기 매출세액 5,000,000
    invoice({ kind: 'PURCHASE', issueDate: '2026-03-10', supplyAmount: 10_000_000 }), // 매입세액 1,000,000
  ];

  const summary = predictTaxes({ invoices, taxPayments, today: '2026-03-01' });

  // 총 납부액 및 세목별 집계
  assert.equal(summary.totalPaid, 15_000_000);
  assert.equal(summary.paidByType.VAT, 9_000_000);
  assert.equal(summary.paidByType.INCOME, 6_000_000);

  // 다가오는 첫 번째 세금: 4월 25일 1기 부가세 예정고지
  // 직전 기(2025년 2기) 실납부액 5,000,000원의 50% = 2,500,000원
  assert.ok(summary.nextTax);
  assert.equal(summary.nextTax?.dueDate, '2026-04-25');
  assert.equal(summary.nextTax?.taxType, 'VAT');
  assert.equal(summary.nextTax?.amount, 2_500_000);

  // 5월 31일 종합소득세 확정신고: 직전 납부액 6,000,000원 기준 추정
  const incomeTaxEvent = summary.upcomingEvents.find(e => e.taxType === 'INCOME' && e.dueDate === '2026-05-31');
  assert.ok(incomeTaxEvent);
  assert.equal(incomeTaxEvent?.amount, 6_000_000);

  // 11월 30일 종합소득세 중간예납: 직전 납부액 6,000,000원의 50% = 3,000,000원
  const prelimIncomeEvent = summary.upcomingEvents.find(e => e.taxType === 'INCOME' && e.dueDate === '2026-11-30');
  assert.ok(prelimIncomeEvent);
  assert.equal(prelimIncomeEvent?.amount, 3_000_000);

  // 권장 월 세금 적립금 계산 확인
  assert.ok(summary.monthlyReserveRecommendation > 0);
});
