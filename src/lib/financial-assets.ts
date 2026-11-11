export type CardType = 'CREDIT' | 'DEBIT';

export interface CreditOrDebitCard {
  id: string;
  name: string;
  company: string; // 우리카드, 현대카드, 신한카드, KB국민카드, 삼성카드, 토스, 카카오 등
  type: CardType;
  cardLast4: string;
  paymentDay: number; // 1~31
  linkedAccount?: string;
  targetSpend: number; // 전월 실적 목표치
  currentMonthSpend: number; // 당월 누적 실적
  annualFee: number;
  color: string;
  memo?: string;
  isActive: boolean;
}

export type AccountType = 'CHECKING' | 'PARKING' | 'EMERGENCY' | 'CMA' | 'SALARY' | 'OTHER';

export interface BankAccount {
  id: string;
  name: string;
  bank: string; // 우리은행, 토스뱅크, 카카오뱅크, 신한은행, 국민은행, 하나은행 등
  accountNumber: string;
  type: AccountType;
  balance: number;
  interestRate: number; // 연이율 %
  color: string;
  memo?: string;
  isActive: boolean;
}

export type SavingsType = 'FIXED_DEPOSIT' | 'SAVINGS_ACCOUNT' | 'HOUSING_SUBSCRIPTION';

export interface SavingsDeposit {
  id: string;
  name: string;
  institution: string;
  type: SavingsType;
  principal: number; // 현재 누적 납입 원금
  monthlyContribution: number; // 월 불입액 (적금)
  interestRate: number; // 약정 연이율 %
  startDate: string; // YYYY-MM-DD
  maturityDate: string; // YYYY-MM-DD
  targetAmount: number; // 만기 예상/목표 수령액
  linkedAccount?: string;
  status: 'ACTIVE' | 'MATURED' | 'CLOSED';
  memo?: string;
}

export type InvestmentAssetType =
  | 'DOMESTIC_STOCK'
  | 'OVERSEAS_STOCK'
  | 'ETF'
  | 'CRYPTO'
  | 'FUND'
  | 'BOND'
  | 'OTHER';

export interface InvestmentAsset {
  id: string;
  name: string;
  code: string; // 종목코드/티커 (005930, AAPL, 379800 등)
  assetType: InvestmentAssetType;
  broker: string; // 키움증권, 토스증권, 미래에셋, 업비트 등
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: 'KRW' | 'USD';
  memo?: string;
}

export type LiabilityType = 'MORTGAGE' | 'CREDIT' | 'MINUS' | 'STUDENT' | 'OTHER';

export interface DebtLiability {
  id: string;
  name: string;
  institution: string;
  type: LiabilityType;
  totalPrincipal: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  maturityDate: string;
  memo?: string;
}

export type RealEstateType = 'LEASE_DEPOSIT' | 'APARTMENT' | 'VILLA' | 'HOUSE' | 'LAND' | 'OTHER';

export interface RealEstateAsset {
  id: string;
  name: string;
  type: RealEstateType;
  valuation: number; // 보증금 또는 시세 평가금액
  memo?: string;
  isActive: boolean;
}

export interface FinancialData {
  cards: CreditOrDebitCard[];
  accounts: BankAccount[];
  savings: SavingsDeposit[];
  investments: InvestmentAsset[];
  liabilities: DebtLiability[];
  realEstates?: RealEstateAsset[];
  updatedAt: string;
}

export interface FinancialSummary {
  totalCash: number;
  totalSavings: number;
  totalInvestmentsValuation: number;
  totalInvestmentsCost: number;
  totalInvestmentsProfit: number;
  totalInvestmentsRoi: number;
  totalRealEstate: number;
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
  cashRatio: number;
  savingsRatio: number;
  investmentsRatio: number;
  realEstateRatio: number;
}

export const FINANCIAL_ASSETS_KEY = 'financial_assets_data';

