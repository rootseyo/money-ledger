'use client';

import { useCardFilterFields } from '@/hooks/use-card-filter-cookie';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Search,
  Check,
  X,
  Layers,
  AlertCircle,
  CheckCircle2,
  List,
  LayoutGrid,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { HouseholdCategory, CategoryType } from '@/lib/household-categories';
import {
  HouseholdPaymentMethod,
  DEFAULT_PAYMENT_METHODS,
  normalizePaymentMethodId,
} from '@/lib/payment-methods';

export type CategoryTab = CategoryType | 'PAYMENT_METHOD';

interface CategoryManagementProps {
  categories: HouseholdCategory[];
  onCategoriesUpdated: () => Promise<void> | void;
  paymentMethods?: HouseholdPaymentMethod[];
  onPaymentMethodsUpdated?: () => Promise<void> | void;
  forcedType?: 'PAYMENT_METHOD' | 'CATEGORIES';
}

const PRESET_EMOJIS: Record<CategoryType, string[]> = {
  EXPENSE: [
    '🏠', '🍚', '🧼', '🚗', '🚘', '📱', '📚', '🎹', '🎓', '💊',
    '🛡️', '📄', '👗', '🎬', '✈️', '🎁', '🐾', '📺', '🧾', '💼',
    '🛋️', '🏷️', '☕', '🍔', '🛒', '⛽', '🚅', '🩺', '🎪', '⚽',
  ],
  INCOME: [
    '💰', '💼', '📈', '📊', '🏛️', '💳', '📦', '👨‍👩‍👧', '💵', '🪙',
    '💎', '🏆', '🧧', '🏢', '🏷️',
  ],
  SAVINGS: [
    '🌱', '🏦', '📈', '🪙', '📊', '🪴', '🐷', '🔒', '🎯', '✨',
  ],
  TRANSFER: [
    '💸', '💳', '🔄', '🏧', '📲', '📤', '📥', '🏷️',
  ],
};

const PRESET_PM_EMOJIS = [
  '💳', '🏦', '🟡', '💛', '💙', '📱', '💵', '✍️', '🪙', '🦁',
  '🛍️', '🛒', '🏷️', '💰', '📲', '🏧', '💸', '✨', '⚡', '🏢',
];

const PRESET_COLORS = [
  '#ff9800', '#26a69a', '#42a5f5', '#8bc34a', '#3b82f6',
  '#06b6d4', '#8b5cf6', '#a855f7', '#d946ef', '#ef5350',
  '#0d9488', '#14b8a6', '#ec4899', '#ec407a', '#0284c7',
  '#f43f5e', '#fb923c', '#6366f1', '#64748b', '#475569',
  '#78716c', '#10b981', '#059669', '#9e9e9e',
];

