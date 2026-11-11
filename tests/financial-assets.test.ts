import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FINANCIAL_DATA,
  calculateFinancialSummary,
  FinancialData,
} from '../src/lib/financial-assets';

test('DEFAULT_FINANCIAL_DATA has complete card, account, savings, investment, and debt presets', () => {
  assert.ok(DEFAULT_FINANCIAL_DATA.cards.length >= 2, 'Should have at least 2 default cards');
  assert.ok(DEFAULT_FINANCIAL_DATA.accounts.length >= 2, 'Should have at least 2 default bank accounts');
  assert.ok(DEFAULT_FINANCIAL_DATA.savings.length >= 2, 'Should have at least 2 default savings');
  assert.ok(DEFAULT_FINANCIAL_DATA.investments.length >= 2, 'Should have at least 2 default investments');
  assert.ok(DEFAULT_FINANCIAL_DATA.liabilities.length >= 1, 'Should have at least 1 default liability');
});

test('calculateFinancialSummary correctly computes cash, savings, investments, debts and net worth', () => {
  const summary = calculateFinancialSummary(DEFAULT_FINANCIAL_DATA);

  // Accounts sum: 4,250,000 + 12,500,000 + 3,000,000 = 19,750,000
  assert.equal(summary.totalCash, 19750000);

  // Savings sum: 8,400,000 + 20,000,000 + 6,000,000 = 34,400,000
  assert.equal(summary.totalSavings, 34400000);

  // Debts sum: 72,000,000
  assert.equal(summary.totalDebts, 72000000);

  // Total Assets must equal totalCash + totalSavings + totalInvestmentsValuation
  assert.equal(
    summary.totalAssets,
    summary.totalCash + summary.totalSavings + summary.totalInvestmentsValuation
  );

  // Net worth must equal totalAssets - totalDebts
  assert.equal(summary.netWorth, summary.totalAssets - summary.totalDebts);

  // Ratios should add up to roughly 100%
  const totalRatio = summary.cashRatio + summary.savingsRatio + summary.investmentsRatio;
  assert.ok(totalRatio >= 99.5 && totalRatio <= 100.5);

  // Investment profit should equal valuation - cost
  assert.equal(
    summary.totalInvestmentsProfit,
    summary.totalInvestmentsValuation - summary.totalInvestmentsCost
  );
});

test('calculateFinancialSummary handles empty or inactive items gracefully', () => {
  const emptyData: FinancialData = {
    cards: [],
    accounts: [
      {
        id: 'acc-inactive',
        name: '휴면계좌',
        bank: '국민은행',
        accountNumber: '111-222',
        type: 'CHECKING',
        balance: 500000,
        interestRate: 0,
        color: '#888',
        isActive: false, // inactive account
      },
    ],
    savings: [
      {
        id: 'sav-closed',
        name: '해지적금',
        institution: '신한은행',
        type: 'SAVINGS_ACCOUNT',
        principal: 1000000,
        monthlyContribution: 100000,
        interestRate: 3,
        startDate: '2024-01-01',
        maturityDate: '2025-01-01',
        targetAmount: 1200000,
        status: 'CLOSED', // closed
      },
    ],
    investments: [],
    liabilities: [],
    updatedAt: new Date().toISOString(),
  };

  const summary = calculateFinancialSummary(emptyData);

  assert.equal(summary.totalCash, 0); // inactive excluded
  assert.equal(summary.totalSavings, 0); // closed excluded
  assert.equal(summary.totalInvestmentsValuation, 0);
  assert.equal(summary.totalInvestmentsProfit, 0);
  assert.equal(summary.totalInvestmentsRoi, 0);
  assert.equal(summary.totalAssets, 0);
  assert.equal(summary.totalDebts, 0);
  assert.equal(summary.netWorth, 0);
});

test('calculateFinancialSummary correctly incorporates real estate assets', () => {
  const dataWithRE: FinancialData = {
    ...DEFAULT_FINANCIAL_DATA,
    realEstates: [
      {
        id: 're-1',
        name: '에코1단지 전세금',
        type: 'LEASE_DEPOSIT',
        valuation: 312550000,
        isActive: true,
      },
      {
        id: 're-inactive',
        name: '매각완료 토지',
        type: 'LAND',
        valuation: 50000000,
        isActive: false,
      },
    ],
  };

  const summary = calculateFinancialSummary(dataWithRE);
  assert.equal(summary.totalRealEstate, 312550000);
  assert.equal(
    summary.totalAssets,
    summary.totalCash + summary.totalSavings + summary.totalInvestmentsValuation + 312550000
  );
  assert.ok(summary.realEstateRatio > 0);
});