export const DEFAULT_FINANCIAL_DATA: FinancialData = {
  cards: [
    {
      id: 'card-1',
      name: '우리 카드의정석2',
      company: '우리카드',
      type: 'CREDIT',
      cardLast4: '3481',
      paymentDay: 14,
      linkedAccount: '우리은행 급여통장',
      targetSpend: 400000,
      currentMonthSpend: 285000,
      annualFee: 15000,
      color: '#1d4ed8',
      memo: '대중교통 10%, 카페/간식 10% 청구할인 (실적 40만원 이상)',
      isActive: true,
    },
    {
      id: 'card-2',
      name: '토스뱅크 체크카드',
      company: '토스뱅크',
      type: 'DEBIT',
      cardLast4: '8910',
      paymentDay: 1,
      linkedAccount: '토스 파킹통장',
      targetSpend: 0,
      currentMonthSpend: 142000,
      annualFee: 0,
      color: '#0064FF',
      memo: '매일 즉시 캐시백, 편의점 및 카페 할인',
      isActive: true,
    },
    {
      id: 'card-3',
      name: '현대카드 M-Edition',
      company: '현대카드',
      type: 'CREDIT',
      cardLast4: '4120',
      paymentDay: 25,
      linkedAccount: '우리은행 급여통장',
      targetSpend: 500000,
      currentMonthSpend: 310000,
      annualFee: 30000,
      color: '#0f172a',
      memo: '온라인 쇼핑/구독 1.5% M포인트 무제한 적립',
      isActive: true,
    },
  ],
  accounts: [
    {
      id: 'acc-1',
      name: '급여 및 생활비 통장',
      bank: '우리은행',
      accountNumber: '1002-***-458129',
      type: 'SALARY',
      balance: 4250000,
      interestRate: 0.1,
      color: '#0284c7',
      memo: '급여 입금 및 신용카드/공과금 자동이체 계좌',
      isActive: true,
    },
    {
      id: 'acc-2',
      name: '토스 파킹통장',
      bank: '토스뱅크',
      accountNumber: '1000-***-884120',
      type: 'PARKING',
      balance: 12500000,
      interestRate: 2.0,
      color: '#2563eb',
      memo: '일복리 이자 지급, 수시 입출금 비상금',
      isActive: true,
    },
    {
      id: 'acc-3',
      name: '카카오 비상금 통장',
      bank: '카카오뱅크',
      accountNumber: '3333-***-912401',
      type: 'EMERGENCY',
      balance: 3000000,
      interestRate: 1.8,
      color: '#eab308',
      memo: '경조사 및 긴급 자금 전용',
      isActive: true,
    },
  ],
  savings: [
    {
      id: 'sav-1',
      name: '청년도약계좌 (정부기여금)',
      institution: '우리은행',
      type: 'SAVINGS_ACCOUNT',
      principal: 8400000,
      monthlyContribution: 700000,
      interestRate: 5.5,
      startDate: '2025-01-10',
      maturityDate: '2030-01-10',
      targetAmount: 50000000,
      linkedAccount: '우리은행 급여통장',
      status: 'ACTIVE',
      memo: '비과세 혜택 + 정부 매칭 기여금 지원',
    },
    {
      id: 'sav-2',
      name: '우리 첫급여 정기예금',
      institution: '우리은행',
      type: 'FIXED_DEPOSIT',
      principal: 20000000,
      monthlyContribution: 0,
      interestRate: 3.65,
      startDate: '2026-03-15',
      maturityDate: '2027-03-15',
      targetAmount: 20730000,
      status: 'ACTIVE',
      memo: '1년 만기 고정금리 정기예금',
    },
    {
      id: 'sav-3',
      name: '주택청약종합저축',
      institution: '우리은행',
      type: 'HOUSING_SUBSCRIPTION',
      principal: 6000000,
      monthlyContribution: 100000,
      interestRate: 2.8,
      startDate: '2021-05-01',
      maturityDate: '2035-05-01',
      targetAmount: 15000000,
      status: 'ACTIVE',
      memo: '연말정산 소득공제용 주택청약',
    },
  ],
  investments: [
    {
      id: 'inv-1',
      name: '삼성전자',
      code: '005930',
      assetType: 'DOMESTIC_STOCK',
      broker: '키움증권',
      quantity: 120,
      avgBuyPrice: 71000,
      currentPrice: 84500,
      currency: 'KRW',
      memo: '국내 대형 우량 반도체주',
    },
    {
      id: 'inv-2',
      name: 'TIGER 미국S&P500 ETF',
      code: '379800',
      assetType: 'ETF',
      broker: '미래에셋증권',
      quantity: 350,
      avgBuyPrice: 16500,
      currentPrice: 19800,
      currency: 'KRW',
      memo: 'ISA 계좌 절세용 미국 대표지수 ETF',
    },
    {
      id: 'inv-3',
      name: 'Apple (AAPL)',
      code: 'AAPL',
      assetType: 'OVERSEAS_STOCK',
      broker: '토스증권',
      quantity: 25,
      avgBuyPrice: 220000,
      currentPrice: 255000,
      currency: 'KRW',
      memo: '해외 테크 우량주 장기 보유',
    },
    {
      id: 'inv-4',
      name: '비트코인 (BTC)',
      code: 'BTC',
      assetType: 'CRYPTO',
      broker: '업비트',
      quantity: 0.05,
      avgBuyPrice: 85000000,
      currentPrice: 92000000,
      currency: 'KRW',
      memo: '디지털 금 분산 포트폴리오',
    },
  ],
  liabilities: [
    {
      id: 'debt-1',
      name: '버팀목 전세자금대출',
      institution: '우리은행',
      type: 'MORTGAGE',
      totalPrincipal: 80000000,
      currentBalance: 72000000,
      interestRate: 2.1,
      monthlyPayment: 126000,
      maturityDate: '2028-06-30',
      memo: '정부 저리 전세자금대출',
    },
  ],
  updatedAt: new Date().toISOString(),
};

