'use client';

import { useCardFilterFields } from '@/hooks/use-card-filter-cookie';
import MoneyValue from './MoneyValue';
import { useCardListOrder } from '@/hooks/use-card-list-order';
import { ListDragHandle, ListOrderStatus } from './ListOrderControls';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Repeat,
  ShieldCheck,
  CreditCard,
  Tag,
  DollarSign,
  Layers,
  History,
  Info,
  UploadCloud,
} from 'lucide-react';
import {
  FixedExpenseItem,
  FixedExpenseWithStats,
  FixedExpenseCycle,
  formatPayDayLabel,
  formatCycleLabel,
  calculateMonthlyNormalizedAmount,
} from '@/lib/fixed-expenses';
import {
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  resolveCategoryInfo,
} from '@/lib/household-categories';
import BulkFixedExpenseModal from './BulkFixedExpenseModal';

interface FixedExpensesManagementProps {
  categories?: HouseholdCategory[];
  onSelectMerchantInLedger?: (merchant: string) => void;
}

const COMMON_PAY_DAYS = [
  { label: '매달 1일', value: '1' },
  { label: '매달 5일', value: '5' },
  { label: '매달 10일', value: '10' },
  { label: '매달 15일', value: '15' },
  { label: '매달 20일', value: '20' },
  { label: '매달 25일', value: '25' },
  { label: '말일(마지막날)', value: 'LAST_DAY' },
];

const PAYMENT_METHODS = [
  '우리카드',
  '우리WON',
  '토스뱅크',
  '토스',
  '카카오페이',
  '카카오뱅크',
  '신한카드',
  '국민카드',
  '현대카드',
  '자동이체',
  '기타',
];

