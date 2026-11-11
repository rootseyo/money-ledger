import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { dataScope } from '@/lib/data-scope';
import { withLedgerScope } from '@/lib/ledger-scope';
import { FIXED_EXPENSES_SETTING_KEY, type FixedExpenseItem } from '@/lib/fixed-expenses';
import { kstDate } from '@/lib/fixed-expense-schedule';
import {
  COMPANY_FINANCE_KEY, CompanyLedgerError, MAX_AMOUNT, MAX_INVOICES, MAX_TAX_PAYMENTS, TAX_TYPE_NAMES,
  invoiceTotal, normalizeInvoice, normalizeTaxPayment, parseCompanyFinance, validDate,
  type CompanyFinanceData, type TaxPayment,
} from '@/lib/company-ledger';

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const ID_RE = /^[0-9a-f-]{36}$/i;

async function companyWorkspace() {
  const scope = dataScope.getStore();
  if (!scope?.householdId) throw new CompanyLedgerError('회사 회계형 가계부에서 사용할 수 있습니다.');
  const setting = await prisma.systemSetting.findUnique({ where: { key: `household:${scope.householdId}` } });
  const household = setting ? JSON.parse(setting.value) : null;
  if (household?.type !== 'COMPANY') throw new CompanyLedgerError('회사 회계형 가계부에서 사용할 수 있습니다.');
  return { scope, key: `${scope.householdId}:${COMPANY_FINANCE_KEY}` };
}

async function get() {
  try {
    const { scope, key } = await companyWorkspace();
    const [setting, fixed] = await Promise.all([
      prisma.systemSetting.findUnique({ where: { key } }),
      prisma.systemSetting.findUnique({ where: { key: FIXED_EXPENSES_SETTING_KEY } }),
    ]);
    let fixedExpenses: FixedExpenseItem[] = [];
    try {
      const parsed = fixed?.value ? JSON.parse(fixed.value) : [];
      if (Array.isArray(parsed)) fixedExpenses = parsed.filter((item: FixedExpenseItem) => item?.isActive);
    } catch {}
    const data = parseCompanyFinance(setting?.value);
    data.invoices.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.createdAt.localeCompare(a.createdAt));
    data.taxPayments.sort((a, b) => b.paidAt.localeCompare(a.paidAt) || b.createdAt.localeCompare(a.createdAt));
    return json({ ...data, fixedExpenses, today: kstDate(), canEdit: scope.householdRole !== 'VIEWER' });
  } catch (error) {
    if (error instanceof CompanyLedgerError) return json({ error: error.message }, error.status);
    console.error('Company finance GET failed', error);
    return json({ error: '회사 회계 정보를 불러오지 못했습니다.' }, 500);
  }
}

