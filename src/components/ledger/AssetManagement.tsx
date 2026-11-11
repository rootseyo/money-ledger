'use client';

import { useCardFilterCookie } from '@/hooks/use-card-filter-cookie';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard,
  Wallet,
  Landmark,
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Coins,
  ShieldCheck,
  Calendar,
  Layers,
  ChevronRight,
  ArrowUpRight,
  Building2,
  Percent,
  SlidersHorizontal,
  Search,
  Filter,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  FinancialData,
  FinancialSummary,
  CreditOrDebitCard,
  BankAccount,
  SavingsDeposit,
  InvestmentAsset,
  DebtLiability,
  RealEstateAsset,
  DEFAULT_FINANCIAL_DATA,
  calculateFinancialSummary,
} from '@/lib/financial-assets';

type SubTab =
  | 'overview'
  | 'realEstates'
  | 'savings'
  | 'accounts'
  | 'investments'
  | 'cards'
  | 'liabilities';

const PIE_COLORS = ['#7dd3fc', '#fda4af', '#6ee7b7', '#fde047', '#c4b5fd', '#fdba74'];

export default function AssetManagement() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [financialData, setFinancialData] = useState<FinancialData>(DEFAULT_FINANCIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 모달 상태
  const [realEstateModalOpen, setRealEstateModalOpen] = useState(false);
  const [editingRealEstate, setEditingRealEstate] = useState<RealEstateAsset | null>(null);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditOrDebitCard | null>(null);

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  const [savingsModalOpen, setSavingsModalOpen] = useState(false);
  const [editingSavings, setEditingSavings] = useState<SavingsDeposit | null>(null);

  const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<InvestmentAsset | null>(null);

  const [liabilityModalOpen, setLiabilityModalOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<DebtLiability | null>(null);

  // 뷰 모드 상태 (기본 목록형)
  const [cardViewMode, setCardViewMode] = useState<'plate' | 'list'>('list');
  const [accountViewMode, setAccountViewMode] = useState<'list' | 'card'>('list');
  const [savingsViewMode, setSavingsViewMode] = useState<'list' | 'card'>('list');

  // 🔍 자산, 카드, 통장 각 탭별 필터 상태
  const [realEstateFilter, setRealEstateFilter] = useCardFilterCookie('card-history-asset-realEstate-filters', { query: '', type: 'ALL' });
  const [cardFilter, setCardFilter] = useCardFilterCookie('card-history-asset-card-filters', { query: '', type: 'ALL', company: 'ALL' });
  const [accountFilter, setAccountFilter] = useCardFilterCookie('card-history-asset-account-filters', { query: '', type: 'ALL', bank: 'ALL' });
  const [savingsFilter, setSavingsFilter] = useCardFilterCookie('card-history-asset-savings-filters', { query: '', type: 'ALL', status: 'ALL', institution: 'ALL' });
  const [investmentFilter, setInvestmentFilter] = useCardFilterCookie('card-history-asset-investment-filters', { query: '', assetType: 'ALL', broker: 'ALL' });
  const [liabilityFilter, setLiabilityFilter] = useCardFilterCookie('card-history-asset-liability-filters', { query: '', type: 'ALL' });

  // 고유 옵션 목록
  const cardCompanies = useMemo(() => {
    return Array.from(new Set(financialData.cards.map((c) => c.company).filter(Boolean)));
  }, [financialData.cards]);

  const accountBanks = useMemo(() => {
    return Array.from(new Set(financialData.accounts.map((a) => a.bank).filter(Boolean)));
  }, [financialData.accounts]);

  const savingsInstitutions = useMemo(() => {
    return Array.from(new Set(financialData.savings.map((s) => s.institution).filter(Boolean)));
  }, [financialData.savings]);

  const investmentBrokers = useMemo(() => {
    return Array.from(new Set(financialData.investments.map((i) => i.broker).filter(Boolean)));
  }, [financialData.investments]);

  // 필터링된 데이터 목록
  const filteredRealEstates = useMemo(() => {
    return (financialData.realEstates || []).filter((re) => {
      if (realEstateFilter.type !== 'ALL' && re.type !== realEstateFilter.type) return false;
      if (realEstateFilter.query) {
        const q = realEstateFilter.query.toLowerCase().trim();
        const matchName = re.name?.toLowerCase().includes(q);
        const matchMemo = re.memo?.toLowerCase().includes(q);
        return matchName || matchMemo;
      }
      return true;
    });
  }, [financialData.realEstates, realEstateFilter]);

  const filteredCards = useMemo(() => {
    return financialData.cards.filter((card) => {
      if (cardFilter.type !== 'ALL' && card.type !== cardFilter.type) return false;
      if (cardFilter.company !== 'ALL' && card.company !== cardFilter.company) return false;
      if (cardFilter.query) {
        const q = cardFilter.query.toLowerCase().trim();
        const matchName = card.name?.toLowerCase().includes(q);
        const matchCompany = card.company?.toLowerCase().includes(q);
        const matchLast4 = card.cardLast4?.includes(q);
        const matchMemo = card.memo?.toLowerCase().includes(q);
        return matchName || matchCompany || matchLast4 || matchMemo;
      }
      return true;
    });
  }, [financialData.cards, cardFilter]);

  const filteredAccounts = useMemo(() => {
    return financialData.accounts.filter((acc) => {
      if (accountFilter.type !== 'ALL' && acc.type !== accountFilter.type) return false;
      if (accountFilter.bank !== 'ALL' && acc.bank !== accountFilter.bank) return false;
      if (accountFilter.query) {
        const q = accountFilter.query.toLowerCase().trim();
        const matchName = acc.name?.toLowerCase().includes(q);
        const matchBank = acc.bank?.toLowerCase().includes(q);
        const matchNumber = acc.accountNumber?.includes(q);
        const matchMemo = acc.memo?.toLowerCase().includes(q);
        return matchName || matchBank || matchNumber || matchMemo;
      }
      return true;
    });
  }, [financialData.accounts, accountFilter]);

  const filteredSavings = useMemo(() => {
    return financialData.savings.filter((sav) => {
      if (savingsFilter.type !== 'ALL' && sav.type !== savingsFilter.type) return false;
      if (savingsFilter.status !== 'ALL' && sav.status !== savingsFilter.status) return false;
      if (savingsFilter.institution !== 'ALL' && sav.institution !== savingsFilter.institution) return false;
      if (savingsFilter.query) {
        const q = savingsFilter.query.toLowerCase().trim();
        const matchName = sav.name?.toLowerCase().includes(q);
        const matchInst = sav.institution?.toLowerCase().includes(q);
        const matchMemo = sav.memo?.toLowerCase().includes(q);
        return matchName || matchInst || matchMemo;
      }
      return true;
    });
  }, [financialData.savings, savingsFilter]);

  const filteredInvestments = useMemo(() => {
    return financialData.investments.filter((inv) => {
      if (investmentFilter.assetType !== 'ALL' && inv.assetType !== investmentFilter.assetType) return false;
      if (investmentFilter.broker !== 'ALL' && inv.broker !== investmentFilter.broker) return false;
      if (investmentFilter.query) {
        const q = investmentFilter.query.toLowerCase().trim();
        const matchName = inv.name?.toLowerCase().includes(q);
        const matchCode = inv.code?.toLowerCase().includes(q);
        const matchBroker = inv.broker?.toLowerCase().includes(q);
        const matchMemo = inv.memo?.toLowerCase().includes(q);
        return matchName || matchCode || matchBroker || matchMemo;
      }
      return true;
    });
  }, [financialData.investments, investmentFilter]);

  const filteredLiabilities = useMemo(() => {
    return financialData.liabilities.filter((liab) => {
      if (liabilityFilter.type !== 'ALL' && liab.type !== liabilityFilter.type) return false;
      if (liabilityFilter.query) {
        const q = liabilityFilter.query.toLowerCase().trim();
        const matchName = liab.name?.toLowerCase().includes(q);
        const matchInst = liab.institution?.toLowerCase().includes(q);
        const matchMemo = liab.memo?.toLowerCase().includes(q);
        return matchName || matchInst || matchMemo;
      }
      return true;
    });
  }, [financialData.liabilities, liabilityFilter]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // 데이터 로드
  const fetchFinancialData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/financial-assets');
      if (!res.ok) throw new Error('자산 데이터 로드 실패');
      const json = await res.json();
      if (json.data) {
        setFinancialData(json.data);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', '자산 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  // 서버 저장
  const saveToServer = async (newData: FinancialData) => {
    setSaving(true);
    try {
      const res = await fetch('/api/financial-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData),
      });
      if (!res.ok) throw new Error('자산 데이터 저장 실패');
      const json = await res.json();
      setFinancialData(json.data);
      showToast('success', '자산 및 금융 계좌 정보가 저장되었습니다.');
    } catch (err: any) {
      console.error(err);
      showToast('error', '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 실시간 요약 계산
  const summary: FinancialSummary = useMemo(() => {
    return calculateFinancialSummary(financialData);
  }, [financialData]);

  // 자산 포트폴리오 파이 차트 데이터
  const pieData = useMemo(() => {
    const list = [
      { name: '부동산/보증금', value: summary.totalRealEstate, color: '#ec4899' },
      { name: '예적금/청약', value: summary.totalSavings, color: 'var(--success)' },
      { name: '주식/투자', value: summary.totalInvestmentsValuation, color: 'var(--warning)' },
      { name: '현금/통장', value: summary.totalCash, color: '#3b82f6' },
    ].filter((item) => item.value > 0);

    return list.length > 0 ? list : [{ name: '자산 없음', value: 1, color: 'var(--text-muted)' }];
  }, [summary]);

  // ---------------------------------------------------------------------------
  // 부동산/보증금 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveRealEstate = (re: RealEstateAsset) => {
    let updatedList = [...(financialData.realEstates || [])];
    const idx = updatedList.findIndex((item) => item.id === re.id);
    if (idx >= 0) {
      updatedList[idx] = re;
    } else {
      updatedList.push(re);
    }
    const updated = { ...financialData, realEstates: updatedList };
    setFinancialData(updated);
    saveToServer(updated);
    setRealEstateModalOpen(false);
  };

  const handleDeleteRealEstate = (id: string) => {
    if (!confirm('이 부동산/보증금 항목을 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      realEstates: (financialData.realEstates || []).filter((r) => r.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  // ---------------------------------------------------------------------------
  // 카드 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveCard = (card: CreditOrDebitCard) => {
    let updatedCards = [...financialData.cards];
    const idx = updatedCards.findIndex((c) => c.id === card.id);
    if (idx >= 0) {
      updatedCards[idx] = card;
    } else {
      updatedCards.push(card);
    }
    const updated = { ...financialData, cards: updatedCards };
    setFinancialData(updated);
    saveToServer(updated);
    setCardModalOpen(false);
  };

  const handleDeleteCard = (id: string) => {
    if (!confirm('이 카드를 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      cards: financialData.cards.filter((c) => c.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  // ---------------------------------------------------------------------------
  // 통장 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveAccount = (account: BankAccount) => {
    let updatedAccounts = [...financialData.accounts];
    const idx = updatedAccounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
      updatedAccounts[idx] = account;
    } else {
      updatedAccounts.push(account);
    }
    const updated = { ...financialData, accounts: updatedAccounts };
    setFinancialData(updated);
    saveToServer(updated);
    setAccountModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (!confirm('이 통장/계좌를 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      accounts: financialData.accounts.filter((a) => a.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  // ---------------------------------------------------------------------------
  // 예적금 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveSavings = (savings: SavingsDeposit) => {
    let updatedList = [...financialData.savings];
    const idx = updatedList.findIndex((s) => s.id === savings.id);
    if (idx >= 0) {
      updatedList[idx] = savings;
    } else {
      updatedList.push(savings);
    }
    const updated = { ...financialData, savings: updatedList };
    setFinancialData(updated);
    saveToServer(updated);
    setSavingsModalOpen(false);
  };

  const handleDeleteSavings = (id: string) => {
    if (!confirm('이 예적금 상품을 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      savings: financialData.savings.filter((s) => s.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  // ---------------------------------------------------------------------------
  // 주식/투자 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveInvestment = (inv: InvestmentAsset) => {
    let updatedList = [...financialData.investments];
    const idx = updatedList.findIndex((i) => i.id === inv.id);
    if (idx >= 0) {
      updatedList[idx] = inv;
    } else {
      updatedList.push(inv);
    }
    const updated = { ...financialData, investments: updatedList };
    setFinancialData(updated);
    saveToServer(updated);
    setInvestmentModalOpen(false);
  };

  const handleDeleteInvestment = (id: string) => {
    if (!confirm('이 투자 종목을 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      investments: financialData.investments.filter((i) => i.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  // ---------------------------------------------------------------------------
  // 대출/부채 관리 액션
  // ---------------------------------------------------------------------------
  const handleSaveLiability = (liab: DebtLiability) => {
    let updatedList = [...financialData.liabilities];
    const idx = updatedList.findIndex((l) => l.id === liab.id);
    if (idx >= 0) {
      updatedList[idx] = liab;
    } else {
      updatedList.push(liab);
    }
    const updated = { ...financialData, liabilities: updatedList };
    setFinancialData(updated);
    saveToServer(updated);
    setLiabilityModalOpen(false);
  };

  const handleDeleteLiability = (id: string) => {
    if (!confirm('이 대출/부채 항목을 삭제하시겠습니까?')) return;
    const updated = {
      ...financialData,
      liabilities: financialData.liabilities.filter((l) => l.id !== id),
    };
    setFinancialData(updated);
    saveToServer(updated);
  };

  return (
    <div className="asset-management-private" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Toast Notification */}
      {/* ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '10px',
            background: toast.type === 'success' ? '#065f46' : '#991b1b',
            color: 'var(--text-main)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* KPI Overview Summary Bar */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
          gap: '12px',
        }}
      >
        {/* 순자산 카드 */}
        <div
          data-ledger-tour="assets-summary" className="glass-panel asset-kpi-card asset-kpi-card--net-worth"
          style={{
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>💎 순자산 (Net Worth)</span>
            <ShieldCheck size={16} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            ₩{summary.netWorth.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            총 자산 ₩{summary.totalAssets.toLocaleString()} - 부채 ₩{summary.totalDebts.toLocaleString()}
          </div>
        </div>

        {/* 부동산/보증금 카드 */}
        <div
          className="glass-panel asset-kpi-card asset-kpi-card--real-estate"
          style={{
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>🏠 부동산 / 보증금</span>
            <Building2 size={16} />
          </div>
          <div className="asset-kpi-value" style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '4px' }}>
            ₩{summary.totalRealEstate.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            비중 {summary.realEstateRatio}% · {financialData.realEstates?.length || 0}건 등록
          </div>
        </div>

        {/* 예적금/청약 카드 */}
        <div
          className="glass-panel asset-kpi-card asset-kpi-card--savings"
          style={{
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>💰 예적금 / 청약</span>
            <PiggyBank size={16} />
          </div>
          <div className="asset-kpi-value" style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '4px' }}>
            ₩{summary.totalSavings.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            비중 {summary.savingsRatio}% · 정기예금/청약 {financialData.savings.length}건
          </div>
        </div>

        {/* 총 부채 카드 */}
        <div
          className="glass-panel asset-kpi-card asset-kpi-card--debt"
          style={{
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>📉 총 부채 (Liabilities)</span>
            <TrendingDown size={16} />
          </div>
          <div className="asset-kpi-value" style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '4px' }}>
            ₩{summary.totalDebts.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            전세대출 및 신용대출 등 {financialData.liabilities.length}건
          </div>
        </div>

        {/* 투자 손익/수익률 카드 */}
        <div
          className="glass-panel asset-kpi-card asset-kpi-card--investment"
          style={{
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>📈 주식·투자 평가</span>
            <TrendingUp size={16} />
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: 'var(--asset-card-accent)',
              marginTop: '4px',
            }}
          >
            ₩{summary.totalInvestmentsValuation.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            비중 {summary.investmentsRatio}% · {financialData.investments.length}개 종목
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Sub Tabs Navigation */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid var(--surface-border)',
          paddingBottom: '6px',
        }}
      >
        <div data-ledger-tour="asset-types" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'overview', label: '자산 종합 요약', icon: <Layers size={14} /> },
            { id: 'realEstates', label: `부동산/보증금 (${financialData.realEstates?.length || 0})`, icon: <Building2 size={14} /> },
            { id: 'savings', label: `예적금/청약 (${financialData.savings.length})`, icon: <PiggyBank size={14} /> },
            { id: 'accounts', label: `통장/계좌 (${financialData.accounts.length})`, icon: <Landmark size={14} /> },
            { id: 'investments', label: `주식·투자 (${financialData.investments.length})`, icon: <TrendingUp size={14} /> },
            { id: 'cards', label: `카드 관리 (${financialData.cards.length})`, icon: <CreditCard size={14} /> },
          ].map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as SubTab)}
                className="btn"
                style={{
                  padding: '6px 11px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--text-main)' : 'var(--text-muted)',
                  background: active ? 'var(--expense-bg)' : 'var(--ledger-subtle)',
                  borderColor: active ? 'var(--expense-color)' : 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {tab.icon} <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={fetchFinancialData}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
            title="새로고침"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새로고침</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
          {/* 자산 배분 비중 파이 차트 */}
          <div className="glass-panel" style={{ padding: '14px 18px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={15} color="#3b82f6" /> 자산 포트폴리오 배분 현황
            </h4>
            <div style={{ height: '180px', width: '100%', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) => `₩${Number(val).toLocaleString()}원`}
                    contentStyle={{ background: 'var(--surface-color)', borderColor: 'var(--surface-border)', color: 'var(--text-main)', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 자산</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  ₩{(summary.totalAssets / 10000).toFixed(0)}만
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
              {pieData.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color }} />
                  <span style={{ color: 'var(--text-main)' }}>{item.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₩{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 주요 금융 항목 퀵 요약 */}
          <div className="glass-panel" style={{ padding: '22px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={17} color="#10b981" /> 금융 자산 구성 요약
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 통장/현금 */}
              <div
                onClick={() => setSubTab('accounts')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--ledger-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--ledger-control-bg)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#3b82f620', padding: '8px', borderRadius: '8px', color: "var(--ledger-info)" }}>
                    <Landmark size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>입출금 및 파킹통장</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 {financialData.accounts.length}개 활성 계좌</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ledger-info)' }}>
                    ₩{summary.totalCash.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>비중 {summary.cashRatio}%</div>
                </div>
              </div>

              {/* 예적금 */}
              <div
                onClick={() => setSubTab('savings')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--ledger-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--ledger-control-bg)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#10b98120', padding: '8px', borderRadius: '8px', color: 'var(--success)' }}>
                    <PiggyBank size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>예금 및 적금 납입원금</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 {financialData.savings.length}개 상품 진행중</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--success)' }}>
                    ₩{summary.totalSavings.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>비중 {summary.savingsRatio}%</div>
                </div>
              </div>

              {/* 주식/투자 */}
              <div
                onClick={() => setSubTab('investments')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--ledger-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--ledger-control-bg)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#f59e0b20', padding: '8px', borderRadius: '8px', color: 'var(--warning)' }}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>주식/ETF/투자 평가액</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 {financialData.investments.length}개 보유 종목</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--warning)' }}>
                    ₩{summary.totalInvestmentsValuation.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: summary.totalInvestmentsProfit >= 0 ? "var(--success)" : "var(--danger)" }}>
                    손익 {summary.totalInvestmentsProfit >= 0 ? '+' : ''}₩{summary.totalInvestmentsProfit.toLocaleString()} ({summary.totalInvestmentsRoi}%)
                  </div>
                </div>
              </div>

              {/* 부동산/보증금 바로가기 */}
              <div
                onClick={() => setSubTab('realEstates')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--ledger-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--ledger-control-bg)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#ec489920', padding: '8px', borderRadius: '8px', color: "var(--ledger-accent)" }}>
                    <Building2 size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>부동산 / 임차보증금</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {financialData.realEstates?.length || 0}건 · 비유동자산
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f472b6' }}>
                    ₩{summary.totalRealEstate.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    비중 {summary.realEstateRatio}%
                  </div>
                </div>
              </div>

              {/* 카드 관리 바로가기 */}
              <div
                onClick={() => setSubTab('cards')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--ledger-subtle)',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--ledger-control-bg)',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#8b5cf620', padding: '8px', borderRadius: '8px', color: "var(--ledger-accent)" }}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>보유 카드 및 실적 현황</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{financialData.cards.length}개 카드 등록됨</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--ledger-accent)', fontSize: '0.82rem' }}>
                  관리하기 <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1-1. REAL ESTATE MANAGEMENT TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'realEstates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                🏠 부동산 / 임차보증금 관리 ({financialData.realEstates?.length || 0})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                총 평가액: <b style={{ color: '#f472b6' }}>₩{summary.totalRealEstate.toLocaleString()}원</b> (전세보증금, 자가 주택, 부동산 등 비유동자산)
              </p>
            </div>

            <button
              onClick={() => {
                setEditingRealEstate(null);
                setRealEstateModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Plus size={16} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>부동산/보증금 등록</span>
            </button>
          </div>

          {/* 부동산/보증금 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="부동산명, 메모 검색..."
                value={realEstateFilter.query}
                onChange={(e) => setRealEstateFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={realEstateFilter.type}
              onChange={(e) => setRealEstateFilter((prev) => ({ ...prev, type: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '130px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">전체 유형</option>
              <option value="LEASE_DEPOSIT">전세보증금</option>
              <option value="APARTMENT">아파트</option>
              <option value="VILLA">빌라</option>
              <option value="HOUSE">주택</option>
              <option value="LAND">토지</option>
              <option value="OTHER">기타</option>
            </select>

            {(realEstateFilter.query || realEstateFilter.type !== 'ALL') && (
              <button
                onClick={() => setRealEstateFilter({ query: '', type: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredRealEstates.length}건 / 전체 {(financialData.realEstates || []).length}건
            </span>
          </div>

          {filteredRealEstates.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 부동산/보증금 항목이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '14px' }}>
              {filteredRealEstates.map((re) => (
              <div
                key={re.id}
                className="glass-panel"
                style={{
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: '4px solid #ec4899',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: 'rgba(236, 72, 153, 0.15)',
                          color: '#f472b6',
                          fontWeight: 700,
                        }}
                      >
                        {re.type === 'LEASE_DEPOSIT' ? '전세보증금' : re.type === 'APARTMENT' ? '아파트' : re.type === 'VILLA' ? '빌라' : re.type === 'HOUSE' ? '주택' : '기타 부동산'}
                      </span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                        {re.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setEditingRealEstate(re);
                          setRealEstateModalOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="수정"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteRealEstate(re.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {re.memo && (
                    <div style={{ marginTop: '10px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {re.memo}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>보증금/평가금액</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f472b6' }}>
                      ₩{re.valuation.toLocaleString()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: re.isActive ? 'var(--success)' : "var(--text-muted)",
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: re.isActive ? '#10b981' : '#64748b',
                      }}
                    />
                    {re.isActive ? '정상 반영' : '미반영'}
                  </span>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. CARDS MANAGEMENT TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'cards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                💳 내 카드 관리 ({financialData.cards.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                신용/체크카드 결제일, 전월 실적 기준금액 및 당월 이용액을 한눈에 파악합니다.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setCardViewMode('list')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: cardViewMode === 'list' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: cardViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: cardViewMode === 'list' ? 700 : 500,
                  }}
                >
                  목록형
                </button>
                <button
                  onClick={() => setCardViewMode('plate')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: cardViewMode === 'plate' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: cardViewMode === 'plate' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: cardViewMode === 'plate' ? 700 : 500,
                  }}
                >
                  플레이트형
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingCard(null);
                  setCardModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새 카드 등록</span>
              </button>
            </div>
          </div>

          {/* 카드 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="카드명, 카드사, 뒷자리, 메모 검색..."
                value={cardFilter.query}
                onChange={(e) => setCardFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={cardFilter.type}
              onChange={(e) => setCardFilter((prev) => ({ ...prev, type: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">카드 종류 전체</option>
              <option value="CREDIT">신용카드</option>
              <option value="DEBIT">체크카드</option>
            </select>

            <select
              value={cardFilter.company}
              onChange={(e) => setCardFilter((prev) => ({ ...prev, company: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">카드사 전체</option>
              {cardCompanies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {(cardFilter.query || cardFilter.type !== 'ALL' || cardFilter.company !== 'ALL') && (
              <button
                onClick={() => setCardFilter({ query: '', type: 'ALL', company: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredCards.length}건 / 전체 {financialData.cards.length}건
            </span>
          </div>

          {filteredCards.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 카드가 없습니다.</p>
            </div>
          )}

          {/* 플레이트 뷰 */}
          {cardViewMode === 'plate' && filteredCards.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))',
                gap: '16px',
              }}
            >
              {filteredCards.map((card) => {
                const target = card.targetSpend || 0;
                const current = card.currentMonthSpend || 0;
                const ratio = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;

                return (
                  <div
                    key={card.id}
                    style={{
                      borderRadius: '16px',
                      padding: '20px',
                      background: `linear-gradient(135deg, ${card.color || '#1e3a8a'}, #0f172a)`,
                      border: '1px solid var(--ledger-control-hover)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '190px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: card.type === 'CREDIT' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                            color: card.type === 'CREDIT' ? '#93c5fd' : '#86efac',
                            border: '1px solid var(--ledger-control-bg)',
                          }}
                        >
                          {card.type === 'CREDIT' ? '신용카드' : '체크카드'} · {card.company}
                        </span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px' }}>
                          {card.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--ledger-control-hover)', letterSpacing: '1px' }}>
                          **** **** **** {card.cardLast4 || '0000'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setEditingCard(card);
                            setCardModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--ledger-control-hover)', cursor: 'pointer', padding: '4px' }}
                          title="수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', color: 'var(--text-main)' }}>
                        <span>당월 실적: ₩{current.toLocaleString()}원</span>
                        <span>{target > 0 ? `목표 ₩${target.toLocaleString()} (${ratio}%)` : '실적 무관'}</span>
                      </div>
                      {target > 0 && (
                        <div style={{ width: '100%', height: '6px', background: 'var(--ledger-control-hover)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${ratio}%`,
                              height: '100%',
                              background: ratio >= 100 ? '#10b981' : '#38bdf8',
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.72rem', color: 'var(--ledger-control-hover)' }}>
                        <span>결제일: 매월 {card.paymentDay}일</span>
                        {card.linkedAccount && <span>결제계좌: {card.linkedAccount}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 테이블 뷰 */}
          {cardViewMode === 'list' && (
            <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="ledger-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>카드명</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>구분/카드사</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>카드번호</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>결제일</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>당월 이용액</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>목표 실적</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>연결 결제계좌</th>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '130px', minWidth: '120px', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map((card) => (
                    <tr key={card.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td className="ledger-cell ledger-cell--start" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: card.color || '#3b82f6', marginRight: '8px', flexShrink: 0 }} />
                        {card.name}
                      </td>
                      <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {card.type === 'CREDIT' ? '신용' : '체크'} · {card.company}
                      </td>
                      <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        **** {card.cardLast4}
                      </td>
                      <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--ledger-info)', whiteSpace: 'nowrap' }}>
                        매월 {card.paymentDay}일
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        ₩{(card.currentMonthSpend || 0).toLocaleString()}
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {card.targetSpend ? `₩${card.targetSpend.toLocaleString()}` : '-'}
                      </td>
                      <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {card.linkedAccount || '-'}
                      </td>
                      <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap', width: '130px', minWidth: '120px' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button
                            onClick={() => {
                              setEditingCard(card);
                              setCardModalOpen(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: "12px", whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit2 size={12} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>수정</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="btn"
                            style={{ padding: '5px 8px', fontSize: "12px", background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
                            title="삭제"
                          >
                            <Trash2 size={12} style={{ flexShrink: 0 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ACCOUNTS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                🏦 내 통장 / 계좌 관리 ({financialData.accounts.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                총 잔액: <b style={{ color: 'var(--ledger-info)' }}>₩{summary.totalCash.toLocaleString()}원</b> (수시입출금, 파킹, 급여통장 등)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setAccountViewMode('list')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: accountViewMode === 'list' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: accountViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: accountViewMode === 'list' ? 700 : 500,
                  }}
                >
                  목록형
                </button>
                <button
                  onClick={() => setAccountViewMode('card')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: accountViewMode === 'card' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: accountViewMode === 'card' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: accountViewMode === 'card' ? 700 : 500,
                  }}
                >
                  카드형
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingAccount(null);
                  setAccountModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새 계좌 등록</span>
              </button>
            </div>
          </div>

          {/* 통장/계좌 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="통장/계좌명, 은행, 계좌번호, 메모 검색..."
                value={accountFilter.query}
                onChange={(e) => setAccountFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={accountFilter.type}
              onChange={(e) => setAccountFilter((prev) => ({ ...prev, type: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">계좌 종류 전체</option>
              <option value="CHECKING">수시입출금</option>
              <option value="PARKING">파킹통장</option>
              <option value="SALARY">급여통장</option>
              <option value="EMERGENCY">비상금</option>
              <option value="CMA">CMA</option>
              <option value="OTHER">기타</option>
            </select>

            <select
              value={accountFilter.bank}
              onChange={(e) => setAccountFilter((prev) => ({ ...prev, bank: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">은행 전체</option>
              {accountBanks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {(accountFilter.query || accountFilter.type !== 'ALL' || accountFilter.bank !== 'ALL') && (
              <button
                onClick={() => setAccountFilter({ query: '', type: 'ALL', bank: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredAccounts.length}건 / 전체 {financialData.accounts.length}건
            </span>
          </div>

          {filteredAccounts.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 계좌가 없습니다.</p>
            </div>
          )}

          {/* 목록형 뷰 */}
          {accountViewMode === 'list' && (
            <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="ledger-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '50px', whiteSpace: 'nowrap' }}>No.</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>은행 / 계좌명</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>구분</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>계좌번호</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>연 금리</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>현재 잔액</th>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '130px', minWidth: '120px', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc, idx) => {
                    const typeLabel =
                      acc.type === 'CHECKING'
                        ? '입출금'
                        : acc.type === 'PARKING'
                        ? '파킹통장'
                        : acc.type === 'SALARY'
                        ? '급여통장'
                        : acc.type === 'CMA'
                        ? 'CMA'
                        : acc.type === 'EMERGENCY'
                        ? '비상금'
                        : '기타';

                    return (
                      <tr key={acc.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s ease' }}>
                        <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-dark)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="ledger-cell ledger-cell--start" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: acc.color || '#0284c7', flexShrink: 0 }} />
                            <span>{acc.name}</span>
                            <span style={{ fontSize: "12px", color: 'var(--text-muted)', fontWeight: 500 }}>({acc.bank})</span>
                          </div>
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: "12px",
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: 'var(--ledger-control-bg)',
                              color: 'var(--text-main)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {acc.accountNumber}
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--warning)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {acc.interestRate > 0 ? `${acc.interestRate}%` : '-'}
                        </td>
                        <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 800, color: 'var(--ledger-info)', whiteSpace: 'nowrap' }}>
                          ₩{acc.balance.toLocaleString()}
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap', width: '130px', minWidth: '120px' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <button
                              onClick={() => {
                                setEditingAccount(acc);
                                setAccountModalOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: "12px", whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={12} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>수정</span>
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(acc.id)}
                              className="btn"
                              style={{ padding: '5px 8px', fontSize: "12px", background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
                              title="삭제"
                            >
                              <Trash2 size={12} style={{ flexShrink: 0 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 카드형 뷰 */}
          {accountViewMode === 'card' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 310px), 1fr))', gap: '16px' }}>
              {financialData.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="glass-panel"
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderLeft: `4px solid ${acc.color || '#0284c7'}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            background: 'var(--ledger-control-bg)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          {acc.bank} · {acc.type}
                        </span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                          {acc.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {acc.accountNumber}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => {
                            setEditingAccount(acc);
                            setAccountModalOpen(true);
                          }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          title="수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>연 금리</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--warning)' }}>
                        {acc.interestRate}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>현재 잔액</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ledger-info)' }}>
                        ₩{acc.balance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. SAVINGS & DEPOSITS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'savings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                💰 예금 · 적금 · 청약 관리 ({financialData.savings.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                누적 납입 원금: <b style={{ color: 'var(--success)' }}>₩{summary.totalSavings.toLocaleString()}원</b> (정기예금, 자유적금, 청약통장)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setSavingsViewMode('list')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: savingsViewMode === 'list' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: savingsViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: savingsViewMode === 'list' ? 700 : 500,
                  }}
                >
                  목록형
                </button>
                <button
                  onClick={() => setSavingsViewMode('card')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.74rem',
                    background: savingsViewMode === 'card' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: savingsViewMode === 'card' ? 'var(--text-main)' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontWeight: savingsViewMode === 'card' ? 700 : 500,
                  }}
                >
                  카드형
                </button>
              </div>

              <button
                onClick={() => {
                  setEditingSavings(null);
                  setSavingsModalOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새 예적금 등록</span>
              </button>
            </div>
          </div>

          {/* 예적금/청약 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="상품명, 금융기관, 메모 검색..."
                value={savingsFilter.query}
                onChange={(e) => setSavingsFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={savingsFilter.type}
              onChange={(e) => setSavingsFilter((prev) => ({ ...prev, type: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">상품 종류 전체</option>
              <option value="FIXED_DEPOSIT">정기예금</option>
              <option value="SAVINGS_ACCOUNT">자유/정기적금</option>
              <option value="HOUSING_SUBSCRIPTION">주택청약</option>
            </select>

            <select
              value={savingsFilter.status}
              onChange={(e) => setSavingsFilter((prev) => ({ ...prev, status: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '100px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">상태 전체</option>
              <option value="ACTIVE">진행중</option>
              <option value="MATURED">만기</option>
              <option value="CLOSED">해지</option>
            </select>

            <select
              value={savingsFilter.institution}
              onChange={(e) => setSavingsFilter((prev) => ({ ...prev, institution: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '110px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">기관 전체</option>
              {savingsInstitutions.map((inst) => (
                <option key={inst} value={inst}>{inst}</option>
              ))}
            </select>

            {(savingsFilter.query || savingsFilter.type !== 'ALL' || savingsFilter.status !== 'ALL' || savingsFilter.institution !== 'ALL') && (
              <button
                onClick={() => setSavingsFilter({ query: '', type: 'ALL', status: 'ALL', institution: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredSavings.length}건 / 전체 {financialData.savings.length}건
            </span>
          </div>

          {filteredSavings.length === 0 && (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 예적금 상품이 없습니다.</p>
            </div>
          )}

          {/* 목록형 뷰 */}
          {savingsViewMode === 'list' && (
            <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
              <table className="ledger-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '50px', whiteSpace: 'nowrap' }}>No.</th>
                    <th className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>금융기관 / 상품명</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>구분</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>가입기간</th>
                    <th className="ledger-cell ledger-cell--center" style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>만기 D-Day & 진행률</th>
                    <th className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>약정 금리</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>월 납입액</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>납입 원금</th>
                    <th className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>만기 목표액</th>
                    <th className="ledger-cell ledger-cell--center" style={{ width: '130px', minWidth: '120px', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSavings.map((sav, idx) => {
                    const start = new Date(sav.startDate).getTime();
                    const end = new Date(sav.maturityDate).getTime();
                    const now = Date.now();
                    const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
                    const passedDays = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24)));
                    const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)));
                    const dDay = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

                    const typeLabel =
                      sav.type === 'FIXED_DEPOSIT'
                        ? '정기예금'
                        : sav.type === 'SAVINGS_ACCOUNT'
                        ? '자유/정기적금'
                        : sav.type === 'HOUSING_SUBSCRIPTION'
                        ? '주택청약'
                        : '기타';

                    return (
                      <tr key={sav.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.15s ease' }}>
                        <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-dark)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="ledger-cell ledger-cell--start" style={{ fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                            <span>{sav.name}</span>
                            <span style={{ fontSize: "12px", color: 'var(--text-muted)', fontWeight: 500 }}>({sav.institution})</span>
                          </div>
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: "12px",
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: '#10b98120',
                              color: 'var(--success)',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {sav.startDate} ~ {sav.maturityDate}
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '100px' }}>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: dDay > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: dDay > 0 ? "var(--ledger-info)" : "var(--success)",
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {dDay > 0 ? `D-${dDay}` : '만기완료'} ({progress}%)
                            </span>
                            <div style={{ width: '100%', height: '5px', background: 'var(--ledger-control-bg)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${progress}%`,
                                  height: '100%',
                                  background: progress >= 100 ? '#10b981' : '#3b82f6',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--warning)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {sav.interestRate}%
                        </td>
                        <td className="ledger-cell ledger-cell--end" style={{ color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          {sav.monthlyContribution > 0 ? `₩${sav.monthlyContribution.toLocaleString()}` : '-'}
                        </td>
                        <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 800, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                          ₩{sav.principal.toLocaleString()}
                        </td>
                        <td className="ledger-cell ledger-cell--end" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {sav.targetAmount > 0 ? `₩${sav.targetAmount.toLocaleString()}` : '-'}
                        </td>
                        <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap', width: '130px', minWidth: '120px' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                            <button
                              onClick={() => {
                                setEditingSavings(sav);
                                setSavingsModalOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: "12px", whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={12} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>수정</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSavings(sav.id)}
                              className="btn"
                              style={{ padding: '5px 8px', fontSize: "12px", background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
                              title="삭제"
                            >
                              <Trash2 size={12} style={{ flexShrink: 0 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 카드형 뷰 */}
          {savingsViewMode === 'card' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '16px' }}>
              {filteredSavings.map((sav) => {
                const start = new Date(sav.startDate).getTime();
                const end = new Date(sav.maturityDate).getTime();
                const now = Date.now();
                const totalDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
                const passedDays = Math.max(0, Math.round((now - start) / (1000 * 60 * 60 * 24)));
                const progress = Math.min(100, Math.max(0, Math.round((passedDays / totalDays) * 100)));
                const dDay = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

                return (
                  <div
                    key={sav.id}
                    className="glass-panel"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderLeft: '4px solid #10b981',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              background: '#10b98120',
                              color: 'var(--success)',
                              fontWeight: 700,
                            }}
                          >
                            {sav.institution} · {sav.type}
                          </span>
                          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                            {sav.name}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: dDay > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: dDay > 0 ? "var(--ledger-info)" : "var(--success)",
                            }}
                          >
                            {dDay > 0 ? `D-${dDay}` : '만기완료'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingSavings(sav);
                              setSavingsModalOpen(true);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            title="수정"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteSavings(sav.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                            title="삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        <span>가입: {sav.startDate}</span>
                        <span>만기: {sav.maturityDate}</span>
                      </div>

                      {/* 진행도 게이지 바 */}
                      <div style={{ width: '100%', height: '6px', background: 'var(--ledger-control-bg)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: progress >= 100 ? '#10b981' : '#3b82f6',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--surface-border)' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>약정 금리</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>
                          {sav.interestRate}%
                        </div>
                        {sav.monthlyContribution > 0 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            월 ₩{sav.monthlyContribution.toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>납입 원금</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                          ₩{sav.principal.toLocaleString()}
                        </div>
                        {sav.targetAmount > 0 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            만기목표 ₩{sav.targetAmount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. INVESTMENTS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'investments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                📈 주식 · ETF · 코인 투자 포트폴리오 ({financialData.investments.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                총 평가액: <b style={{ color: 'var(--warning)' }}>₩{summary.totalInvestmentsValuation.toLocaleString()}원</b> ·
                손익: <b style={{ color: summary.totalInvestmentsProfit >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {summary.totalInvestmentsProfit >= 0 ? '+' : ''}₩{summary.totalInvestmentsProfit.toLocaleString()} ({summary.totalInvestmentsRoi}%)
                </b>
              </p>
            </div>

            <button
              onClick={() => {
                setEditingInvestment(null);
                setInvestmentModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새 종목 추가</span>
            </button>
          </div>

          {/* 주식/투자 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="종목명, 티커, 증권사/거래소, 메모 검색..."
                value={investmentFilter.query}
                onChange={(e) => setInvestmentFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={investmentFilter.assetType}
              onChange={(e) => setInvestmentFilter((prev) => ({ ...prev, assetType: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">자산군 전체</option>
              <option value="DOMESTIC_STOCK">국내주식</option>
              <option value="OVERSEAS_STOCK">해외주식</option>
              <option value="ETF">ETF</option>
              <option value="CRYPTO">가상자산(코인)</option>
              <option value="FUND">펀드</option>
              <option value="BOND">채권</option>
              <option value="OTHER">기타</option>
            </select>

            <select
              value={investmentFilter.broker}
              onChange={(e) => setInvestmentFilter((prev) => ({ ...prev, broker: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '120px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">증권사/거래소 전체</option>
              {investmentBrokers.map((br) => (
                <option key={br} value={br}>{br}</option>
              ))}
            </select>

            {(investmentFilter.query || investmentFilter.assetType !== 'ALL' || investmentFilter.broker !== 'ALL') && (
              <button
                onClick={() => setInvestmentFilter({ query: '', assetType: 'ALL', broker: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredInvestments.length}건 / 전체 {financialData.investments.length}건
            </span>
          </div>

          {filteredInvestments.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 투자 종목이 없습니다.</p>
            </div>
          ) : (
            <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="ledger-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                  <th className="ledger-cell ledger-cell--start">종목명 / 티커</th>
                  <th className="ledger-cell ledger-cell--start">자산 구분</th>
                  <th className="ledger-cell ledger-cell--start">증권사/거래소</th>
                  <th className="ledger-cell ledger-cell--end">보유수량</th>
                  <th className="ledger-cell ledger-cell--end">매수평균가</th>
                  <th className="ledger-cell ledger-cell--end">현재가</th>
                  <th className="ledger-cell ledger-cell--end">총 평가금액</th>
                  <th className="ledger-cell ledger-cell--end">평가손익 (수익률)</th>
                  <th className="ledger-cell ledger-cell--center">관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestments.map((inv) => {
                  const qty = Number(inv.quantity) || 0;
                  const buyPrice = Number(inv.avgBuyPrice) || 0;
                  const curPrice = Number(inv.currentPrice) || 0;
                  const cost = qty * buyPrice;
                  const val = qty * curPrice;
                  const profit = val - cost;
                  const roi = cost > 0 ? Number(((profit / cost) * 100).toFixed(2)) : 0;

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td className="ledger-cell ledger-cell--start">
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{inv.name}</div>
                        <div style={{ fontSize: "12px", color: 'var(--text-muted)' }}>{inv.code}</div>
                      </td>
                      <td className="ledger-cell ledger-cell--start">
                        <span
                          style={{
                            fontSize: "12px",
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--ledger-control-bg)',
                            color: 'var(--text-main)',
                          }}
                        >
                          {inv.assetType}
                        </span>
                      </td>
                      <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)' }}>
                        {inv.broker || '-'}
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {qty.toLocaleString()}
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ color: 'var(--text-muted)' }}>
                        ₩{buyPrice.toLocaleString()}
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 600, color: 'var(--ledger-info)' }}>
                        ₩{curPrice.toLocaleString()}
                      </td>
                      <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        ₩{Math.round(val).toLocaleString()}
                      </td>
                      <td className="ledger-cell ledger-cell--end">
                        <div style={{ fontWeight: 700, color: profit >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {profit >= 0 ? '+' : ''}₩{Math.round(profit).toLocaleString()}
                        </div>
                        <div style={{ fontSize: "12px", color: roi >= 0 ? "var(--success)" : "var(--danger)" }}>
                          {roi >= 0 ? '+' : ''}{roi}%
                        </div>
                      </td>
                      <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap', width: '130px', minWidth: '120px' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button
                            onClick={() => {
                              setEditingInvestment(inv);
                              setInvestmentModalOpen(true);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: "12px", whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit2 size={12} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>수정</span>
                          </button>
                          <button
                            onClick={() => handleDeleteInvestment(inv.id)}
                            className="btn"
                            style={{ padding: '5px 8px', fontSize: "12px", background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}
                            title="삭제"
                          >
                            <Trash2 size={12} style={{ flexShrink: 0 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. LIABILITIES TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {subTab === 'liabilities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                📉 대출 · 부채 관리 ({financialData.liabilities.length})
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                총 부채 잔액: <b style={{ color: 'var(--danger)' }}>₩{summary.totalDebts.toLocaleString()}원</b> (순자산 산출 시 자산에서 차감됩니다)
              </p>
            </div>

            <button
              onClick={() => {
                setEditingLiability(null);
                setLiabilityModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <Plus size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'nowrap' }}>새 부채/대출 등록</span>
            </button>
          </div>

          {/* 대출/부채 필터 바 */}
          <div
            className="glass-panel"
            style={{
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              background: 'var(--ledger-subtle)',
            }}
          >
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="대출명, 금융기관, 메모 검색..."
                value={liabilityFilter.query}
                onChange={(e) => setLiabilityFilter((prev) => ({ ...prev, query: e.target.value }))}
                className="input"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <select
              value={liabilityFilter.type}
              onChange={(e) => setLiabilityFilter((prev) => ({ ...prev, type: e.target.value }))}
              className="input"
              style={{ width: 'auto', minWidth: '130px', fontSize: '0.8rem', height: '34px' }}
            >
              <option value="ALL">대출 종류 전체</option>
              <option value="MORTGAGE">주택담보대출</option>
              <option value="CREDIT">신용대출</option>
              <option value="MINUS">마이너스통장</option>
              <option value="STUDENT">학자금대출</option>
              <option value="OTHER">기타대출</option>
            </select>

            {(liabilityFilter.query || liabilityFilter.type !== 'ALL') && (
              <button
                onClick={() => setLiabilityFilter({ query: '', type: 'ALL' })}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.74rem', height: '34px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <X size={13} /> 초기화
              </button>
            )}

            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredLiabilities.length}건 / 전체 {financialData.liabilities.length}건
            </span>
          </div>

          {filteredLiabilities.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>검색 및 필터 조건에 부합하는 부채/대출 항목이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '16px' }}>
              {filteredLiabilities.map((liab) => (
              <div
                key={liab.id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderLeft: '4px solid #ef4444',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: 'var(--danger)',
                          fontWeight: 700,
                        }}
                      >
                        {liab.institution} · {liab.type}
                      </span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '6px' }}>
                        {liab.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setEditingLiability(liab);
                          setLiabilityModalOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="수정"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteLiability(liab.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <span>대출원금: ₩{liab.totalPrincipal.toLocaleString()}</span>
                    <span>만기일: {liab.maturityDate || '-'}</span>
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--surface-border)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>대출 금리</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>
                      {liab.interestRate}%
                    </div>
                    {liab.monthlyPayment > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        월 상환 ₩{liab.monthlyPayment.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>남은 잔여 부채</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>
                      ₩{liab.currentBalance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 부동산/보증금 추가/수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {realEstateModalOpen && (
        <RealEstateFormModal
          realEstate={editingRealEstate}
          onClose={() => setRealEstateModalOpen(false)}
          onSave={handleSaveRealEstate}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 카드 추가/수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {cardModalOpen && (
        <CardFormModal
          card={editingCard}
          accounts={financialData.accounts}
          onClose={() => setCardModalOpen(false)}
          onSave={handleSaveCard}
        />
      )}

      {/* 계좌 추가/수정 모달 */}
      {accountModalOpen && (
        <AccountFormModal
          account={editingAccount}
          onClose={() => setAccountModalOpen(false)}
          onSave={handleSaveAccount}
        />
      )}

      {/* 예적금 추가/수정 모달 */}
      {savingsModalOpen && (
        <SavingsFormModal
          savings={editingSavings}
          accounts={financialData.accounts}
          onClose={() => setSavingsModalOpen(false)}
          onSave={handleSaveSavings}
        />
      )}

      {/* 주식/투자 추가/수정 모달 */}
      {investmentModalOpen && (
        <InvestmentFormModal
          investment={editingInvestment}
          onClose={() => setInvestmentModalOpen(false)}
          onSave={handleSaveInvestment}
        />
      )}

      {/* 부채 추가/수정 모달 */}
      {liabilityModalOpen && (
        <LiabilityFormModal
          liability={editingLiability}
          onClose={() => setLiabilityModalOpen(false)}
          onSave={handleSaveLiability}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. 카드 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function CardFormModal({
  card,
  accounts,
  onClose,
  onSave,
}: {
  card: CreditOrDebitCard | null;
  accounts: BankAccount[];
  onClose: () => void;
  onSave: (c: CreditOrDebitCard) => void;
}) {
  const [form, setForm] = useState<CreditOrDebitCard>(
    card || {
      id: `card-${Date.now()}`,
      name: '',
      company: '우리카드',
      type: 'CREDIT',
      cardLast4: '',
      paymentDay: 14,
      linkedAccount: accounts[0]?.name || '',
      targetSpend: 300000,
      currentMonthSpend: 0,
      annualFee: 0,
      color: '#1d4ed8',
      memo: '',
      isActive: true,
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {card ? '카드 정보 수정' : '새 카드 등록'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>카드 이름</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 우리 카드의정석2"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>카드사</label>
              <select
                className="input"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                {['우리카드', '신한카드', '현대카드', 'KB국민카드', '삼성카드', '롯데카드', '하나카드', '토스뱅크', '카카오뱅크', '기타'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>카드 구분</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="CREDIT">신용카드</option>
                <option value="DEBIT">체크카드</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>카드 뒷자리 4자리</label>
              <input
                type="text"
                maxLength={4}
                className="input"
                value={form.cardLast4}
                onChange={(e) => setForm({ ...form, cardLast4: e.target.value })}
                placeholder="예: 3481"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>결제일 (매월 몇일)</label>
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={form.paymentDay}
                onChange={(e) => setForm({ ...form, paymentDay: Number(e.target.value) || 1 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>목표 실적 (원)</label>
              <input
                type="number"
                className="input"
                value={form.targetSpend}
                onChange={(e) => setForm({ ...form, targetSpend: Number(e.target.value) || 0 })}
                placeholder="예: 300000"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>당월 이용액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.currentMonthSpend}
                onChange={(e) => setForm({ ...form, currentMonthSpend: Number(e.target.value) || 0 })}
                placeholder="예: 250000"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>연결 결제계좌</label>
            <input
              type="text"
              className="input"
              value={form.linkedAccount || ''}
              onChange={(e) => setForm({ ...form, linkedAccount: e.target.value })}
              placeholder="예: 우리은행 급여통장"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>카드 색상</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {['#1d4ed8', '#0064FF', '#0f172a', '#10b981', '#f59e0b', '#dc2626', '#7c3aed'].map((col) => (
                <span
                  key={col}
                  onClick={() => setForm({ ...form, color: col })}
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: col,
                    cursor: 'pointer',
                    border: form.color === col ? '2px solid #fff' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>혜택 메모</label>
            <input
              type="text"
              className="input"
              value={form.memo || ''}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 대중교통 10%, 카페 10% 청구할인"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('카드 이름을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 통장/계좌 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function AccountFormModal({
  account,
  onClose,
  onSave,
}: {
  account: BankAccount | null;
  onClose: () => void;
  onSave: (a: BankAccount) => void;
}) {
  const [form, setForm] = useState<BankAccount>(
    account || {
      id: `acc-${Date.now()}`,
      name: '',
      bank: '우리은행',
      accountNumber: '',
      type: 'CHECKING',
      balance: 1000000,
      interestRate: 0.1,
      color: 'var(--ledger-info)',
      memo: '',
      isActive: true,
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '460px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {account ? '통장/계좌 수정' : '새 통장/계좌 등록'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>통장 별칭/이름</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 급여 및 생활비 통장"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>은행명</label>
              <select
                className="input"
                value={form.bank}
                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                {['우리은행', '토스뱅크', '카카오뱅크', '신한은행', '국민은행', '하나은행', '기업은행', '농협은행', 'SC제일은행', '증권사(CMA)', '기타'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>계좌 종류</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="CHECKING">입출금통장</option>
                <option value="PARKING">파킹통장</option>
                <option value="SALARY">급여통장</option>
                <option value="EMERGENCY">비상금통장</option>
                <option value="CMA">CMA통장</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>계좌번호 (선택)</label>
            <input
              type="text"
              className="input"
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              placeholder="예: 1002-***-458129"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>현재 잔액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>금리 (연 %)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) || 0 })}
                placeholder="예: 2.0"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>메모</label>
            <input
              type="text"
              className="input"
              value={form.memo || ''}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 매월 25일 급여 입금"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('통장 이름을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. 예적금 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function SavingsFormModal({
  savings,
  accounts,
  onClose,
  onSave,
}: {
  savings: SavingsDeposit | null;
  accounts: BankAccount[];
  onClose: () => void;
  onSave: (s: SavingsDeposit) => void;
}) {
  const [form, setForm] = useState<SavingsDeposit>(
    savings || {
      id: `sav-${Date.now()}`,
      name: '',
      institution: '우리은행',
      type: 'SAVINGS_ACCOUNT',
      principal: 2000000,
      monthlyContribution: 500000,
      interestRate: 4.5,
      startDate: new Date().toISOString().slice(0, 10),
      maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      targetAmount: 6000000,
      linkedAccount: accounts[0]?.name || '',
      status: 'ACTIVE',
      memo: '',
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {savings ? '예적금 상품 수정' : '새 예적금 등록'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>상품명</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 청년도약계좌, 우리 첫급여 정기예금"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>금융기관</label>
              <input
                type="text"
                className="input"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="예: 우리은행"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>상품 유형</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="FIXED_DEPOSIT">정기예금</option>
                <option value="SAVINGS_ACCOUNT">정기/자유적금</option>
                <option value="HOUSING_SUBSCRIPTION">주택청약</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>누적 납입 원금 (원)</label>
              <input
                type="number"
                className="input"
                value={form.principal}
                onChange={(e) => setForm({ ...form, principal: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>월 불입액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.monthlyContribution}
                onChange={(e) => setForm({ ...form, monthlyContribution: Number(e.target.value) || 0 })}
                placeholder="예: 700000"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>약정 금리 (연 %)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) || 0 })}
                placeholder="예: 4.5"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>만기 목표/예상액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>가입일</label>
              <input
                type="date"
                className="input"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>만기일</label>
              <input
                type="date"
                className="input"
                value={form.maturityDate}
                onChange={(e) => setForm({ ...form, maturityDate: e.target.value })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('상품명을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 주식/투자 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function InvestmentFormModal({
  investment,
  onClose,
  onSave,
}: {
  investment: InvestmentAsset | null;
  onClose: () => void;
  onSave: (i: InvestmentAsset) => void;
}) {
  const [form, setForm] = useState<InvestmentAsset>(
    investment || {
      id: `inv-${Date.now()}`,
      name: '',
      code: '',
      assetType: 'DOMESTIC_STOCK',
      broker: '키움증권',
      quantity: 10,
      avgBuyPrice: 50000,
      currentPrice: 50000,
      currency: 'KRW',
      memo: '',
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {investment ? '투자 종목 수정' : '새 투자 종목 추가'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>종목명/자산명</label>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 삼성전자, Apple"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>티커/코드</label>
              <input
                type="text"
                className="input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="005930, AAPL"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>자산 구분</label>
              <select
                className="input"
                value={form.assetType}
                onChange={(e) => setForm({ ...form, assetType: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="DOMESTIC_STOCK">국내주식</option>
                <option value="OVERSEAS_STOCK">해외주식</option>
                <option value="ETF">ETF</option>
                <option value="CRYPTO">코인/가상자산</option>
                <option value="FUND">펀드</option>
                <option value="BOND">채권</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>증권사/거래소</label>
              <input
                type="text"
                className="input"
                value={form.broker}
                onChange={(e) => setForm({ ...form, broker: e.target.value })}
                placeholder="예: 토스증권, 키움"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>보유 수량</label>
              <input
                type="number"
                step="any"
                className="input"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>매수평균가 (원)</label>
              <input
                type="number"
                className="input"
                value={form.avgBuyPrice}
                onChange={(e) => setForm({ ...form, avgBuyPrice: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>현재가 (원)</label>
              <input
                type="number"
                className="input"
                value={form.currentPrice}
                onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>투자 메모</label>
            <input
              type="text"
              className="input"
              value={form.memo || ''}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: ISA 계좌 장기 분할매수"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('종목명을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 대출/부채 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function LiabilityFormModal({
  liability,
  onClose,
  onSave,
}: {
  liability: DebtLiability | null;
  onClose: () => void;
  onSave: (l: DebtLiability) => void;
}) {
  const [form, setForm] = useState<DebtLiability>(
    liability || {
      id: `debt-${Date.now()}`,
      name: '',
      institution: '우리은행',
      type: 'MORTGAGE',
      totalPrincipal: 50000000,
      currentBalance: 45000000,
      interestRate: 2.5,
      monthlyPayment: 200000,
      maturityDate: '2028-12-31',
      memo: '',
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {liability ? '대출/부채 항목 수정' : '새 대출/부채 등록'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>대출/부채명</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 버팀목 전세자금대출, 마이너스통장"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>대출 기관</label>
              <input
                type="text"
                className="input"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="예: 우리은행"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>대출 종류</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="MORTGAGE">전세/주택담보대출</option>
                <option value="CREDIT">신용대출</option>
                <option value="MINUS">마이너스통장</option>
                <option value="STUDENT">학자금대출</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>대출 약정액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.totalPrincipal}
                onChange={(e) => setForm({ ...form, totalPrincipal: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>현재 잔여액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: Number(e.target.value) || 0 })}
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>금리 (연 %)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: Number(e.target.value) || 0 })}
                placeholder="예: 2.5"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>월 상환액 (원)</label>
              <input
                type="number"
                className="input"
                value={form.monthlyPayment}
                onChange={(e) => setForm({ ...form, monthlyPayment: Number(e.target.value) || 0 })}
                placeholder="예: 150000"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('대출명을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 부동산/보증금 폼 모달 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────
function RealEstateFormModal({
  realEstate,
  onClose,
  onSave,
}: {
  realEstate: RealEstateAsset | null;
  onClose: () => void;
  onSave: (re: RealEstateAsset) => void;
}) {
  const [form, setForm] = useState<RealEstateAsset>(
    realEstate || {
      id: `re-${Date.now()}`,
      name: '',
      type: 'LEASE_DEPOSIT',
      valuation: 0,
      memo: '',
      isActive: true,
    }
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '20px',
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 800 }}>
          {realEstate ? '부동산/보증금 항목 수정' : '새 부동산/보증금 등록'}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>자산명 / 부동산명</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 에코1단지 102동 1502호 전세금, 마포 아파트"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>부동산 자산 종류</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="LEASE_DEPOSIT">전세보증금</option>
                <option value="APARTMENT">아파트</option>
                <option value="VILLA">빌라 / 연립</option>
                <option value="HOUSE">단독주택</option>
                <option value="LAND">토지</option>
                <option value="OTHER">기타</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>보증금 또는 시세 (원)</label>
              <input
                type="number"
                className="input"
                value={form.valuation}
                onChange={(e) => setForm({ ...form, valuation: Number(e.target.value) || 0 })}
                placeholder="예: 312550000"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>메모</label>
            <input
              type="text"
              className="input"
              value={form.memo || ''}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              placeholder="예: 비유동 전세보증금 (만기 2028년)"
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <input
              type="checkbox"
              id="reIsActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#ec4899', cursor: 'pointer' }}
            />
            <label htmlFor="reIsActive" style={{ fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer' }}>
              자산 평가 및 순자산 총액에 정상 반영
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return alert('부동산/자산명을 입력해주세요.');
              onSave(form);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