export default function FixedExpensesManagement({
  categories = DEFAULT_HOUSEHOLD_CATEGORIES,
  onSelectMerchantInLedger,
}: FixedExpensesManagementProps) {
  const [items, setItems] = useState<FixedExpenseWithStats[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 다중 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);

  // 검색 및 필터
  const {
    searchQuery: [searchQuery, setSearchQuery],
    cycleFilter: [cycleFilter, setCycleFilter],
    statusFilter: [statusFilter, setStatusFilter],
    showDetails: [showDetails, setShowDetails],
  } = useCardFilterFields('card-history-fixed-expense-filters', {
    searchQuery: '', cycleFilter: 'ALL' as 'ALL' | FixedExpenseCycle,
    statusFilter: 'ALL' as 'ALL' | 'ACTIVE' | 'PAUSED', showDetails: 'false',
  });

  // 모달 상태
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FixedExpenseItem | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<FixedExpenseWithStats | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 폼 상태
  const [form, setForm] = useState({
    name: '',
    amount: '',
    category: '주거/통신',
    subCategory: '',
    paymentMethod: '우리카드',
    cycle: 'MONTHLY' as FixedExpenseCycle,
    payDay: '1',
    isCustomPayDay: false,
    customPayDay: '1',
    startDate: new Date().toISOString().slice(0, 10),
    hasEndDate: false,
    endDate: '',
    isAutoPay: true,
    isActive: true,
    memo: '',
    merchantKeyword: '',
  });

  // 데이터 로드
  const fetchFixedExpenses = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/card-transactions/fixed-expenses?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '고정비용 목록을 불러오지 못했습니다.');
      setItems(data.items || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setErrorMsg(err.message || '데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFixedExpenses();
  }, [fetchFixedExpenses]);

  // 필터링된 항목 목록
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      // 1. 검색어
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        const matchesSub = (item.subCategory || '').toLowerCase().includes(q);
        const matchesPay = item.paymentMethod.toLowerCase().includes(q);
        const matchesMemo = (item.memo || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesSub && !matchesPay && !matchesMemo) {
          return false;
        }
      }

      // 2. 주기
      if (cycleFilter !== 'ALL' && item.cycle !== cycleFilter) {
        return false;
      }

      // 3. 상태
      if (statusFilter === 'ACTIVE' && !item.isActive) return false;
      if (statusFilter === 'PAUSED' && item.isActive) return false;

      return true;
    });
  }, [items, searchQuery, cycleFilter, statusFilter]);

  const fixedOrder = useCardListOrder('fixed-expenses', items, visibleItems);
  const filteredItems = fixedOrder.ordered;
  const fixedVisibleIds = filteredItems.map((item) => item.id);

  // 항목 변경 시 선택된 ID 목록 정리
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(items.map((i) => i.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  // 다중 선택 상태 계산
  const isAllSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const isSomeSelected =
    filteredItems.some((item) => selectedIds.has(item.id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredItems.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // 선택된 항목 통계
  const selectedSummary = useMemo(() => {
    if (selectedIds.size === 0) return { count: 0, monthlyAmount: 0 };
    const selectedList = items.filter((item) => selectedIds.has(item.id));
    const monthlyAmount = selectedList.reduce(
      (sum, item) => sum + (item.monthlyNormalizedAmount || item.amount || 0),
      0
    );
    return {
      count: selectedList.length,
      monthlyAmount,
    };
  }, [items, selectedIds]);

  // 추가 모달 열기
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setForm({
      name: '',
      amount: '',
      category: '주거/통신',
      subCategory: '',
      paymentMethod: '우리카드',
      cycle: 'MONTHLY',
      payDay: '1',
      isCustomPayDay: false,
      customPayDay: '1',
      startDate: new Date().toISOString().slice(0, 10),
      hasEndDate: false,
      endDate: '',
      isAutoPay: true,
      isActive: true,
      memo: '',
      merchantKeyword: '',
    });
    setShowAddEditModal(true);
  };

  // 수정 모달 열기
  const handleOpenEditModal = (item: FixedExpenseItem) => {
    setEditingItem(item);
    const isCommon = COMMON_PAY_DAYS.some((d) => d.value === item.payDay);
    setForm({
      name: item.name,
      amount: String(item.amount),
      category: item.category,
      subCategory: item.subCategory || '',
      paymentMethod: item.paymentMethod,
      cycle: item.cycle,
      payDay: isCommon ? item.payDay : 'CUSTOM',
      isCustomPayDay: !isCommon,
      customPayDay: !isCommon ? item.payDay : '1',
      startDate: item.startDate,
      hasEndDate: !!item.endDate,
      endDate: item.endDate || '',
      isAutoPay: item.isAutoPay,
      isActive: item.isActive,
      memo: item.memo || '',
      merchantKeyword: item.merchantKeyword || item.name,
    });
    setShowAddEditModal(true);
  };

  // 폼 제출 (등록 또는 수정)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(form.amount.replace(/[^0-9]/g, ''), 10);
    if (!form.name.trim()) {
      alert('고정비용 이름을 입력해주세요.');
      return;
    }
    if (!amountNum || amountNum <= 0) {
      alert('올바른 금액(1원 이상)을 입력해주세요.');
      return;
    }

    const payDayValue = form.isCustomPayDay ? form.customPayDay : form.payDay;

    setSubmitting(true);
    try {
      const payload = {
        id: editingItem?.id,
        name: form.name.trim(),
        amount: amountNum,
        category: form.category,
        subCategory: form.subCategory.trim() || undefined,
        paymentMethod: form.paymentMethod,
        cycle: form.cycle,
        payDay: payDayValue,
        startDate: form.startDate,
        endDate: form.hasEndDate && form.endDate ? form.endDate : null,
        isAutoPay: form.isAutoPay,
        isActive: form.isActive,
        memo: form.memo.trim() || undefined,
        merchantKeyword: form.merchantKeyword.trim() || form.name.trim(),
      };

      const method = editingItem ? 'PATCH' : 'POST';
      const res = await fetch('/api/card-transactions/fixed-expenses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');

      setSuccessMsg(data.message || '저장되었습니다.');
      setShowAddEditModal(false);
      fetchFixedExpenses();
    } catch (err: any) {
      alert(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 활성/비활성 토글
  const handleToggleActive = async (item: FixedExpenseItem) => {
    try {
      const res = await fetch('/api/card-transactions/fixed-expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
      });
      if (res.ok) {
        fetchFixedExpenses();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // 단건 삭제
  const handleDelete = async (item: FixedExpenseItem) => {
    if (!confirm(`고정비용 [${item.name}]을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/card-transactions/fixed-expenses?id=${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');
      setSuccessMsg(`[${item.name}] 고정비용이 삭제되었습니다.`);
      setSelectedIds((prev) => {
        if (!prev.has(item.id)) return prev;
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      fetchFixedExpenses();
    } catch (err: any) {
      alert(err.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  // 선택한 고정비용 다중(일괄) 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !confirm(
        `선택한 ${count}개의 고정비용 항목을 정말 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`
      )
    ) {
      return;
    }

    setDeletingBulk(true);
    try {
      const idsArray = Array.from(selectedIds);
      const res = await fetch(
        `/api/card-transactions/fixed-expenses?ids=${encodeURIComponent(idsArray.join(','))}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsArray }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '일괄 삭제 실패');
      setSuccessMsg(data.message || `${count}개의 고정비용이 삭제되었습니다.`);
      setSelectedIds(new Set());
      fetchFixedExpenses();
    } catch (err: any) {
      alert(err.message || '고정비용 일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingBulk(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 알림 메시지 배너 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {successMsg && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(16, 185, 129, 0.12)',
            borderColor: 'rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span style={{ fontSize: '0.84rem', color: 'var(--success)', fontWeight: 600 }}>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.12)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.84rem', color: 'var(--danger)' }}>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. 고정비 핵심 요약 KPI 카드 (이 고정 비용 총 얼마 등) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <details className="ledger-advanced"><summary>고정비 요약 · 월 환산액과 누적 이력</summary>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '12px' }}>
        {/* 등록된 고정비 건수 */}
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Repeat size={20} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>등록된 고정비</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {summary?.activeCount || 0}
              <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                / {summary?.totalCount || 0}건 활성
              </span>
            </div>
          </div>
        </div>

        {/* 월 고정비 지출 합계 */}
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={20} color="#f87171" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>월 환산 예상액</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)', marginTop: '2px' }}>
              ₩{(summary?.totalMonthlyAmount || 0).toLocaleString()}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>/ 월</span>
            </div>
          </div>
        </div>

        {/* 연간 예상 고정비 */}
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calendar size={20} color="#fbbf24" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>연간 환산 예상액</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning)', marginTop: '2px' }}>
              ₩{(summary?.totalYearlyAmount || 0).toLocaleString()}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>/ 년</span>
            </div>
          </div>
        </div>

        {/* 지금까지 지출된 고정비 누적 총액 ("이 고정 비용은 총 얼마") */}
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <History size={20} color="#c084fc" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>과거 이력 누적 결제 총액</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ledger-accent)', marginTop: '2px' }}>
              ₩{(summary?.totalCumulativePaid || 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      </details>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. 컨트롤 & 필터 바 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel ledger-filter-bar" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="ledger-filter-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 'min(100%, 240px)', maxWidth: '520px' }}>
            {/* 검색창 */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="고정비 이름, 메모, 카테고리, 결제수단 검색..."
                style={{
                  width: '100%',
                  padding: '7px 28px 7px 30px',
                  background: 'var(--ledger-control-bg)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* 주기 필터 */}
            <select
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value as any)}
              style={{
                padding: '7px 10px',
                background: 'var(--ledger-control-bg)',
                border: '1px solid var(--surface-border)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
              }}
            >
              <option value="ALL">전체 주기</option>
              <option value="MONTHLY">매월</option>
              <option value="YEARLY">매년</option>
              <option value="WEEKLY">매주</option>
              <option value="DAILY">매일</option>
            </select>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '7px 10px',
                background: 'var(--ledger-control-bg)',
                border: '1px solid var(--surface-border)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
              }}
            >
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">활성 항목만</option>
              <option value="PAUSED">일시중지 항목</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deletingBulk || loading}
                className="btn btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: 'var(--danger)',
                  background: 'rgba(239, 68, 68, 0.1)',
                }}
                title="선택한 고정비용 삭제"
              >
                <Trash2 size={14} /> 선택 삭제 ({selectedIds.size}개)
              </button>
            )}
            <button
              onClick={fetchFixedExpenses}
              disabled={loading}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
              title="새로고침"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 새로고침
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: 'var(--success)',
                background: 'rgba(16, 185, 129, 0.1)',
              }}
              title="엑셀/스프레드시트 고정비용 복붙 일괄 등록"
            >
              <UploadCloud size={15} /> 대량(벌크) 복붙 등록
            </button>
            <button
              onClick={handleOpenAddModal}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                background: 'var(--ledger-solid-success)',
                borderColor: '#10b981',
              }}
            >
              <Plus size={15} /> 고정비 추가
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2-1. 선택된 고정비용 일괄 관리 바 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: 'var(--text-main)',
              }}
            >
              <CheckCircle2 size={16} color="var(--danger)" />
              <span>{selectedIds.size}개 항목 선택됨</span>
            </span>
            {selectedSummary.monthlyAmount > 0 && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                (월 환산 합계: <span style={{ color: 'var(--danger)', fontWeight: 600 }}>₩{selectedSummary.monthlyAmount.toLocaleString()}</span>)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleClearSelection}
              className="btn btn-secondary"
              style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            >
              선택 해제
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={deletingBulk || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                background: 'var(--danger)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: deletingBulk || loading ? 'not-allowed' : 'pointer',
                opacity: deletingBulk || loading ? 0.7 : 1,
              }}
            >
              <Trash2 size={13} />
              {deletingBulk ? '삭제 중...' : `선택한 ${selectedIds.size}개 삭제`}
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. 고정 비용 장부 테이블 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel ledger-scroll" role="region" aria-label="고정비용 목록" tabIndex={0} style={{ minHeight: '320px' }}>
        <div className="ledger-fixed-table-tools"><ListOrderStatus {...fixedOrder} /><label><input type="checkbox" checked={showDetails === 'true'} onChange={e => setShowDetails(String(e.target.checked))}/> 상세 정보 표시</label></div>
        <table className={`custom-table ledger-table ledger-table--fixed ${showDetails === 'true' ? '' : 'ledger-fixed-compact'}`} style={{ width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--ledger-subtle)' }}>
              <th className="ledger-cell ledger-cell--center" style={{ width: '38px' }}>
                <input
                  type="checkbox"
                  aria-label="전체 고정비용 선택"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th className="ledger-cell ledger-cell--start" scope="col" style={{ width: '36px' }}>순서</th>
              <th className="ledger-cell ledger-cell--center" style={{ width: '52px' }}>상태</th>
              <th className="ledger-cell ledger-cell--start">고정비 이름</th>
              <th className="ledger-cell ledger-cell--start">카테고리</th>
              <th className="ledger-cell ledger-cell--center">반복 주기 / 결제일</th>
              <th className="ledger-cell ledger-cell--start">결제 수단</th>
              <th className="ledger-cell ledger-cell--end">1회 결제액</th>
              <th className="ledger-cell ledger-cell--end">월 환산액</th>
              <th className="ledger-cell ledger-cell--end" style={{ color: 'var(--ledger-accent)' }}>
                과거 누적 결제액
              </th>
              <th className="ledger-cell ledger-cell--center">과거 이력</th>
              <th className="ledger-cell ledger-cell--center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="ledger-cell ledger-cell--center" colSpan={12} style={{ color: 'var(--text-muted)' }}>
                  고정비용 데이터를 불러오는 중...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td className="ledger-cell ledger-cell--center" colSpan={12} style={{ color: 'var(--text-muted)' }}>
                  {searchQuery || cycleFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? '검색 조건에 맞는 고정비용이 없습니다.'
                    : '등록된 고정비용이 없습니다. 상단의 [+ 고정비 추가] 버튼을 눌러 등록해보세요!'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const cat = resolveCategoryInfo(item.category, categories);
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    data-order-id={item.id}
                    style={{
                      borderBottom: '1px solid var(--surface-border)',
                      background: isSelected ? 'rgba(239, 68, 68, 0.06)' : undefined,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td className="ledger-cell ledger-cell--center">
                      <input
                        type="checkbox"
                        aria-label={`${item.name} 선택`}
                        checked={isSelected}
                        onChange={() => handleToggleSelectItem(item.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td className="ledger-cell ledger-cell--center">
                      <ListDragHandle id={item.id} ids={fixedVisibleIds} disabled={fixedOrder.disabled || loading} move={fixedOrder.move} />
                    </td>
                    {/* 상태 토글 스위치 */}
                    <td className="ledger-cell ledger-cell--center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        style={{
                          background: item.isActive ? 'rgba(16, 185, 129, 0.2)' : 'var(--ledger-control-bg)',
                          border: item.isActive ? '1px solid #10b981' : '1px solid var(--ledger-control-hover)',
                          color: item.isActive ? 'var(--success)' : 'var(--text-muted)',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.isActive ? '클릭 시 일시중단' : '클릭 시 다시 활성화'}
                      >
                        {item.isActive ? '활성' : '중단'}
                      </button>
                    </td>

                    {/* 고정비 이름 */}
                    <td className="ledger-cell ledger-cell--start" style={{ maxWidth: '240px' }}>
                      <div
                        className="ledger-primary"
                        title={item.memo ? `${item.name}\n메모: ${item.memo}` : item.name}
                        style={{
                          fontWeight: 600,
                          fontSize: "13px",
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.name}
                      </div>
                    </td>

                    {/* 카테고리 */}
                    <td className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${cat.color || '#3b82f6'}20`,
                          color: 'var(--text-main)',
                          fontSize: "12px",
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>{cat.emoji || '🏷️'}</span>
                        <span>{item.category}</span>
                        {item.subCategory && <span style={{ opacity: 0.7 }}>/ {item.subCategory}</span>}
                      </span>
                    </td>

                    {/* 반복 주기 및 결제일 */}
                    <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(56, 189, 248, 0.12)',
                          color: 'var(--ledger-info)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: "12px",
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                        title={`${formatCycleLabel(item.cycle)} / ${formatPayDayLabel(item.payDay, item.cycle)}`}
                      >
                        <Calendar size={11} />
                        <span>{formatPayDayLabel(item.payDay, item.cycle)}</span>
                      </div>
                    </td>

                    {/* 결제 수단 */}
                    <td className="ledger-cell ledger-cell--start" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: "12px", color: 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                        <CreditCard size={12} color="#94a3b8" />
                        <span>{item.paymentMethod}</span>
                        {item.isAutoPay && (
                          <span style={{ fontSize: "11px", color: 'var(--success)', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '1px 4px', borderRadius: '3px' }}>자동</span>
                        )}
                      </div>
                    </td>

                    {/* 1회 결제금액 */}
                    {(() => {
                      const isIncome = resolveCategoryInfo(item.category, categories).type === 'INCOME';
                      return (
                        <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 700, color: isIncome ? 'var(--income-color, #ef4444)' : 'var(--expense-color, #3b82f6)', fontSize: "13px", whiteSpace: 'nowrap' }}>
                          <span style={{ marginRight: '2px' }}>{isIncome ? '+' : '−'}</span><MoneyValue value={item.amount} />
                        </td>
                      );
                    })()}

                    {/* 월 환산액 */}
                    {(() => {
                      const isIncome = resolveCategoryInfo(item.category, categories).type === 'INCOME';
                      return (
                        <td className="ledger-cell ledger-cell--end" style={{ fontWeight: 600, color: isIncome ? 'var(--income-color, #ef4444)' : 'var(--text-main)', fontSize: "13px", whiteSpace: 'nowrap' }}>
                          <span style={{ marginRight: '2px' }}>{isIncome ? '+' : '−'}</span><MoneyValue value={item.monthlyNormalizedAmount} />
                        </td>
                      );
                    })()}

                    {/* 과거 누적 총 결제액 ("이 고정 비용은 총 얼마") */}
                    <td className="ledger-cell ledger-cell--end" style={{ whiteSpace: 'nowrap' }}>
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', whiteSpace: 'nowrap' }}
                        title={`총 ${item.paidCount}회 결제됨`}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--ledger-accent)', fontSize: "13px" }}>
                          <MoneyValue value={item.totalPaidAmount} />
                        </span>
                        <span style={{ fontSize: "11px", color: 'var(--text-muted)' }}>({item.paidCount}회)</span>
                      </div>
                    </td>

                    {/* 과거 이력 보기 버튼 */}
                    <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryItem(item)}
                        className="btn btn-secondary"
                        style={{
                          padding: '2px 6px',
                          fontSize: "11px",
                          minHeight: '26px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--ledger-info)',
                          borderColor: 'rgba(56, 189, 248, 0.3)',
                        }}
                        title="과거 결제 이력 상세 및 총액 확인"
                      >
                        <History size={11} />
                        <span>이력 ({item.paidCount})</span>
                      </button>
                    </td>

                    {/* 관리 액션 */}
                    <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="btn btn-secondary"
                          style={{ padding: '2px 5px', minWidth: '26px', minHeight: '26px', color: 'var(--text-muted)' }}
                          title="수정"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="btn btn-secondary"
                          style={{ padding: '2px 5px', minWidth: '26px', minHeight: '26px', color: 'var(--danger)' }}
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. 과거 이력 상세 모달 ("이 고정 비용은 총 얼마") */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedHistoryItem && (
        <div
          onClick={() => setSelectedHistoryItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              background: 'var(--surface-color)',
              border: '1px solid var(--surface-border)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.75)',
              overflow: 'hidden',
            }}
          >
            {/* 모달 헤더 */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--ledger-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={16} color="#c084fc" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  [{selectedHistoryItem.name}] 과거 결제 이력
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* "이 고정 비용은 총 얼마" 하이라이트 박스 */}
            <div
              style={{
                padding: '14px 18px',
                background: 'rgba(168, 85, 247, 0.08)',
                borderBottom: '1px solid rgba(168, 85, 247, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--ledger-accent)', fontWeight: 600 }}>
                  이 고정 비용 총 누적 지출액
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
                  ₩{selectedHistoryItem.totalPaidAmount.toLocaleString()}
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ledger-accent)', marginLeft: '6px' }}>
                    (총 {selectedHistoryItem.paidCount}회 결제됨)
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div>최근 결제일: <b style={{ color: 'var(--text-main)' }}>{selectedHistoryItem.lastPaidAt || '기록 없음'}</b></div>
                <div>설정 금액: ₩{selectedHistoryItem.amount.toLocaleString()} ({formatPayDayLabel(selectedHistoryItem.payDay, selectedHistoryItem.cycle)})</div>
              </div>
            </div>

            {/* 과거 결제 목록 */}
            <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1, maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedHistoryItem.history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  아직 가계부 거래 내역에 매칭된 과거 결제 이력이 없습니다.
                  <div style={{ fontSize: '0.72rem', marginTop: '6px', color: 'var(--text-muted)' }}>
                    (매칭 키워드: &quot;{selectedHistoryItem.merchantKeyword || selectedHistoryItem.name}&quot;)
                  </div>
                </div>
              ) : (
                selectedHistoryItem.history.map((h, idx) => (
                  <div
                    key={h.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--ledger-subtle)',
                      borderRadius: '8px',
                      border: '1px solid var(--surface-border)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{h.merchant}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({h.date})</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {h.sourceApp} {h.cardOrAccount ? `· ${h.cardOrAccount}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.86rem' }}>
                        -₩{h.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 모달 푸터 */}
            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid var(--surface-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--ledger-subtle)',
              }}
            >
              {onSelectMerchantInLedger && (
                <button
                  type="button"
                  onClick={() => {
                    const kw = selectedHistoryItem.merchantKeyword || selectedHistoryItem.name;
                    setSelectedHistoryItem(null);
                    onSelectMerchantInLedger(kw);
                  }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--ledger-info)' }}
                >
                  <Search size={12} /> 장부에서 관련 거래 전체 검색
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '5px 14px', fontSize: '0.78rem' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. 신규 등록 / 수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAddEditModal && (
        <div
          onClick={() => setShowAddEditModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '540px',
              maxHeight: '92vh',
              background: 'var(--surface-color)',
              border: '1px solid var(--surface-border)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--surface-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--ledger-subtle)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {editingItem ? '고정비용 수정' : '신규 고정비용 추가'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* 본문 폼 */}
            <form onSubmit={handleSubmitForm} style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 이름 */}
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                  고정비용 항목명 *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="예: 넷플릭스 프리미엄, 주택 월세, 아파트 관리비, KT 통신비"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    fontSize: '0.84rem',
                  }}
                />
              </div>

              {/* 금액 및 반복 주기 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                    1회 결제 금액 (원) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.amount ? Number(form.amount.replace(/[^0-9]/g, '')).toLocaleString() : ''}
                    onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9]/g, '') })}
                    placeholder="예: 17,000"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--danger)',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                    반복 주기 *
                  </label>
                  <select
                    value={form.cycle}
                    onChange={(e) => setForm({ ...form, cycle: e.target.value as FixedExpenseCycle })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="MONTHLY">매월 (월간)</option>
                    <option value="YEARLY">매년 (연간)</option>
                    <option value="WEEKLY">매주 (주간)</option>
                    <option value="DAILY">매일 (일간)</option>
                  </select>
                </div>
              </div>

              {/* 결제 날짜 선택 (단축 버튼 및 말일 옵션) */}
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  결제 날짜 (일자 선택) *
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {COMMON_PAY_DAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setForm({ ...form, payDay: d.value, isCustomPayDay: false })}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.74rem',
                        borderRadius: '6px',
                        border: !form.isCustomPayDay && form.payDay === d.value ? '1px solid #38bdf8' : '1px solid var(--surface-border)',
                        background: !form.isCustomPayDay && form.payDay === d.value ? 'rgba(56, 189, 248, 0.2)' : 'var(--ledger-subtle)',
                        color: !form.isCustomPayDay && form.payDay === d.value ? "var(--ledger-info)" : "var(--text-main)",
                        cursor: 'pointer',
                        fontWeight: !form.isCustomPayDay && form.payDay === d.value ? 700 : 500,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isCustomPayDay: true })}
                    style={{
                      padding: '4px 9px',
                      fontSize: '0.74rem',
                      borderRadius: '6px',
                      border: form.isCustomPayDay ? '1px solid #38bdf8' : '1px solid var(--surface-border)',
                      background: form.isCustomPayDay ? 'rgba(56, 189, 248, 0.2)' : 'var(--ledger-subtle)',
                      color: form.isCustomPayDay ? "var(--ledger-info)" : "var(--text-main)",
                      cursor: 'pointer',
                      fontWeight: form.isCustomPayDay ? 700 : 500,
                    }}
                  >
                    직접 입력
                  </button>
                </div>

                {form.isCustomPayDay && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={form.customPayDay}
                      onChange={(e) => setForm({ ...form, customPayDay: e.target.value })}
                      placeholder="1~31"
                      style={{
                        width: '90px',
                        padding: '6px 10px',
                        background: 'var(--ledger-control-bg)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '6px',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>일 결제</span>
                  </div>
                )}
              </div>

              {/* 적용 기간 (시작일, 종료일) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                    시작일 *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>종료일</label>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.hasEndDate}
                        onChange={(e) => setForm({ ...form, hasEndDate: e.target.checked })}
                      />
                      지정
                    </label>
                  </div>
                  {form.hasEndDate ? (
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '7px 8px',
                        background: 'var(--ledger-control-bg)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '6px',
                        color: 'var(--text-main)',
                        fontSize: '0.78rem',
                      }}
                    />
                  ) : (
                    <div style={{ padding: '7px 8px', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--ledger-subtle)', borderRadius: '6px' }}>
                      종료일 없음 (무기한)
                    </div>
                  )}
                </div>
              </div>

              {/* 카테고리 및 결제수단 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                    카테고리 *
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <optgroup label="지출 카테고리">
                      {categories.filter((c) => c.type === 'EXPENSE').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.emoji || '🏷️'} {c.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="수입 카테고리">
                      {categories.filter((c) => c.type === 'INCOME').map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.emoji || '💰'} {c.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                    결제 수단 *
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 과거 내역 자동 매칭 키워드 */}
              <div>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', fontWeight: 600 }}>
                  과거 거래 내역 자동 매칭 키워드
                </label>
                <input
                  type="text"
                  value={form.merchantKeyword}
                  onChange={(e) => setForm({ ...form, merchantKeyword: e.target.value })}
                  placeholder="예: 넷플릭스, KT, 월세 (비워둘 시 항목명 사용)"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                  }}
                />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  💡 이 키워드로 과거 거래 내역을 검색하여 누적 결제 총액을 자동 계산합니다.
                </div>
              </div>

              {/* 메모 및 자동이체 여부 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.isAutoPay}
                      onChange={(e) => setForm({ ...form, isAutoPay: e.target.checked })}
                    />
                    자동이체 등록됨
                  </label>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    활성 상태
                  </label>
                </div>

                <textarea
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="추가 메모 (선택)"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '6px',
                    color: 'var(--text-main)',
                    fontSize: '0.8rem',
                    resize: 'none',
                  }}
                />
              </div>

              {/* 제출 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--surface-border)', paddingTop: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ padding: '6px 18px', fontSize: '0.8rem', background: 'var(--ledger-solid-success)', borderColor: '#10b981' }}
                >
                  {submitting ? '저장 중...' : editingItem ? '수정 완료' : '고정비용 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 대량(벌크) 고정비용 복붙 등록 모달 */}
      <BulkFixedExpenseModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        categories={categories}
        existingItems={items}
        onSuccess={() => {
          fetchFixedExpenses();
          setSuccessMsg('대량 고정비용이 성공적으로 등록되었습니다.');
        }}
      />
    </div>
  );
}