/** 낙관적 잠금: 읽은 값이 그대로일 때만 저장해 동시 수정으로 인한 유실을 막는다. */
async function mutate<T>(key: string, change: (data: CompanyFinanceData, db: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) {
  return prisma.$transaction(async db => {
    const setting = await db.systemSetting.findUnique({ where: { key } });
    const data = parseCompanyFinance(setting?.value);
    const result = await change(data, db);
    const value = JSON.stringify(data);
    if (!setting) {
      await db.systemSetting.create({ data: { key, value, category: 'HOUSEHOLD', description: '회사 회계: 세금계산서·잔액' } });
    } else {
      const updated = await db.systemSetting.updateMany({ where: { key, value: setting.value }, data: { value } });
      if (!updated.count) throw new CompanyLedgerError('다른 구성원이 먼저 수정했습니다. 새로고침한 뒤 다시 시도해 주세요.', 409);
    }
    return result;
  });
}

function findInvoice(data: CompanyFinanceData, id: unknown) {
  const invoice = typeof id === 'string' ? data.invoices.find(item => item.id === id) : undefined;
  if (!invoice) throw new CompanyLedgerError('세금계산서를 찾을 수 없습니다.', 404);
  return invoice;
}

async function post(request: NextRequest) {
  try {
    const { key } = await companyWorkspace();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) throw new CompanyLedgerError('요청을 확인해 주세요.');

    if (body.action === 'save-invoice') {
      const input = (body.invoice && typeof body.invoice === 'object' ? body.invoice : {}) as Record<string, unknown>;
      const invoice = await mutate(key, async data => {
        const id = typeof input.id === 'string' && ID_RE.test(input.id) ? input.id : randomUUID();
        const index = data.invoices.findIndex(item => item.id === id);
        if (index < 0 && data.invoices.length >= MAX_INVOICES) throw new CompanyLedgerError(`세금계산서는 최대 ${MAX_INVOICES.toLocaleString()}건까지 보관할 수 있습니다.`);
        const next = normalizeInvoice(input, index >= 0 ? data.invoices[index] : undefined, id);
        if (index >= 0) data.invoices[index] = next; else data.invoices.push(next);
        return next;
      });
      return json({ success: true, invoice });
    }

    if (body.action === 'delete-invoice') {
      await mutate(key, async (data, db) => {
        const invoice = findInvoice(data, body.id);
        if (invoice.transactionId) await db.cardTransaction.deleteMany({ where: { id: invoice.transactionId } });
        data.invoices = data.invoices.filter(item => item.id !== invoice.id);
      });
      return json({ success: true });
    }

    if (body.action === 'settle') {
      if (!validDate(body.date)) throw new CompanyLedgerError('입금·지급일을 확인해 주세요.');
      const date = body.date;
      const invoice = await mutate(key, async (data, db) => {
        const invoice = findInvoice(data, body.id);
        if (invoice.settledAt) throw new CompanyLedgerError('이미 처리된 세금계산서입니다.', 409);
        if (body.record !== false) {
          const sales = invoice.kind === 'SALES';
          const transaction = await db.cardTransaction.create({ data: {
            sourceApp: 'MANUAL',
            type: sales ? 'DEPOSIT' : 'PAYMENT',
            amount: invoiceTotal(invoice),
            merchant: invoice.counterparty,
            category: sales ? '매출' : '매입',
            title: `${invoice.counterparty} ${sales ? '매출 입금' : '매입 지급'}`,
            content: [invoice.item, `세금계산서 ${invoice.issueDate} · 공급가액 ${invoice.supplyAmount.toLocaleString()}원 · 세액 ${invoice.vat.toLocaleString()}원`].filter(Boolean).join(' · '),
            notifiedAt: new Date(`${date}T12:00:00+09:00`),
            rawData: { manual: true, taxInvoiceId: invoice.id },
          } });
          invoice.transactionId = transaction.id;
        }
        invoice.settledAt = date;
        invoice.updatedAt = new Date().toISOString();
        return invoice;
      });
      return json({ success: true, invoice });
    }

    if (body.action === 'unsettle') {
      const invoice = await mutate(key, async (data, db) => {
        const invoice = findInvoice(data, body.id);
        if (invoice.transactionId) await db.cardTransaction.deleteMany({ where: { id: invoice.transactionId } });
        invoice.settledAt = null;
        invoice.transactionId = null;
        invoice.updatedAt = new Date().toISOString();
        return invoice;
      });
      return json({ success: true, invoice });
    }

    if (body.action === 'set-cash-balance') {
      const raw = body.cashBalance;
      const cashBalance = raw === null || raw === '' ? null : Number(raw);
      if (cashBalance !== null && (!Number.isSafeInteger(cashBalance) || Math.abs(cashBalance) > MAX_AMOUNT)) throw new CompanyLedgerError('잔액을 확인해 주세요.');
      await mutate(key, async data => { data.cashBalance = cashBalance; });
      return json({ success: true, cashBalance });
    }

    if (body.action === 'set-open-date') {
      const raw = body.openDate;
      const openDate = raw === null || raw === '' ? null : String(raw);
      if (openDate !== null && !validDate(openDate)) throw new CompanyLedgerError('개업일자를 확인해 주세요.');
      await mutate(key, async data => { data.openDate = openDate; });
      return json({ success: true, openDate });
    }

    if (body.action === 'save-tax-payment') {
      const input = (body.taxPayment && typeof body.taxPayment === 'object' ? body.taxPayment : {}) as Record<string, unknown>;
      const record = body.record === true;
      const payment = await mutate(key, async (data, db) => {
        const id = typeof input.id === 'string' && ID_RE.test(input.id) ? input.id : randomUUID();
        const index = data.taxPayments.findIndex(item => item.id === id);
        if (index < 0 && data.taxPayments.length >= MAX_TAX_PAYMENTS) {
          throw new CompanyLedgerError(`세금 납부 내역은 최대 ${MAX_TAX_PAYMENTS.toLocaleString()}건까지 보관할 수 있습니다.`);
        }
        const existing = index >= 0 ? data.taxPayments[index] : undefined;
        const next = normalizeTaxPayment(input, existing, id);

        if (record && !next.transactionId) {
          const typeName = TAX_TYPE_NAMES[next.taxType] || '세금';
          const transaction = await db.cardTransaction.create({
            data: {
              sourceApp: 'MANUAL',
              type: 'PAYMENT',
              amount: next.amount,
              merchant: next.taxOffice || '국세청 홈택스',
              category: '세금·공과금',
              title: `${typeName} 납부`,
              content: [next.period, next.memo].filter(Boolean).join(' · '),
              notifiedAt: new Date(`${next.paidAt}T12:00:00+09:00`),
              rawData: { manual: true, taxPaymentId: next.id },
            },
          });
          next.transactionId = transaction.id;
        } else if (existing?.transactionId) {
          const typeName = TAX_TYPE_NAMES[next.taxType] || '세금';
          await db.cardTransaction.update({
            where: { id: existing.transactionId },
            data: {
              amount: next.amount,
              merchant: next.taxOffice || '국세청 홈택스',
              title: `${typeName} 납부`,
              content: [next.period, next.memo].filter(Boolean).join(' · '),
              notifiedAt: new Date(`${next.paidAt}T12:00:00+09:00`),
            },
          });
        }

        if (index >= 0) data.taxPayments[index] = next;
        else data.taxPayments.push(next);
        return next;
      });
      return json({ success: true, taxPayment: payment });
    }

    if (body.action === 'delete-tax-payment') {
      await mutate(key, async (data, db) => {
        const payment = typeof body.id === 'string' ? data.taxPayments.find(item => item.id === body.id) : undefined;
        if (!payment) throw new CompanyLedgerError('세금 납부 내역을 찾을 수 없습니다.', 404);
        if (payment.transactionId) {
          await db.cardTransaction.deleteMany({ where: { id: payment.transactionId } });
        }
        data.taxPayments = data.taxPayments.filter(item => item.id !== payment.id);
      });
      return json({ success: true });
    }

    throw new CompanyLedgerError('지원하지 않는 요청입니다.');
  } catch (error) {
    if (error instanceof CompanyLedgerError) return json({ error: error.message }, error.status);
    console.error('Company finance POST failed', error);
    return json({ error: '회사 회계 정보를 저장하지 못했습니다.' }, 500);
  }
}

export const GET = withLedgerScope(get);
export const POST = withLedgerScope(post);