export default function CategoryManagement({
  categories,
  onCategoriesUpdated,
  paymentMethods,
  onPaymentMethodsUpdated,
  forcedType,
}: CategoryManagementProps) {
  // 현재 탭 (지출 vs 수입 vs 저축 vs 이체 vs 결제/금융)
  const {
    activeType: [activeType, setActiveType],
    searchQuery: [searchQuery, setSearchQuery],
  } = useCardFilterFields('card-history-category-filters', {
    activeType: (forcedType === 'PAYMENT_METHOD' ? 'PAYMENT_METHOD' : 'EXPENSE') as CategoryTab,
    searchQuery: '',
  });

  useEffect(() => {
    if (forcedType === 'PAYMENT_METHOD') {
      setActiveType('PAYMENT_METHOD');
    } else if (forcedType === 'CATEGORIES' && activeType === 'PAYMENT_METHOD') {
      setActiveType('EXPENSE');
    }
  }, [forcedType, activeType, setActiveType]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [selectedPaymentMethodIds, setSelectedPaymentMethodIds] = useState<Set<string>>(new Set());
  const [draggedPaymentMethodId, setDraggedPaymentMethodId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // 인라인 소분류 추가 상태 (어느 카테고리에 입력 중인지)
  const [addingSubToId, setAddingSubToId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  // 대분류 추가/수정 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [formState, setFormState] = useState<{
    id: string;
    name: string;
    type: CategoryType;
    emoji: string;
    color: string;
    subcategoriesInput: string;
  }>({
    id: '',
    name: '',
    type: 'EXPENSE',
    emoji: '🏠',
    color: '#ff9800',
    subcategoriesInput: '',
  });

  // 결제/금융 수단 추가/수정 모달 상태
  const [showPmModal, setShowPmModal] = useState(false);
  const [pmModalMode, setPmModalMode] = useState<'add' | 'edit'>('add');
  const [pmFormState, setPmFormState] = useState<{
    id: string;
    name: string;
    emoji: string;
    color: string;
    desc: string;
  }>({
    id: '',
    name: '',
    emoji: '💳',
    color: '#3b82f6',
    desc: '',
  });

  const showBanner = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  // 필터링된 카테고리 목록
  const currentList = categories.filter((c) => c.type === (activeType as CategoryType));
  const filteredList = currentList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(q);
    const subMatch = c.subcategories.some((s) => s.toLowerCase().includes(q));
    return nameMatch || subMatch;
  });
  useEffect(() => { setSelectedCategoryIds(new Set()); setSelectedPaymentMethodIds(new Set()); }, [activeType, searchQuery]);

  const expenseCount = categories.filter((c) => c.type === 'EXPENSE').length;
  const incomeCount = categories.filter((c) => c.type === 'INCOME').length;
  const savingsCount = categories.filter((c) => c.type === 'SAVINGS').length;
  const transferCount = categories.filter((c) => c.type === 'TRANSFER').length;
  const totalSubcategoriesCount = filteredList.reduce((acc, c) => acc + c.subcategories.length, 0);

  // 결제/금융 수단 목록 및 필터링
  const effectivePaymentMethods = paymentMethods && paymentMethods.length > 0 ? paymentMethods : DEFAULT_PAYMENT_METHODS;
  const filteredPmList = effectivePaymentMethods.filter((pm) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      pm.name.toLowerCase().includes(q) ||
      pm.id.toLowerCase().includes(q) ||
      (pm.desc && pm.desc.toLowerCase().includes(q))
    );
  });

  // 1. 소분류 인라인 추가
  const handleAddSubcategory = async (categoryId: string) => {
    const sub = newSubName.trim();
    if (!sub) return;

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSubcategory',
          categoryId,
          subcategory: sub,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '소분류 추가 실패');

      setNewSubName('');
      setAddingSubToId(null);
      showBanner(`'${sub}' 소분류가 추가되었습니다.`, 'success');
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. 소분류 삭제
  const handleDeleteSubcategory = async (categoryId: string, subcategory: string) => {
    if (!confirm(`'${subcategory}' 소분류를 삭제하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteSubcategory',
          categoryId,
          subcategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '소분류 삭제 실패');

      showBanner(`'${subcategory}' 소분류가 삭제되었습니다.`, 'success');
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 3. 대분류 삭제
  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`'${categoryName}' 대분류와 하위 소분류를 모두 삭제하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          categoryId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '카테고리 삭제 실패');

      showBanner(`'${categoryName}' 대분류가 삭제되었습니다.`, 'success');
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDropCategory = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || searchQuery.trim()) return;
    const typeItems = categories.filter((category) => category.type === activeType);
    const sourceIndex = typeItems.findIndex((category) => category.id === sourceId);
    const targetIndex = typeItems.findIndex((category) => category.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = typeItems.splice(sourceIndex, 1);
    typeItems.splice(targetIndex, 0, moved);
    let nextIndex = 0;
    const updated = categories.map((category) => category.type === activeType ? typeItems[nextIndex++] : category);
    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', categories: updated }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '카테고리 순서 변경 실패');
      showBanner(`'${moved.name}' 카테고리 순서를 변경했습니다.`);
      await onCategoriesUpdated();
    } catch (err: unknown) { showBanner(err instanceof Error ? err.message : '순서 변경 중 오류가 발생했습니다.', 'error'); }
    finally { setLoading(false); setDraggedCategoryId(null); }
  };

  const toggleCategorySelection = (id: string) => setSelectedCategoryIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleBulkDeleteCategories = async () => {
    const selected = filteredList.filter((category) => selectedCategoryIds.has(category.id));
    if (!selected.length || !confirm(`선택한 대분류 ${selected.length}개와 각 하위 소분류를 삭제할까요? 기존 거래 기록은 유지됩니다.`)) return;
    setLoading(true);
    try {
      const selectedIds = new Set(selected.map((category) => category.id));
      const updated = categories.filter((category) => !selectedIds.has(category.id));
      const res = await fetch('/api/card-transactions/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', categories: updated }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '카테고리 삭제 실패');
      setSelectedCategoryIds(new Set());
      showBanner(`대분류 ${selected.length}개를 삭제했습니다. 기존 거래 기록은 유지됩니다.`);
      await onCategoriesUpdated();
    } catch (err: unknown) { showBanner(err instanceof Error ? err.message : '카테고리 삭제 중 오류가 발생했습니다.', 'error'); }
    finally { setLoading(false); }
  };

  // 3-2. 소분류 카테고리 순서 변경 (좌/우)
  const handleMoveSubcategory = async (
    categoryId: string,
    subIndex: number,
    direction: 'left' | 'right'
  ) => {
    const targetCategory = categories.find((c) => c.id === categoryId);
    if (!targetCategory) return;

    const targetSubIndex = direction === 'left' ? subIndex - 1 : subIndex + 1;
    if (targetSubIndex < 0 || targetSubIndex >= targetCategory.subcategories.length) return;

    const updatedSubs = [...targetCategory.subcategories];
    const temp = updatedSubs[subIndex];
    updatedSubs[subIndex] = updatedSubs[targetSubIndex];
    updatedSubs[targetSubIndex] = temp;

    const updatedCategories = categories.map((c) =>
      c.id === categoryId ? { ...c, subcategories: updatedSubs } : c
    );

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          categories: updatedCategories,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '소분류 순서 변경 실패');

      showBanner(`'${temp}' 소분류 순서가 변경되었습니다.`, 'success');
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '순서 변경 중 오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 4. 기본 카테고리(비용 22, 수입 8) 복원
  const handleResetDefaults = async () => {
    if (
      !confirm(
        '카테고리 설정을 초기 기본값(비용 22개, 수입 8개 대분류 및 소분류 체계)으로 복원하시겠습니까?'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '초기화 실패');

      showBanner('기본 카테고리로 초기화되었습니다. (비용 22종, 수입 8종)', 'success');
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 5. 모달 오픈 (추가)
  const openAddModal = () => {
    setModalMode('add');
    const safeType = (activeType === 'PAYMENT_METHOD' ? 'EXPENSE' : activeType) as CategoryType;
    setFormState({
      id: '',
      name: '',
      type: safeType,
      emoji: safeType === 'EXPENSE' ? '🍚' : '💰',
      color: safeType === 'EXPENSE' ? '#ff9800' : '#10b981',
      subcategoriesInput: '',
    });
    setShowModal(true);
  };

  // 6. 모달 오픈 (수정)
  const openEditModal = (cat: HouseholdCategory) => {
    setModalMode('edit');
    setFormState({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      emoji: cat.emoji,
      color: cat.color,
      subcategoriesInput: cat.subcategories.join(', '),
    });
    setShowModal(true);
  };

  // 7. 모달 제출 (저장)
  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameClean = formState.name.trim();
    if (!nameClean) {
      alert('카테고리 이름을 입력해주세요.');
      return;
    }

    const subs = formState.subcategoriesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setLoading(true);
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/card-transactions/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add',
            category: {
              name: nameClean,
              type: formState.type,
              emoji: formState.emoji,
              color: formState.color,
              subcategories: subs,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '추가 실패');
        showBanner(`'${nameClean}' 대분류가 등록되었습니다.`, 'success');
      } else {
        const res = await fetch('/api/card-transactions/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            category: {
              id: formState.id,
              name: nameClean,
              type: formState.type,
              emoji: formState.emoji,
              color: formState.color,
              subcategories: subs,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '수정 실패');
        showBanner(`'${nameClean}' 카테고리가 수정되었습니다.`, 'success');
      }

      setShowModal(false);
      await onCategoriesUpdated();
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 8. 결제/금융 수단 모달 오픈 (추가)
  const openAddPmModal = () => {
    setPmModalMode('add');
    setPmFormState({
      id: '',
      name: '',
      emoji: '💳',
      color: '#3b82f6',
      desc: '',
    });
    setShowPmModal(true);
  };

  // 9. 결제/금융 수단 모달 오픈 (수정)
  const openEditPmModal = (pm: HouseholdPaymentMethod) => {
    setPmModalMode('edit');
    setPmFormState({
      id: pm.id,
      name: pm.name,
      emoji: pm.emoji || '💳',
      color: pm.color || '#3b82f6',
      desc: pm.desc || '',
    });
    setShowPmModal(true);
  };

  // 10. 결제/금융 수단 모달 제출
  const handlePmModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameClean = pmFormState.name.trim();
    if (!nameClean) {
      alert('결제/금융 수단 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: pmModalMode === 'edit' ? 'update' : 'add',
          paymentMethod: {
            id: pmFormState.id.trim() || undefined,
            name: nameClean,
            emoji: pmFormState.emoji,
            color: pmFormState.color,
            desc: pmFormState.desc.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');

      showBanner(
        pmModalMode === 'add'
          ? `'${nameClean}' 결제/금융 수단이 추가되었습니다.`
          : `'${nameClean}' 결제/금융 수단이 수정되었습니다.`,
        'success'
      );
      setShowPmModal(false);
      if (onPaymentMethodsUpdated) {
        await onPaymentMethodsUpdated();
      }
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 11. 결제/금융 수단 삭제
  const handleDeletePaymentMethod = async (id: string, name: string) => {
    if (!confirm(`'${name}' 결제/금융 수단을 삭제하시겠습니까?`)) return;

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제 실패');

      showBanner(`'${name}' 결제/금융 수단이 삭제되었습니다.`, 'success');
      if (onPaymentMethodsUpdated) {
        await onPaymentMethodsUpdated();
      }
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDropPaymentMethod = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || searchQuery.trim()) return;
    const updated = [...effectivePaymentMethods];
    const sourceIndex = updated.findIndex((method) => method.id === sourceId);
    const targetIndex = updated.findIndex((method) => method.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/payment-methods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', paymentMethods: updated }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결제/금융 수단 순서 변경 실패');
      showBanner(`'${moved.name}' 결제/금융 수단 순서를 변경했습니다.`);
      await onPaymentMethodsUpdated?.();
    } catch (err: unknown) { showBanner(err instanceof Error ? err.message : '순서 변경 중 오류가 발생했습니다.', 'error'); }
    finally { setLoading(false); setDraggedPaymentMethodId(null); }
  };

  const handleBulkDeletePaymentMethods = async () => {
    const selected = filteredPmList.filter((method) => selectedPaymentMethodIds.has(method.id));
    if (!selected.length) return;
    const remaining = effectivePaymentMethods.filter((method) => !selectedPaymentMethodIds.has(method.id));
    if (!remaining.length) {
      showBanner('결제 수단을 모두 삭제할 수 없습니다. 최소 한 개 이상 남겨 주세요.', 'error');
      return;
    }
    if (!confirm(`선택한 결제/금융 수단 ${selected.length}개를 삭제할까요? 기존 거래 기록은 유지됩니다.`)) return;
    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/payment-methods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', paymentMethods: remaining }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '결제/금융 수단 삭제 실패');
      setSelectedPaymentMethodIds(new Set());
      showBanner(`결제/금융 수단 ${selected.length}개를 삭제했습니다. 기존 거래 기록은 유지됩니다.`);
      await onPaymentMethodsUpdated?.();
    } catch (err: unknown) { showBanner(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.', 'error'); }
    finally { setLoading(false); }
  };

  // 12. 결제/금융 수단 기본값 복원
  const handleResetPaymentMethods = async () => {
    if (
      !confirm(
        '결제/금융 수단 설정을 초기 기본값(우리카드, 우리WON, 카카오페이, 카카오뱅크, 토스뱅크, SMS, 직접입력 등)으로 복원하시겠습니까?'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/card-transactions/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '초기화 실패');

      showBanner('기본 결제/금융 수단으로 초기화되었습니다.', 'success');
      if (onPaymentMethodsUpdated) {
        await onPaymentMethodsUpdated();
      }
    } catch (err: unknown) {
      showBanner(err instanceof Error ? err.message : '오류가 발생했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 알림 메시지 */}
      {message && (
        <div
          className="glass-panel"
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            borderColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? (
              <CheckCircle2 size={16} color="#10b981" />
            ) : (
              <AlertCircle size={16} color="#ef4444" />
            )}
            <span style={{ fontSize: '0.85rem', color: message.type === 'success' ? 'var(--success)' : "var(--danger)" }}>
              {message.text}
            </span>
          </div>
          <button
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 상단 컨트롤 패널 */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeType === 'PAYMENT_METHOD' ? (
                <>
                  <CreditCard size={20} color="#3b82f6" />
                  결제 / 금융 수단 관리
                </>
              ) : (
                <>
                  <Layers size={20} color="#10b981" />
                  가계부 수입·지출 카테고리 관리
                </>
              )}
            </h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {activeType === 'PAYMENT_METHOD'
                ? '거래 내역 장부에서 선택할 수 있는 금융사, 카드, 결제 앱, 현금 등의 수단을 등록하고 관리합니다.'
                : '대분류와 소분류 항목을 체계적으로 정의하고, 거래 내역 등록 및 리포트에 반영합니다.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={activeType === 'PAYMENT_METHOD' ? handleResetPaymentMethods : handleResetDefaults}
              disabled={loading}
              className="btn btn-secondary"
              title={activeType === 'PAYMENT_METHOD' ? '기본 결제/금융 수단 복원' : '비용 22종, 수입 8종 기본값 복원'}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 12px' }}
            >
              <RotateCcw size={14} /> 기본값 복원
            </button>
            <button
              onClick={activeType === 'PAYMENT_METHOD' ? openAddPmModal : openAddModal}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
            >
              <Plus size={15} /> {activeType === 'PAYMENT_METHOD' ? '새 결제/금융 수단 추가' : '새 대분류 추가'}
            </button>
          </div>
        </div>

        {/* 탭 전환 (지출 vs 수입 vs 저축·투자 vs 이체 vs 결제/금융 수단) 및 검색 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderTop: '1px solid var(--surface-border)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveType('EXPENSE')}
              className={`btn ${activeType === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.84rem',
                padding: '8px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>🛡️ 지출(소비)</span>
              <span
                style={{
                  background: activeType === 'EXPENSE' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                }}
              >
                {expenseCount}
              </span>
            </button>

            <button
              onClick={() => setActiveType('INCOME')}
              className={`btn ${activeType === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.84rem',
                padding: '8px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>💰 수입</span>
              <span
                style={{
                  background: activeType === 'INCOME' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                }}
              >
                {incomeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveType('SAVINGS')}
              className={`btn ${activeType === 'SAVINGS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.84rem',
                padding: '8px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>🌱 저축·투자</span>
              <span
                style={{
                  background: activeType === 'SAVINGS' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                }}
              >
                {savingsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveType('TRANSFER')}
              className={`btn ${activeType === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.84rem',
                padding: '8px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>💸 이체/송금</span>
              <span
                style={{
                  background: activeType === 'TRANSFER' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                }}
              >
                {transferCount}
              </span>
            </button>

            <button
              onClick={() => setActiveType('PAYMENT_METHOD')}
              className={`btn ${activeType === 'PAYMENT_METHOD' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.84rem',
                padding: '8px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>💳 결제/금융 수단</span>
              <span
                style={{
                  background: activeType === 'PAYMENT_METHOD' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                }}
              >
                {effectivePaymentMethods.length}
              </span>
            </button>
          </div>

          {/* 우측 컨트롤: 뷰 모드 토글 (목록형 / 카드형) 및 검색 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* 뷰 모드 토글 */}
            <div
              style={{
                display: 'flex',
                background: 'var(--ledger-control-bg)',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid var(--surface-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="목록형 (테이블 리스트) 보기"
                style={{
                  background: viewMode === 'list' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--success)' : 'var(--text-muted)',
                  border: viewMode === 'list' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '5px 11px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <List size={14} /> 목록형
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="카드형 (그리드) 보기"
                style={{
                  background: viewMode === 'grid' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--success)' : 'var(--text-muted)',
                  border: viewMode === 'grid' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '5px 11px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <LayoutGrid size={14} /> 카드형
              </button>
            </div>

            {/* 검색 입력 */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder={activeType === 'PAYMENT_METHOD' ? '결제/금융 수단 또는 코드 검색...' : '대분류 또는 소분류 검색...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  background: 'var(--ledger-control-bg)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                }}
              />
            </div>
          </div>
        </div>

        {/* 요약 바 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', borderTop: '1px solid var(--ledger-subtle)', paddingTop: '10px' }}>
          <div>
            {activeType === 'PAYMENT_METHOD' ? (
              <>
                현재 표시: <b style={{ color: 'var(--text-main)' }}>{filteredPmList.length}개</b> 결제/금융 수단 (전체 {effectivePaymentMethods.length}개)
              </>
            ) : (
              <>
                현재 표시: <b style={{ color: 'var(--text-main)' }}>{filteredList.length}개</b> 대분류 · 총 <b style={{ color: 'var(--ledger-info)' }}>{totalSubcategoriesCount}개</b> 소분류 항목
              </>
            )}
          </div>
          <div style={{ fontSize: '0.72rem' }}>
            {activeType === 'PAYMENT_METHOD'
              ? '※ 거래 내역 장부의 결제/금융 선택 드롭다운, 필터 및 거래 등록창에 즉시 연동됩니다.'
              : '※ 소분류 태그의 ✕를 눌러 삭제하거나 [+ 추가] 버튼으로 소분류를 즉시 등록할 수 있습니다.'}
          </div>
        </div>
        {activeType !== 'PAYMENT_METHOD' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={filteredList.length > 0 && filteredList.every((category) => selectedCategoryIds.has(category.id))} onChange={(event) => setSelectedCategoryIds(event.target.checked ? new Set(filteredList.map((category) => category.id)) : new Set())} />
            표시된 대분류 전체 선택
          </label>
          {selectedCategoryIds.size > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedCategoryIds.size}개 선택됨</span>
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void handleBulkDeleteCategories()} style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trash2 size={14}/>선택 삭제</button>
          </div>}
        </div>}
        {activeType === 'PAYMENT_METHOD' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <input type="checkbox" checked={filteredPmList.length > 0 && filteredPmList.every((method) => selectedPaymentMethodIds.has(method.id))} onChange={(event) => setSelectedPaymentMethodIds(event.target.checked ? new Set(filteredPmList.map((method) => method.id)) : new Set())} />
            표시된 결제 수단 전체 선택
          </label>
          {selectedPaymentMethodIds.size > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedPaymentMethodIds.size}개 선택됨</span>
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void handleBulkDeletePaymentMethods()} style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trash2 size={14}/>선택 삭제</button>
          </div>}
        </div>}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 결제/금융 수단 뷰 (목록형 및 카드형) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeType === 'PAYMENT_METHOD' && viewMode === 'list' && (
        filteredPmList.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dark)' }}>
            {searchQuery ? '검색 결과와 일치하는 결제/금융 수단이 없습니다.' : '등록된 결제/금융 수단이 없습니다.'}
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0, borderRadius: '16px' }}>
            <table className="custom-table ledger-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '76px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    <span className="sr-only">선택·순서</span>
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ width: '220px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    수단 명칭
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ width: '180px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    식별 코드 (ID)
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ width: '160px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    장부 표시 배지
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                    설명 / 메모
                  </th>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '100px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    구분
                  </th>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '160px', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPmList.map((pm, idx) => (
                  <tr
                    key={pm.id}
                    draggable={!searchQuery.trim() && !loading}
                    onDragStart={(event) => { setDraggedPaymentMethodId(pm.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', pm.id); }}
                    onDragOver={(event) => { if (draggedPaymentMethodId) event.preventDefault(); }}
                    onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedPaymentMethodId; if (source) void handleDropPaymentMethod(source, pm.id); }}
                    onDragEnd={() => setDraggedPaymentMethodId(null)}
                    style={{
                      borderBottom: '1px solid var(--ledger-control-bg)',
                      transition: 'background 0.15s ease',
                      opacity: draggedPaymentMethodId === pm.id ? 0.45 : 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ledger-subtle)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                        <input type="checkbox" aria-label={`${pm.name} 선택`} checked={selectedPaymentMethodIds.has(pm.id)} onChange={() => setSelectedPaymentMethodIds((current) => { const next = new Set(current); if (next.has(pm.id)) next.delete(pm.id); else next.add(pm.id); return next; })} onClick={(event) => event.stopPropagation()} />
                        <GripVertical size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', cursor: searchQuery.trim() ? 'not-allowed' : 'grab' }} />
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                    </td>
                    <td className="ledger-cell ledger-cell--start">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem' }}>{pm.emoji || '💳'}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>{pm.name}</span>
                      </div>
                    </td>
                    <td className="ledger-cell ledger-cell--start">
                      <code
                        style={{
                          fontSize: '0.74rem',
                          background: 'var(--ledger-control-bg)',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--surface-border)',
                        }}
                      >
                        {pm.id}
                      </code>
                    </td>
                    <td className="ledger-cell ledger-cell--start">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: `${pm.color || '#3b82f6'}20`,
                          color: pm.color || '#3b82f6',
                          border: `1px solid ${pm.color || '#3b82f6'}50`,
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                        }}
                      >
                        <span>{pm.emoji || '💳'}</span>
                        <span>{pm.name}</span>
                      </span>
                    </td>
                    <td className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {pm.desc || '-'}
                    </td>
                    <td className="ledger-cell ledger-cell--center">
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          background: pm.isDefault ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: pm.isDefault ? '#3b82f6' : '#10b981',
                          border: pm.isDefault ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        {pm.isDefault ? '기본' : '사용자'}
                      </span>
                    </td>
                    <td className="ledger-cell ledger-cell--center">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          onClick={() => openEditPmModal(pm)}
                          className="btn btn-secondary"
                          title="수정"
                          style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeletePaymentMethod(pm.id, pm.name)}
                          className="btn btn-danger"
                          title="삭제"
                          style={{ padding: '5px 8px', fontSize: '0.72rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {activeType === 'PAYMENT_METHOD' && viewMode === 'grid' && (
        filteredPmList.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dark)' }}>
            {searchQuery ? '검색 결과와 일치하는 결제/금융 수단이 없습니다.' : '등록된 결제/금융 수단이 없습니다.'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
              gap: '16px',
            }}
          >
            {filteredPmList.map((pm, idx) => (
              <div
                key={pm.id}
                className="glass-panel"
                draggable={!searchQuery.trim() && !loading}
                onDragStart={(event) => { setDraggedPaymentMethodId(pm.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', pm.id); }}
                onDragOver={(event) => { if (draggedPaymentMethodId) event.preventDefault(); }}
                onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedPaymentMethodId; if (source) void handleDropPaymentMethod(source, pm.id); }}
                onDragEnd={() => setDraggedPaymentMethodId(null)}
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderTop: `3px solid ${pm.color || '#3b82f6'}`,
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  opacity: draggedPaymentMethodId === pm.id ? 0.45 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" aria-label={`${pm.name} 선택`} checked={selectedPaymentMethodIds.has(pm.id)} onChange={() => setSelectedPaymentMethodIds((current) => { const next = new Set(current); if (next.has(pm.id)) next.delete(pm.id); else next.add(pm.id); return next; })} onClick={(event) => event.stopPropagation()} />
                    <GripVertical size={15} aria-label="끌어서 순서 변경" style={{ color: 'var(--text-muted)', cursor: searchQuery.trim() ? 'not-allowed' : 'grab' }} />
                    <span style={{ fontSize: '1.4rem' }}>{pm.emoji || '💳'}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {pm.name}
                      </h4>
                      <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{pm.id}</code>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '2px 7px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      background: pm.isDefault ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: pm.isDefault ? '#3b82f6' : '#10b981',
                      border: pm.isDefault ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    {pm.isDefault ? '기본' : '사용자'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>장부 배지:</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: `${pm.color || '#3b82f6'}20`,
                      color: pm.color || '#3b82f6',
                      border: `1px solid ${pm.color || '#3b82f6'}50`,
                      borderRadius: '5px',
                      padding: '2px 7px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>{pm.emoji || '💳'}</span>
                    <span>{pm.name}</span>
                  </span>
                </div>

                {pm.desc && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {pm.desc}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--surface-border)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => openEditPmModal(pm)}
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit2 size={12} /> 수정
                    </button>
                    <button
                      onClick={() => handleDeletePaymentMethod(pm.id, pm.name)}
                      className="btn btn-danger"
                      style={{ padding: '5px 10px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. 목록형 (List / Table) 뷰 - 시인성 대폭 강화 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeType !== 'PAYMENT_METHOD' && viewMode === 'list' && (
        filteredList.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dark)' }}>
            {searchQuery ? '검색 결과와 일치하는 카테고리가 없습니다.' : '등록된 카테고리가 없습니다.'}
          </div>
        ) : (
          <div className="glass-panel" style={{ overflowX: 'auto', padding: 0, borderRadius: '16px' }}>
            <table className="custom-table ledger-table" style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--ledger-subtle)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '56px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    No.
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ width: '200px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    대분류 (아이콘 / 명칭)
                  </th>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '85px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    구분
                  </th>
                  <th className="ledger-cell ledger-cell--start" style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                    하위 소분류 항목 (클릭 시 삭제 / 인라인 추가)
                  </th>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '90px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    소분류 수
                  </th>
                  <th className="ledger-cell ledger-cell--center" style={{ width: '180px', minWidth: '170px', color: 'var(--text-muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((cat, idx) => {
                  const isAddingSub = addingSubToId === cat.id;

                  return (
                    <tr
                      key={cat.id}
                      draggable={!searchQuery.trim() && !loading}
                      onDragStart={(event) => { setDraggedCategoryId(cat.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', cat.id); }}
                      onDragOver={(event) => { if (draggedCategoryId) event.preventDefault(); }}
                      onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedCategoryId; if (source) void handleDropCategory(source, cat.id); }}
                      onDragEnd={() => setDraggedCategoryId(null)}
                      style={{
                        borderBottom: '1px solid var(--ledger-control-bg)',
                        transition: 'background 0.15s ease',
                        opacity: draggedCategoryId === cat.id ? 0.45 : 1,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ledger-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* 순번 */}
                      <td className="ledger-cell ledger-cell--center" style={{ color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <input type="checkbox" aria-label={`${cat.name} 대분류 선택`} checked={selectedCategoryIds.has(cat.id)} onChange={() => toggleCategorySelection(cat.id)} onClick={(event) => event.stopPropagation()} />
                          <GripVertical size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', cursor: searchQuery.trim() ? 'not-allowed' : 'grab' }} />
                        {String(idx + 1).padStart(2, '0')}
                        </div>
                      </td>

                      {/* 대분류 (컬러 바 + 이모지 + 이름 + 코드) */}
                      <td className="ledger-cell ledger-cell--start">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              background: `${cat.color}22`,
                              border: `1.5px solid ${cat.color}66`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem',
                              flexShrink: 0,
                            }}
                          >
                            {cat.emoji}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: 'var(--text-main)' }}>
                              {cat.name}
                            </div>
                            <div style={{ fontSize: "12px", color: 'var(--text-dark)', fontFamily: 'monospace' }}>
                              {cat.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 구분 (지출 / 수입) */}
                      <td className="ledger-cell ledger-cell--center">
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: cat.type === 'INCOME' ? 'var(--income-bg, rgba(244, 63, 94, 0.15))' : 'var(--expense-bg, rgba(59, 130, 246, 0.15))',
                            color: cat.type === 'INCOME' ? 'var(--income-color, #ef4444)' : "var(--expense-color, #3b82f6)",
                            border: cat.type === 'INCOME' ? '1px solid var(--income-border, rgba(244, 63, 94, 0.3))' : '1px solid var(--expense-border, rgba(59, 130, 246, 0.3))',
                          }}
                        >
                          {cat.type === 'INCOME' ? '수입' : '지출'}
                        </span>
                      </td>

                      {/* 하위 소분류 항목 목록 & 태그 */}
                      <td className="ledger-cell ledger-cell--start">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          {cat.subcategories.map((sub, subIdx) => (
                            <span
                              key={sub}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'var(--ledger-control-bg)',
                                border: '1px solid var(--surface-border)',
                                borderRadius: '6px',
                                padding: '2px 5px',
                                fontSize: "12px",
                                color: 'var(--text-main)',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleMoveSubcategory(cat.id, subIdx, 'left')}
                                disabled={subIdx === 0}
                                title={subIdx === 0 ? '맨 앞입니다' : '왼쪽으로 이동'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '0 1px',
                                  display: 'flex',
                                  cursor: subIdx === 0 ? 'default' : 'pointer',
                                  color: subIdx === 0 ? 'var(--surface-border)' : 'var(--text-muted)',
                                }}
                              >
                                <ChevronLeft size={11} />
                              </button>
                              <span>{sub}</span>
                              <button
                                type="button"
                                onClick={() => handleMoveSubcategory(cat.id, subIdx, 'right')}
                                disabled={subIdx === cat.subcategories.length - 1}
                                title={subIdx === cat.subcategories.length - 1 ? '맨 뒤입니다' : '오른쪽으로 이동'}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '0 1px',
                                  display: 'flex',
                                  cursor: subIdx === cat.subcategories.length - 1 ? 'default' : 'pointer',
                                  color: subIdx === cat.subcategories.length - 1 ? 'var(--surface-border)' : 'var(--text-muted)',
                                }}
                              >
                                <ChevronRight size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubcategory(cat.id, sub)}
                                title={`${sub} 삭제`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: '0 1px',
                                  display: 'flex',
                                  cursor: 'pointer',
                                  color: 'var(--text-dark)',
                                }}
                                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ef4444')}
                                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-dark)')}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}

                          {/* 인라인 소분류 추가 폼 */}
                          {isAddingSub ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="text"
                                autoFocus
                                placeholder="소분류명..."
                                value={newSubName}
                                onChange={(e) => setNewSubName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubcategory(cat.id);
                                  } else if (e.key === 'Escape') {
                                    setAddingSubToId(null);
                                    setNewSubName('');
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  background: 'var(--ledger-control-bg)',
                                  border: '1px solid #10b981',
                                  borderRadius: '6px',
                                  color: 'var(--text-main)',
                                  fontSize: "12px",
                                  width: '110px',
                                  outline: 'none',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSubcategory(cat.id)}
                                className="btn btn-primary"
                                style={{ padding: '4px 8px', fontSize: "12px" }}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingSubToId(null);
                                  setNewSubName('');
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: "12px" }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSubToId(cat.id);
                                setNewSubName('');
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'var(--ledger-subtle)',
                                border: '1px dashed var(--surface-border)',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: "12px",
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#10b981';
                                e.currentTarget.style.color = '#10b981';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--surface-border)';
                                e.currentTarget.style.color = 'var(--text-muted)';
                              }}
                            >
                              <Plus size={12} style={{ flexShrink: 0 }} />
                              <span style={{ whiteSpace: 'nowrap' }}>소분류 추가</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 소분류 수 */}
                      <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            background: 'var(--ledger-control-bg)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat.subcategories.length}개
                        </span>
                      </td>

                      {/* 액션 (위/아래 이동 / 수정 / 삭제) */}
                      <td className="ledger-cell ledger-cell--center" style={{ whiteSpace: 'nowrap', width: '180px', minWidth: '170px' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            title="대분류 수정"
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: "12px",
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                            }}
                          >
                            <Edit2 size={12} style={{ flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap' }}>수정</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                            title="대분류 삭제"
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 8px',
                              fontSize: "12px",
                              color: 'var(--danger)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
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
        )
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. 카드형 (Grid) 뷰 - 보조 뷰 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeType !== 'PAYMENT_METHOD' && viewMode === 'grid' && (
        filteredList.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dark)' }}>
            {searchQuery ? '검색 결과와 일치하는 카테고리가 없습니다.' : '등록된 카테고리가 없습니다.'}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))',
              gap: '16px',
            }}
          >
            {filteredList.map((cat, idx) => {
              const isAddingSub = addingSubToId === cat.id;

              return (
                <div
                  key={cat.id}
                  className="glass-panel"
                  draggable={!searchQuery.trim() && !loading}
                  onDragStart={(event) => { setDraggedCategoryId(cat.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', cat.id); }}
                  onDragOver={(event) => { if (draggedCategoryId) event.preventDefault(); }}
                  onDrop={(event) => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain') || draggedCategoryId; if (source) void handleDropCategory(source, cat.id); }}
                  onDragEnd={() => setDraggedCategoryId(null)}
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    borderTop: `3px solid ${cat.color}`,
                    transition: 'transform 0.15s ease, border-color 0.15s ease',
                    opacity: draggedCategoryId === cat.id ? 0.45 : 1,
                  }}
                >
                  {/* 카드 상단 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input type="checkbox" aria-label={`${cat.name} 대분류 선택`} checked={selectedCategoryIds.has(cat.id)} onChange={() => toggleCategorySelection(cat.id)} onClick={(event) => event.stopPropagation()} />
                      <GripVertical size={15} aria-label="끌어서 순서 변경" style={{ color: 'var(--text-muted)', cursor: searchQuery.trim() ? 'not-allowed' : 'grab' }} />
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: `${cat.color}20`,
                          border: `1px solid ${cat.color}40`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.25rem',
                        }}
                      >
                        {cat.emoji}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.96rem' }}>{cat.name}</span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: cat.type === 'INCOME' ? 'var(--income-bg, rgba(244, 63, 94, 0.15))' : cat.type === 'SAVINGS' ? 'rgba(16, 185, 129, 0.15)' : cat.type === 'TRANSFER' ? 'rgba(139, 92, 246, 0.15)' : 'var(--expense-bg, rgba(59, 130, 246, 0.15))',
                              color: cat.type === 'INCOME' ? 'var(--income-color, #ef4444)' : cat.type === 'SAVINGS' ? '#10b981' : cat.type === 'TRANSFER' ? '#8b5cf6' : "var(--expense-color, #3b82f6)",
                            }}
                          >
                            {cat.type === 'INCOME' ? '수입' : cat.type === 'SAVINGS' ? '저축' : cat.type === 'TRANSFER' ? '이체' : '지출'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                          소분류 {cat.subcategories.length}개
                        </div>
                      </div>
                    </div>

                    {/* 카드 액션 버튼들 */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        title="대분류 수정"
                        className="btn btn-secondary"
                        style={{ padding: '5px 7px', fontSize: '0.72rem' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        title="대분류 삭제"
                        className="btn btn-secondary"
                        style={{ padding: '5px 7px', fontSize: '0.72rem', color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 소분류 목록 & 태그 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      소분류 항목
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {cat.subcategories.map((sub, subIdx) => (
                        <span
                          key={sub}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'var(--ledger-subtle)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleMoveSubcategory(cat.id, subIdx, 'left')}
                            disabled={subIdx === 0}
                            title={subIdx === 0 ? '맨 앞입니다' : '왼쪽으로 이동'}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0 1px',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: subIdx === 0 ? 'default' : 'pointer',
                              color: subIdx === 0 ? 'var(--surface-border)' : 'var(--text-muted)',
                            }}
                          >
                            <ChevronLeft size={11} />
                          </button>
                          <span>{sub}</span>
                          <button
                            type="button"
                            onClick={() => handleMoveSubcategory(cat.id, subIdx, 'right')}
                            disabled={subIdx === cat.subcategories.length - 1}
                            title={subIdx === cat.subcategories.length - 1 ? '맨 뒤입니다' : '오른쪽으로 이동'}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0 1px',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: subIdx === cat.subcategories.length - 1 ? 'default' : 'pointer',
                              color: subIdx === cat.subcategories.length - 1 ? 'var(--surface-border)' : 'var(--text-muted)',
                            }}
                          >
                            <ChevronRight size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubcategory(cat.id, sub)}
                            title={`${sub} 삭제`}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0 1px',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                              color: 'var(--text-dark)',
                              marginLeft: '2px',
                            }}
                            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ef4444')}
                            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-dark)')}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}

                      {/* 소분류 인라인 추가 폼 */}
                      {isAddingSub ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="소분류명..."
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSubcategory(cat.id);
                              } else if (e.key === 'Escape') {
                                setAddingSubToId(null);
                                setNewSubName('');
                              }
                            }}
                            style={{
                              padding: '3px 8px',
                              background: 'var(--ledger-control-bg)',
                              border: '1px solid #10b981',
                              borderRadius: '6px',
                              color: 'var(--text-main)',
                              fontSize: '0.74rem',
                              width: '100px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddSubcategory(cat.id)}
                            className="btn btn-primary"
                            style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubToId(null);
                              setNewSubName('');
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSubToId(cat.id);
                            setNewSubName('');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: 'transparent',
                            border: '1px dashed var(--surface-border)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          <Plus size={12} />
                          <span>소분류 추가</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 대분류 추가 / 수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '26px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {modalMode === 'add' ? '새 카테고리 대분류 등록' : `'${formState.name}' 카테고리 수정`}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 구분 (비용 vs 수입) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  구분 *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, type: 'EXPENSE' })}
                    className={`btn ${formState.type === 'EXPENSE' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '8px 4px', whiteSpace: 'nowrap' }}
                  >
                    🛡️ 지출
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, type: 'INCOME' })}
                    className={`btn ${formState.type === 'INCOME' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '8px 4px', whiteSpace: 'nowrap' }}
                  >
                    💰 수입
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, type: 'SAVINGS' })}
                    className={`btn ${formState.type === 'SAVINGS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '8px 4px', whiteSpace: 'nowrap' }}
                  >
                    🌱 저축·투자
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormState({ ...formState, type: 'TRANSFER' })}
                    className={`btn ${formState.type === 'TRANSFER' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '8px 4px', whiteSpace: 'nowrap' }}
                  >
                    💸 이체
                  </button>
                </div>
              </div>

              {/* 대분류 이름 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  대분류 이름 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 주거비, 식비, 근로소득"
                  value={formState.name}
                  onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                />
              </div>

              {/* 대표 이모지 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  대표 이모지
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.6rem', padding: '4px 10px', background: 'var(--ledger-control-bg)', borderRadius: '8px' }}>
                    {formState.emoji}
                  </span>
                  <input
                    type="text"
                    value={formState.emoji}
                    onChange={(e) => setFormState({ ...formState, emoji: e.target.value })}
                    style={{
                      width: '70px',
                      padding: '8px 10px',
                      textAlign: 'center',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '1rem',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>아래 추천 이모지 클릭 또는 직접 입력</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '90px', overflowY: 'auto', padding: '4px 0' }}>
                  {(PRESET_EMOJIS[formState.type] || PRESET_EMOJIS.EXPENSE).map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setFormState({ ...formState, emoji: emo })}
                      style={{
                        background: formState.emoji === emo ? 'rgba(16, 185, 129, 0.25)' : 'var(--ledger-subtle)',
                        border: formState.emoji === emo ? '1px solid #10b981' : '1px solid var(--surface-border)',
                        borderRadius: '6px',
                        padding: '4px 7px',
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              {/* 테마 색상 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  라벨 색상
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: formState.color,
                      border: '1px solid var(--ledger-control-hover)',
                    }}
                  />
                  <input
                    type="text"
                    value={formState.color}
                    onChange={(e) => setFormState({ ...formState, color: e.target.value })}
                    style={{
                      width: '110px',
                      padding: '7px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_COLORS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setFormState({ ...formState, color: col })}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: col,
                        border: formState.color === col ? '2px solid #fff' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 소분류 목록 (쉼표 구분) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  소분류 목록 (쉼표로 구분하여 입력)
                </label>
                <textarea
                  rows={3}
                  placeholder="예: 관리비, 월세/대출이자, 전기, 가스, 수도"
                  value={formState.subcategoriesInput}
                  onChange={(e) => setFormState({ ...formState, subcategoriesInput: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginTop: '4px', display: 'block' }}>
                  등록 후에도 각 카테고리 카드에서 소분류를 언제든지 추가하거나 삭제할 수 있습니다.
                </span>
              </div>

              {/* 모달 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '저장 중...' : modalMode === 'add' ? '대분류 등록' : '변경사항 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 결제/금융 수단 추가 / 수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPmModal(false);
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              background: 'var(--surface-color)',
              border: '1px solid var(--surface-border)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#3b82f6" />
                {pmModalMode === 'add' ? '새 결제/금융 수단 등록' : `'${pmFormState.name}' 수단 수정`}
              </h3>
              <button
                onClick={() => setShowPmModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePmModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  수단 명칭 * (예: 신한카드, 국민은행, 네이버페이, 현금)
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 신한카드"
                  value={pmFormState.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setPmFormState((prev) => ({
                      ...prev,
                      name: newName,
                    }));
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  식별 코드 / ID (선택: 영문 대문자, 밑줄 등)
                </label>
                <input
                  type="text"
                  placeholder="예: SHINHAN_CARD, CASH (미입력 시 자동 생성)"
                  value={pmFormState.id}
                  disabled={pmModalMode === 'edit'}
                  onChange={(e) => setPmFormState({ ...pmFormState, id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: pmModalMode === 'edit' ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '3px', display: 'block' }}>
                  {pmModalMode === 'edit'
                    ? '식별 코드는 기존 거래 내역과의 데이터 일관성을 위해 수정할 수 없습니다.'
                    : '장부 DB에 저장되는 고유 코드입니다. 비워두면 명칭을 기반으로 자동 생성됩니다.'}
                </span>
              </div>

              {/* 아이콘 이모지 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  아이콘 이모지
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={pmFormState.emoji}
                    onChange={(e) => setPmFormState({ ...pmFormState, emoji: e.target.value })}
                    style={{
                      width: '60px',
                      textAlign: 'center',
                      fontSize: '1.2rem',
                      padding: '6px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    아래 추천 아이콘을 선택하거나 직접 입력하세요.
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_PM_EMOJIS.map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => setPmFormState({ ...pmFormState, emoji: em })}
                      style={{
                        padding: '4px 7px',
                        background: pmFormState.emoji === em ? 'var(--ledger-control-hover)' : 'var(--ledger-control-bg)',
                        border: pmFormState.emoji === em ? '1px solid #3b82f6' : '1px solid var(--surface-border)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* 배지 색상 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  라벨 색상
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: pmFormState.color,
                      border: '1px solid var(--ledger-control-hover)',
                    }}
                  />
                  <input
                    type="text"
                    value={pmFormState.color}
                    onChange={(e) => setPmFormState({ ...pmFormState, color: e.target.value })}
                    style={{
                      width: '100px',
                      padding: '6px 10px',
                      background: 'var(--ledger-control-bg)',
                      border: '1px solid var(--surface-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {PRESET_COLORS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setPmFormState({ ...pmFormState, color: col })}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: col,
                        border: pmFormState.color === col ? '2px solid #fff' : '1px solid transparent',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* 설명 / 메모 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  설명 / 메모 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 개인 신한 체크카드, 급여 통장, 현금 지출"
                  value={pmFormState.desc}
                  onChange={(e) => setPmFormState({ ...pmFormState, desc: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--ledger-control-bg)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              {/* 미리보기 */}
              <div style={{ background: 'var(--ledger-subtle)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  장부 표시 미리보기:
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: `${pmFormState.color}20`,
                    color: pmFormState.color,
                    border: `1px solid ${pmFormState.color}50`,
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                  }}
                >
                  <span>{pmFormState.emoji || '💳'}</span>
                  <span>{pmFormState.name || '미리보기'}</span>
                </span>
              </div>

              {/* 모달 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowPmModal(false)}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '저장 중...' : pmModalMode === 'add' ? '수단 등록' : '변경사항 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