/**
 * 자산, 부채 및 순자산 통계 계산 유틸리티
 */
export function calculateFinancialSummary(data: FinancialData): FinancialSummary {
  const activeAccounts = (data.accounts || []).filter((a) => a.isActive);
  const totalCash = activeAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const activeSavings = (data.savings || []).filter((s) => s.status === 'ACTIVE');
  const totalSavings = activeSavings.reduce((sum, s) => sum + (Number(s.principal) || 0), 0);

  let totalInvestmentsValuation = 0;
  let totalInvestmentsCost = 0;

  for (const inv of data.investments || []) {
    const qty = Number(inv.quantity) || 0;
    const curPrice = Number(inv.currentPrice) || 0;
    const buyPrice = Number(inv.avgBuyPrice) || 0;
    totalInvestmentsValuation += qty * curPrice;
    totalInvestmentsCost += qty * buyPrice;
  }

  const totalInvestmentsProfit = totalInvestmentsValuation - totalInvestmentsCost;
  const totalInvestmentsRoi =
    totalInvestmentsCost > 0
      ? Number(((totalInvestmentsProfit / totalInvestmentsCost) * 100).toFixed(2))
      : 0;

  const activeRealEstates = (data.realEstates || []).filter((r) => r.isActive !== false);
  const totalRealEstate = activeRealEstates.reduce(
    (sum, r) => sum + (Number(r.valuation) || 0),
    0
  );

  const totalAssets = totalCash + totalSavings + totalInvestmentsValuation + totalRealEstate;

  const totalDebts = (data.liabilities || []).reduce(
    (sum, d) => sum + (Number(d.currentBalance) || 0),
    0
  );

  const netWorth = totalAssets - totalDebts;

  const cashRatio = totalAssets > 0 ? Number(((totalCash / totalAssets) * 100).toFixed(1)) : 0;
  const savingsRatio =
    totalAssets > 0 ? Number(((totalSavings / totalAssets) * 100).toFixed(1)) : 0;
  const investmentsRatio =
    totalAssets > 0 ? Number(((totalInvestmentsValuation / totalAssets) * 100).toFixed(1)) : 0;
  const realEstateRatio =
    totalAssets > 0 ? Number(((totalRealEstate / totalAssets) * 100).toFixed(1)) : 0;

  return {
    totalCash,
    totalSavings,
    totalInvestmentsValuation,
    totalInvestmentsCost,
    totalInvestmentsProfit,
    totalInvestmentsRoi,
    totalRealEstate,
    totalAssets,
    totalDebts,
    netWorth,
    cashRatio,
    savingsRatio,
    investmentsRatio,
    realEstateRatio,
  };
}
