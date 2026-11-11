'use client';

import LedgerHistoryProvider from '@/components/ledger/LedgerHistory';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import './card-history.css';
import '@/components/ledger/ledger-home.css';
import { isIncomeSensitive } from '@/lib/card-income-privacy';
import MonthlyFixedExpenses from '@/components/ledger/MonthlyFixedExpenses';
import ClubDues from '@/components/ledger/ClubDues';
import CompanyFinance from '@/components/ledger/CompanyFinance';
import TransactionReceipts from '@/components/ledger/TransactionReceipts';
import TransactionDues from '@/components/ledger/TransactionDues';
import TransactionLedger from '@/components/ledger/TransactionLedger';
import CategoryBreakdown from '@/components/ledger/CategoryBreakdown';
import LedgerDialog from '@/components/ledger/LedgerDialog';
import LedgerTutorial from '@/components/ledger/LedgerTutorial';
import { isRecognized, kstDate, SCHEDULED_FIXED_PACKAGE, validMonth } from '@/lib/fixed-expense-schedule';
import MoneyValue from '@/components/ledger/MoneyValue';
import { useScreenSecurity } from '@/components/ScreenSecurity';
import HouseholdCalendar from '@/components/ledger/HouseholdCalendar';
import { useCardListOrder } from '@/hooks/use-card-list-order';
import { ListDragHandle, ListOrderStatus } from '@/components/ledger/ListOrderControls';
import { useCardFilterFields } from '@/hooks/use-card-filter-cookie';
import { compareLedgerTransactions, formatLedgerTimestamp, formatLedgerMerchant, hasImportedPlaceholderTime, type LedgerSortField } from '@/lib/card-ledger-display';
import { formatCellAmount } from '@/lib/ledger-cell';
import { defaultTransactionDate } from '@/lib/transaction-entry';
import {
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  TrendingDown,
  TrendingUp,
  Trash2,
  Calendar as CalendarIcon,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Search,
  SlidersHorizontal,
  Target,
  FileText,
  Edit2,
  ExternalLink,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  HelpCircle,
  Sparkles,
  Table,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  X,
  Plus,
  Minus,
  Sun,
  Moon,
  Repeat,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  UserPlus,
  Settings,
  Users,
  Briefcase,
} from 'lucide-react';
import CategoryManagement from '@/components/ledger/CategoryManagement';
import AssetManagement from '@/components/ledger/AssetManagement';
import FixedExpensesManagement from '@/components/ledger/FixedExpensesManagement';
import BulkTransactionModal from '@/components/ledger/BulkTransactionModal';
import PeriodAnalytics from '@/components/ledger/PeriodAnalytics';
import WealthGoalDashboard from '@/components/ledger/WealthGoalDashboard';
import {
  HouseholdCategory,
  DEFAULT_HOUSEHOLD_CATEGORIES,
  resolveCategoryInfo,
  classifyTransactionRole,
} from '@/lib/household-categories';
import {
  HouseholdPaymentMethod,
  DEFAULT_PAYMENT_METHODS,
  resolvePaymentMethod,
} from '@/lib/payment-methods';

import type { Transaction } from '@/components/ledger/ledger-types';

interface BudgetConfig {
  monthlyTotal: number;
  monthlyFixedIncome?: number;
  categoryBudgets: Record<string, number>;
  updatedAt?: string;
}

const CATEGORY_LIST = [
  { code: 'FOOD', label: '식비', emoji: '🍚', color: '#ff9800', bg: 'rgba(255, 152, 0, 0.15)' },
  { code: 'CAFE', label: '카페/간식', emoji: '☕', color: '#ffb74d', bg: 'rgba(255, 183, 77, 0.15)' },
  { code: 'TRANS', label: '교통', emoji: '🚗', color: '#42a5f5', bg: 'rgba(66, 165, 245, 0.15)' },
  { code: 'SHOPPING', label: '쇼핑', emoji: '🛍️', color: '#ab47bc', bg: 'rgba(171, 71, 188, 0.15)' },
  { code: 'LIVING', label: '주거/통신', emoji: '🏠', color: '#26a69a', bg: 'rgba(38, 166, 154, 0.15)' },
  { code: 'INSURANCE', label: '보험', emoji: '🛡️', color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' },
  { code: 'HEALTH', label: '의료/건강', emoji: '💊', color: 'var(--danger)', bg: 'rgba(239, 83, 80, 0.15)' },
  { code: 'CULTURE', label: '문화/여가', emoji: '🎬', color: '#ec407a', bg: 'rgba(236, 64, 122, 0.15)' },
  { code: 'TRANSFER', label: '이체/송금', emoji: '💸', color: '#26c6da', bg: 'rgba(38, 198, 218, 0.15)' },
  { code: 'OTHER', label: '기타', emoji: '🏷️', color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.15)' },
];

function getCategoryBadge(catCode?: string | null, customCategories?: HouseholdCategory[]) {
  if (!catCode) {
    return { code: 'OTHER', label: '미분류', emoji: '🏷️', color: 'var(--text-muted)', bg: 'var(--ledger-control-bg)' };
  }
  const info = resolveCategoryInfo(catCode, customCategories);
  return {
    code: info.id,
    label: info.label,
    emoji: info.emoji,
    color: info.color,
    bg: `${info.color}25`,
  };
}

function getLocalDateString(date = new Date()) {
  return kstDate(date);
}

function dateInputToKstIso(value: string) {
  const local = value.length === 10 ? `${value}T12:00` : value;
  return new Date(`${local}:00+09:00`).toISOString();
}

function getCurrentMonthString() {
  return kstDate().slice(0, 7);
}

// 모던하고 부드러운 파스텔톤 차트 팔레트
const PASTEL_EXPENSE_COLORS = [
  '#7dd3fc', // 소프트 스카이 (Sky 300)
  '#fda4af', // 소프트 피치 로즈 (Rose 300)
  '#6ee7b7', // 소프트 민트 (Emerald 300)
  '#fde047', // 소프트 레몬 버터 (Yellow 300)
  '#c4b5fd', // 소프트 라벤더 (Violet 300)
  '#fdba74', // 소프트 살구 (Orange 300)
  '#5eead4', // 소프트 아쿠아 (Teal 300)
  '#f9a8d4', // 소프트 캔디 핑크 (Pink 300)
  '#a5b4fc', // 소프트 페리윙클 (Indigo 300)
  '#bef264', // 소프트 세이지 피스타치오 (Lime 300)
  '#e879f9', // 소프트 오키드 (Fuchsia 300)
  '#fca5a5', // 소프트 코랄 (Red 300)
];

const PASTEL_INCOME_COLORS = [
  '#6ee7b7', // 소프트 민트 에메랄드
  '#7dd3fc', // 소프트 스카이 블루
  '#fda4af', // 소프트 피치 로즈
  '#fde047', // 소프트 웜 버터
  '#c4b5fd', // 소프트 라벤더
  '#5eead4', // 소프트 아쿠아
  '#fdba74', // 소프트 살구
  '#a5b4fc', // 소프트 페리윙클
  '#f9a8d4', // 소프트 블러시
];

const PASTEL_SAVINGS_COLORS = ['#34d399', '#2dd4bf', '#4ade80', '#22c55e', '#14b8a6', '#86efac'];

const PIE_CHART_COLORS = PASTEL_EXPENSE_COLORS;

function formatShortWon(val: number) {
  if (Math.abs(val) >= 100000000) return `${(val / 100000000).toFixed(1)}억`;
  if (Math.abs(val) >= 10000) return `${(val / 10000).toFixed(val % 10000 === 0 ? 0 : 1)}만`;
  return val.toLocaleString('ko-KR');
}

function getSourceBadge(app: string) {
  switch (app) {
    case 'WOORI_CARD':
      return <span style={{ background: '#1976d2', color: 'var(--ledger-inverse)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}>우리카드</span>;
    case 'WOORI_WON':
      return <span style={{ background: '#0288d1', color: 'var(--ledger-inverse)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}>우리WON</span>;
    case 'KAKAO_PAY':
      return <span style={{ background: '#fee500', color: '#181600', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700 }}>카카오페이</span>;
    case 'KAKAO_BANK':
      return <span style={{ background: '#ffe600', color: '#000', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 700 }}>카카오뱅크</span>;
    case 'TOSS_BANK':
    case 'TOSS':
      return <span style={{ background: '#0064FF', color: 'var(--ledger-inverse)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}>토스뱅크</span>;
    case 'SMS':
      return <span style={{ background: '#607d8b', color: 'var(--ledger-inverse)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}>SMS</span>;
    default:
      return <span style={{ background: 'var(--ledger-control-bg)', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.73rem' }}>{app}</span>;
  }
}

function HouseholdLedgerContent() {
  const router = useRouter();
  const { screenReady, privateIncome, togglePrivateIncome, lockScreen } = useScreenSecurity();
  const searchParams = useSearchParams();
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialRun, setTutorialRun] = useState(0);
  const tutorialChecked = useRef(false);

  useEffect(() => {
    if (!screenReady || tutorialChecked.current) return;
    tutorialChecked.current = true;
    try {
      setShowTutorial(localStorage.getItem('card-history-tutorial-v1') !== 'seen');
    } catch {
      setShowTutorial(true);
    }
  }, [screenReady]);

  const closeTutorial = () => {
    setShowTutorial(false);
    try { localStorage.setItem('card-history-tutorial-v1', 'seen'); } catch {}
  };
  const [entryInvite, setEntryInvite] = useState(0);
  const [entryDate, setEntryDate] = useState<string | undefined>();
  const [recentSave, setRecentSave] = useState<{ id: string; time: number } | null>(null);
  useEffect(() => {
    if (!recentSave) return;
    const timer = window.setTimeout(() => setRecentSave(null), 4000);
    return () => window.clearTimeout(timer);
  }, [recentSave]);
  const completeTutorial = () => {
    closeTutorial();
    setActiveTab('ledger');
    setEntryInvite(n => n + 1);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };
  // 뷰 탭 상태: analytics(지출분석), calendar(달력), ledger(내역장부), fixed-expenses(고정비용관리), categories(카테고리관리), payment-methods(결제수단관리), assets(자산/카드/통장)
  const [activeTab, setActiveTab] = useState<'analytics' | 'calendar' | 'ledger' | 'fixed-expenses' | 'categories' | 'payment-methods' | 'assets' | 'dues' | 'company' | 'goal'>('analytics');
  const [householdInfo, setHouseholdInfo] = useState<{ id?: string; name: string; type?: 'WEALTH' | 'CLUB' | 'COMPANY'; goalAmount?: number | null } | null>(null);
  const [canEditTransactions, setCanEditTransactions] = useState(false);
  const isClubLedger = householdInfo?.type === 'CLUB';
  const isCompanyLedger = householdInfo?.type === 'COMPANY';
  // 자산 관리·목돈 목표·저축은 개인·가족 가계부에서만 제공한다.
  const isPersonalLedger = !isClubLedger && !isCompanyLedger;
  useEffect(() => {
    let cancelled = false;
    fetch('/api/households').then(response => response.json()).then(data => {
      if (!cancelled) {
        setCanEditTransactions(data.myRole !== 'VIEWER');
        if (data.household) setHouseholdInfo({ id: data.household.id, name: data.household.name, type: data.household.type || 'WEALTH', goalAmount: data.household.goalAmount });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!isPersonalLedger && (activeTab === 'assets' || activeTab === 'goal')) setActiveTab('analytics');
    if (householdInfo && !isClubLedger && activeTab === 'dues') setActiveTab('analytics');
    if (householdInfo && !isCompanyLedger && activeTab === 'company') setActiveTab('analytics');
  }, [isClubLedger, isCompanyLedger, isPersonalLedger, activeTab, householdInfo]);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startMobileMorePress = () => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 700px)').matches) return;
    mobileMoreTimer.current = setTimeout(() => {
      setMobileMoreOpen(true);
    }, 500);
  };
  const endMobileMorePress = () => {
    if (mobileMoreTimer.current) clearTimeout(mobileMoreTimer.current);
    mobileMoreTimer.current = null;
  };
  const closeMobileMore = () => setMobileMoreOpen(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['analytics', 'calendar', 'ledger', 'fixed-expenses', 'categories', 'payment-methods', 'assets', 'dues', 'company', 'goal'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // 조회 기준 월 (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());

  // 🔗 가계부 고유 주소(?household=... 또는 ?w=...)로 접속 시 해당 가계부로 자동 전환
  useEffect(() => {
    const target = searchParams.get('household') || searchParams.get('w');
    if (!target) return;
    fetch('/api/households', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'switch', householdId: target }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // URL 파라미터 정리하고 현재 가계부 새로고침
          window.location.replace('/');
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const copyHouseholdUrl = () => {
    if (!householdInfo?.id) return;
    const url = `${window.location.origin}/?household=${householdInfo.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`가계부 고유 주소가 복사되었습니다.

${url}`);
    }).catch(() => {
      prompt('가계부 고유 주소:', url);
    });
  };

  // 💾 브라우저 개인화 설정 로드 (1. 탭, 2. 보고 있던 달)
  useEffect(() => {
    try {
      // 1. 마지막으로 본 화면 (URL 쿼리 파라미터가 없으면 localStorage에서 복원)
      const tabFromUrl = searchParams.get('tab');
      if (tabFromUrl && ['analytics', 'calendar', 'ledger', 'fixed-expenses', 'categories', 'payment-methods', 'assets', 'dues', 'company', 'goal'].includes(tabFromUrl)) {
        setActiveTab(tabFromUrl as any);
      } else {
        const savedTab = localStorage.getItem('card-history-tab');
        if (savedTab && ['analytics', 'calendar', 'ledger', 'fixed-expenses', 'categories', 'payment-methods', 'assets', 'dues', 'company', 'goal'].includes(savedTab)) {
          setActiveTab(savedTab as any);
        }
      }

      // 2. 보고 있던 달 복원
      const savedMonth = localStorage.getItem('card-history-selected-month');
      if (savedMonth && (/^\d{4}-\d{2}$/.test(savedMonth) || /^\d{4}$/.test(savedMonth))) {
        setSelectedMonth(savedMonth);
      }
    } catch (e) {
      console.warn('Failed to load personalization settings from localStorage:', e);
    }
  }, [searchParams]);

  // 💾 탭 변경 시 localStorage 개인화 저장
  useEffect(() => {
    if (activeTab) {
      try {
        localStorage.setItem('card-history-tab', activeTab);
      } catch {}
    }
  }, [activeTab]);

  // 💾 보고 있던 달(selectedMonth) 변경 시 localStorage 개인화 저장
  useEffect(() => {
    if (selectedMonth) {
      try {
        localStorage.setItem('card-history-selected-month', selectedMonth);
      } catch {}
    }
  }, [selectedMonth]);

  // 데이터 상태
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<any | null>(null);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConfig | null>(null);
  const [categories, setCategories] = useState<HouseholdCategory[]>(DEFAULT_HOUSEHOLD_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState<HouseholdPaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);

  // 필터 상태 (내역장부 탭용)
  const {
    searchQuery: [searchQuery, setSearchQuery],
    typeFilter: [typeFilter, setTypeFilter],
    sourceAppFilter: [sourceAppFilter, setSourceAppFilter],
    categoryFilter: [categoryFilter, setCategoryFilter],
    isReportedFilter: [isReportedFilter, setIsReportedFilter],
    dateSortOrder: [dateSortOrder, setDateSortOrder],
    sortField: [sortField, setSortField],
    specificDateFilter: [specificDateFilter, setSpecificDateFilter],
    cardAccountFilter: [cardAccountFilter, setCardAccountFilter],
  } = useCardFilterFields('card-history-ledger-filters', {
    searchQuery: '', typeFilter: 'ALL', sourceAppFilter: 'ALL', categoryFilter: 'ALL',
    isReportedFilter: 'ALL', dateSortOrder: 'desc' as 'desc' | 'asc',
    specificDateFilter: '', cardAccountFilter: '', sortField: 'notified' as LedgerSortField,
  });

  // 구버전 수신일자 정렬(received) 쿠키값 마이그레이션 -> 거래일자 정렬(notified)로 자동 갱신
  useEffect(() => {
    if ((sortField as string) === 'received') {
      setSortField('notified');
    }
  }, [sortField, setSortField]);

  const [openHeaderFilter, setOpenHeaderFilter] = useState<'date' | 'source' | null>(null);

  // 헤더 필터 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!openHeaderFilter) return;
    const handleClickOutside = () => setOpenHeaderFilter(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openHeaderFilter]);

  // 선택 삭제 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [reportResult, setReportResult] = useState<{ success: boolean; message: string } | null>(null);

  // 모달 상태
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [updating, setUpdating] = useState(false);

  // 달력 클릭 상세 날짜 모달 및 빠른 거래 등록 연동
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);
  const [calendarModalAnchor, setCalendarModalAnchor] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);

  // 수정 폼
  const [editForm, setEditForm] = useState({
    id: '',
    notifiedAt: getLocalDateString(),
    sourceApp: 'MANUAL',
    type: 'PAYMENT',
    amount: '',
    merchant: '',
    category: '',
    cardOrAccount: '',
    content: '',
  });

  // 🔍 화면 확대/축소 (Zoom) 및 🎨 테마 (Theme) 상태
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const previousZoom = document.body.style.zoom;
    document.body.style.zoom = '1';
    try {
      const savedZoom = localStorage.getItem('card-history-zoom');
      if (savedZoom) {
        const val = parseFloat(savedZoom);
        if (!isNaN(val) && val >= 0.6 && val <= 1.4) {
          setZoomLevel(val);
          document.body.style.zoom = `${val}`;
        }
      }
      const savedTheme = localStorage.getItem('card-history-theme') as 'dark' | 'light' | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (e) {
      console.warn('Failed to load zoom or theme from localStorage:', e);
    }
    return () => { document.body.style.zoom = previousZoom; };
  }, []);


  const handleZoomIn = () => {
    setZoomLevel((prev) => {
      const next = Math.min(1.30, Math.round((prev + 0.05) * 100) / 100);
      try {
        document.body.style.zoom = `${next}`;
        localStorage.setItem('card-history-zoom', String(next));
      } catch {}
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(0.65, Math.round((prev - 0.05) * 100) / 100);
      try {
        document.body.style.zoom = `${next}`;
        localStorage.setItem('card-history-zoom', String(next));
      } catch {}
      return next;
    });
  };

  const handleResetZoom = () => {
    const defaultVal = 1;
    setZoomLevel(defaultVal);
    try {
      document.body.style.zoom = `${defaultVal}`;
      localStorage.setItem('card-history-zoom', String(defaultVal));
    } catch {}
  };

  // 달력 팝업 모달: ESC 키 닫기 이벤트 리스너
  useEffect(() => {
    if (!calendarSelectedDate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCalendarSelectedDate(null);
        setCalendarModalAnchor(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calendarSelectedDate]);

  // 달력 모달: 선택한 셀에 따른 상대 위치 동적 계산
  const calendarPopupPos = useMemo(() => {
    if (!calendarModalAnchor || typeof window === 'undefined') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(420px, calc(100vw - 32px))',
      };
    }

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'calc(100vw - 32px)',
        maxWidth: '420px',
      };
    }

    const popupWidth = Math.min(420, window.innerWidth - 32);
    const popupEstHeight = 360;

    // 가로 상대 위치: 오른쪽 화면 경계 벗어나면 셀 오른쪽 기준 정렬
    let left = calendarModalAnchor.left;
    if (calendarModalAnchor.left + popupWidth > window.innerWidth - 24) {
      left = calendarModalAnchor.right - popupWidth;
    }
    if (left < 16) left = 16;
    if (left + popupWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - popupWidth - 16);
    }

    // 세로 상대 위치: 하단 공간 부족 시 셀 상단에 배치
    const spaceBelow = window.innerHeight - calendarModalAnchor.bottom;
    const spaceAbove = calendarModalAnchor.top;
    let top = calendarModalAnchor.bottom + 8;

    if (spaceBelow < 280 && spaceAbove > spaceBelow) {
      top = Math.max(16, calendarModalAnchor.top - popupEstHeight - 8);
    } else {
      if (top + popupEstHeight > window.innerHeight - 16) {
        top = Math.max(16, window.innerHeight - popupEstHeight - 16);
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${popupWidth}px`,
    };
  }, [calendarModalAnchor]);

  const handleSetTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    try {
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('admin-theme', newTheme);
      localStorage.setItem('card-history-theme', newTheme);
    } catch {}
  };

  // 1. 거래 목록 조회
  const transactionRequestId = useRef(0);
  const fetchTransactions = useCallback(async () => {
    const requestId = ++transactionRequestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (selectedMonth && selectedMonth !== 'ALL') {
        if (/^\d{4}$/.test(selectedMonth)) {
          params.set('year', selectedMonth);
        } else {
          params.set('month', selectedMonth);
        }
      }
      params.set('limit', '2000');

      const records: Transaction[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        params.set('page', String(page));
        const res = await fetch(`/api/card-transactions?${params.toString()}&_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('거래 목록 조회 실패');
        const data = await res.json();
        if (requestId !== transactionRequestId.current) return;
        records.push(...(data.transactions || []));
        totalPages = data.totalPages || 1;
        page++;
      } while (page <= totalPages);
      setTransactions([...new Map(records.map(tx => [tx.id, tx])).values()]);
      setSelectedIds(new Set());
    } catch (err: any) {
      if (requestId === transactionRequestId.current) { setLoadError('거래 내역을 불러오지 못했습니다. 다시 시도해 주세요.'); setTransactions([]); }
    } finally {
      if (requestId === transactionRequestId.current) setLoading(false);
    }
  }, [selectedMonth]);

  // 결제/금융 수단 외 트랜잭션에 존재하는 추가 sourceApp 수집
  const extraSourceApps = useMemo(() => {
    const pmIds = new Set(paymentMethods.map((p) => p.id));
    const extras = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.sourceApp && !pmIds.has(tx.sourceApp)) {
        extras.add(tx.sourceApp);
      }
    });
    return Array.from(extras);
  }, [transactions, paymentMethods]);

  // 테이블 표시용 필터 및 정렬 적용 목록 (현재 로드된 데이터 내에서 100% 클라이언트 메모리 즉각 필터링)
  const filteredTransactions = useMemo(() => {
    let list = transactions.filter(tx => !tx.fixedExpenseId && !tx.scheduledFor && tx.packageName !== SCHEDULED_FIXED_PACKAGE);

    // 1. 검색어 필터 (지출처, 내용, 카드/계좌명, 제목, 카테고리)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((tx) =>
        (tx.merchant || '').toLowerCase().includes(q) ||
        (tx.content || '').toLowerCase().includes(q) ||
        (tx.cardOrAccount || '').toLowerCase().includes(q) ||
        (tx.title || '').toLowerCase().includes(q) ||
        (tx.category || '').toLowerCase().includes(q)
      );
    }

    // 2. 구분(유형) 필터 (ALL, PAYMENT, CANCEL, DEPOSIT, TRANSFER 등)
    if (typeFilter && typeFilter !== 'ALL') {
      list = list.filter((tx) => tx.type === typeFilter);
    }

    // 3. 결제수단 / 금융앱 필터
    if (sourceAppFilter && sourceAppFilter !== 'ALL') {
      const method = paymentMethods.find((item) => item.id === sourceAppFilter);
      list = list.filter((tx) => tx.sourceApp === sourceAppFilter
        || tx.cardOrAccount === sourceAppFilter
        || Boolean(method && (tx.sourceApp === method.name || tx.cardOrAccount === method.name)));
    }

    // 4. 카테고리 필터
    if (categoryFilter && categoryFilter !== 'ALL') {
      list = list.filter((tx) => resolveCategoryInfo(tx.category, categories).id === resolveCategoryInfo(categoryFilter, categories).id);
    }

    // 5. 슬랙 전송 보고 상태 필터
    if (isReportedFilter && isReportedFilter !== 'ALL') {
      const wantReported = isReportedFilter === 'true';
      list = list.filter((tx) => tx.isReported === wantReported);
    }

    // 6. 특정 일자 필터 (YYYY-MM-DD)
    if (specificDateFilter) {
      list = list.filter((tx) => {
        return kstDate(tx.notifiedAt) === specificDateFilter;
      });
    }

    // 7. 카드/계좌 검색 필터
    if (cardAccountFilter.trim()) {
      const q = cardAccountFilter.trim().toLowerCase();
      list = list.filter((tx) => (tx.cardOrAccount || '').toLowerCase().includes(q));
    }

    // 8. 정렬
    list.sort((a, b) => compareLedgerTransactions(a, b, sortField, dateSortOrder));
    return list;
  }, [
    transactions,
    searchQuery,
    typeFilter,
    sourceAppFilter,
    paymentMethods,
    categoryFilter,
    categories,
    isReportedFilter,
    specificDateFilter,
    cardAccountFilter,
    dateSortOrder,
    sortField,
  ]);

  const ledgerOrder = useCardListOrder('ledger',
    [...transactions].sort((a, b) => compareLedgerTransactions(a, b, sortField, dateSortOrder)),
    filteredTransactions);
  const displayTransactions = ledgerOrder.ordered;
  const ledgerVisibleIds = displayTransactions.map((tx) => tx.id);

  const ledgerTotals = useMemo(() => {
    let expense = 0;
    let income = 0;
    let savings = 0;
    let transfer = 0;
    for (const tx of transactions) {
      const role = classifyTransactionRole(tx);
      if (role === 'INCOME') {
        income += tx.amount;
      } else if (role === 'SAVINGS') {
        if (tx.type === 'CANCEL') {
          savings -= tx.amount;
        } else {
          savings += tx.amount;
        }
      } else if (role === 'TRANSFER') {
        transfer += tx.amount;
      } else {
        if (tx.type === 'CANCEL') {
          expense -= tx.amount;
        } else {
          expense += tx.amount;
        }
      }
    }
    const net = expense - income;
    return {
      expense: Math.max(0, expense),
      income,
      savings: Math.max(0, savings),
      transfer,
      net,
    };
  }, [transactions]);

  const currentSavingsRate = useMemo(() => {
    const inc = ledgerTotals.income > 0 ? ledgerTotals.income : (budgetConfig?.monthlyFixedIncome || 0);
    if (inc <= 0) return 0;
    return Number(((ledgerTotals.savings / inc) * 100).toFixed(1));
  }, [ledgerTotals.income, ledgerTotals.savings, budgetConfig?.monthlyFixedIncome]);
  const handleSortColumn = (field: LedgerSortField, defaultOrder: 'asc' | 'desc' = 'desc') => {
    if (ledgerOrder.disabled) return;
    if (ledgerOrder.custom) ledgerOrder.reset();
    if (sortField === field) {
      setDateSortOrder(dateSortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setDateSortOrder(defaultOrder);
    }
  };

  // 2. 월간 통계 및 리포트 데이터 조회
  const fetchMonthlyStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const targetMonth = selectedMonth.includes('-') ? selectedMonth : `${selectedMonth}-01`;
      const res = await fetch(`/api/cron/card-transactions/monthly-report?month=${targetMonth}&preview=true&_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.report) {
          setMonthlyStats(data.report);
        }
      }
    } catch (err) {
      console.error('Failed to fetch monthly stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedMonth]);

  // 3. 예산 설정 조회 (지출 분석 & 통계 탭의 고정 수입 연동용)
  const fetchBudget = useCallback(async () => {
    try {
      const res = await fetch('/api/card-transactions/budget');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.budget) {
          setBudgetConfig(data.budget);
        }
      }
    } catch (err) {
      console.error('Failed to fetch budget:', err);
    }
  }, []);

  // 4. 카테고리 목록 조회 (비용 22종, 수입 8종 대분류/소분류)
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/card-transactions/categories');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // 5. 결제/금융 수단 목록 조회
  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/card-transactions/payment-methods');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.paymentMethods)) {
          setPaymentMethods(data.paymentMethods);
        }
      }
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchMonthlyStats();
    fetchBudget();
    fetchCategories();
    fetchPaymentMethods();
  }, [fetchTransactions, fetchMonthlyStats, fetchBudget, fetchCategories, fetchPaymentMethods]);

  useEffect(() => {
    let date = kstDate();
    const check = () => {
      const next = kstDate();
      if (next !== date) { date = next; void fetchTransactions(); void fetchMonthlyStats(); setStatsRefreshKey(k => k + 1); }
    };
    const timer = window.setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [fetchTransactions, fetchMonthlyStats]);

  // 월 이동
  const handlePrevMonth = () => {
    if (!selectedMonth.includes('-')) {
      const y = parseInt(selectedMonth, 10);
      setSelectedMonth(`${y - 1}-12`);
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevY = d.getFullYear();
    const prevM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${prevY}-${prevM}`);
  };

  const handleNextMonth = () => {
    if (!selectedMonth.includes('-')) {
      const y = parseInt(selectedMonth, 10);
      setSelectedMonth(`${y + 1}-01`);
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(getCurrentMonthString());
  };

  // 주요 지출처 클릭 시 거래 내역 장부로 이동
  const handleSelectMerchant = (merchant: string, yearOrMonth?: string) => {
    if (yearOrMonth) {
      setSelectedMonth(yearOrMonth);
    }
    setSearchQuery(merchant);
    setActiveTab('ledger');
  };

  // 장부 항목 인라인 클릭 수정 상태
  const [inlineEdit, setInlineEdit] = useState<{
    id: string;
    field: 'date' | 'merchant' | 'content' | 'amount' | 'balance';
    value: string;
  } | null>(null);

  // 통합 인라인 필드 수정 (사용처, 금액, 내용, 일시, 구분, 결제수단, 잔액 등)
  const handleInlineUpdate = async (id: string, updates: Record<string, any>) => {
    try {
      const res = await fetch('/api/card-transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
        );
        fetchMonthlyStats();
        setStatsRefreshKey((k) => k + 1);
        return true;
      } else {
        alert(data.error || '항목 수정 실패');
        return false;
      }
    } catch (e: any) {
      alert(e.message || '항목 수정 중 오류가 발생했습니다.');
      return false;
    }
  };

  // 카테고리 인라인 수정
  const handleUpdateCategory = async (id: string, newCategory: string) => {
    await handleInlineUpdate(id, { category: newCategory });
  };

  // 거래 내역 전체 수정 제출
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amountNum = parseInt(editForm.amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(amountNum) || amountNum < 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch('/api/card-transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          amount: amountNum,
          merchant: editForm.merchant.trim() || null,
          category: editForm.category.trim() || null,
          type: editForm.type,
          cardOrAccount: editForm.cardOrAccount.trim() || null,
          content: editForm.content.trim(),
          sourceApp: editForm.sourceApp,
          notifiedAt: dateInputToKstIso(editForm.notifiedAt),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수정 실패');

      setReportResult({ success: true, message: '거래 내역이 수정되었습니다.' });
      setShowEditModal(false);
      setEditingTx(null);
      handleCellSaved(data.transaction);
      setStatsRefreshKey((k) => k + 1);
    } catch (err: any) {
      alert(err.message || '거래 수정 중 오류가 발생했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  // 2단계 원클릭 액티브 / 2회 클릭 삭제 제어 (알럿 팝업 배제 & AJAX 비동기 통신)
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);

  // 활성 삭제 버튼 3.5초 후 자동 원복
  useEffect(() => {
    if (!activeDeleteId) return;
    const timer = setTimeout(() => {
      setActiveDeleteId(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [activeDeleteId]);

  const handleDeleteOne = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 1회 클릭 시: 휴지통 액티브 활성화
    if (activeDeleteId !== id) {
      setActiveDeleteId(id);
      return;
    }

    // 2회 클릭 시: 알럿 없이 즉시 AJAX 삭제 진행
    setActiveDeleteId(null);
    const prevList = transactions;
    // 낙관적 UI 업데이트 (새로고침 없이 즉시 화면에서 항목 제거)
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    try {
      const res = await fetch(`/api/card-transactions?id=${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportResult({ success: true, message: '거래 내역이 삭제되었습니다.' });
        fetchMonthlyStats();
        setStatsRefreshKey((k) => k + 1);
      } else {
        // 실패 시 복구
        setTransactions(prevList);
        setReportResult({ success: false, message: data.error || '삭제 실패' });
      }
    } catch (e: any) {
      setTransactions(prevList);
      setReportResult({ success: false, message: e.message || '네트워크 오류' });
    }
  };

  // 선택 일괄 삭제 2단계 확인 상태
  const [activeBulkDelete, setActiveBulkDelete] = useState(false);

  useEffect(() => {
    if (!activeBulkDelete) return;
    const timer = setTimeout(() => setActiveBulkDelete(false), 3500);
    return () => clearTimeout(timer);
  }, [activeBulkDelete]);

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!activeBulkDelete) {
      setActiveBulkDelete(true);
      return;
    }
    setActiveBulkDelete(false);
    setDeleting(true);
    const toDeleteIds = new Set(selectedIds);
    const prevList = transactions;
    // 낙관적 UI 업데이트 (새로고침 없이 화면에서 즉시 제거)
    setTransactions((prev) => prev.filter((t) => !toDeleteIds.has(t.id)));
    setSelectedIds(new Set());

    try {
      const res = await fetch('/api/card-transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(toDeleteIds) }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportResult({ success: true, message: `${data.count}건의 내역이 삭제되었습니다.` });
        fetchMonthlyStats();
        setStatsRefreshKey((k) => k + 1);
      } else {
        setTransactions(prevList);
        setReportResult({ success: false, message: data.error || '삭제 실패' });
      }
    } catch (e: any) {
      setTransactions(prevList);
      setReportResult({ success: false, message: e.message || '네트워크 오류' });
    } finally {
      setDeleting(false);
    }
  };


  // 달력 뷰용 계산
  const calendarData = useMemo(() => {
    const monthStr = selectedMonth.includes('-') ? selectedMonth : `${selectedMonth}-01`;
    const [y, m] = monthStr.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1).getDay(); // 0(일) ~ 6(토)
    const lastDate = new Date(y, m, 0).getDate();

    // 일별 거래 매핑
    const dayMap = new Map<number, { expense: number; income: number; savings: number; txs: Transaction[] }>();
    for (let d = 1; d <= lastDate; d++) {
      dayMap.set(d, { expense: 0, income: 0, savings: 0, txs: [] });
    }

    for (const tx of transactions) {
      if (!isRecognized(tx)) continue;
      const dayNum = Number(kstDate(tx.notifiedAt).slice(8, 10));
      const entry = dayMap.get(dayNum);
      if (entry) {
        entry.txs.push(tx);
        const role = classifyTransactionRole(tx);
        if (role === 'INCOME') {
          entry.income += tx.amount;
        } else if (role === 'SAVINGS') {
          entry.savings += tx.amount;
        } else if (role === 'CONSUMPTION') {
          if (tx.type === 'CANCEL') {
            entry.expense -= tx.amount;
          } else {
            entry.expense += tx.amount;
          }
        }
      }
    }

    return {
      year: y,
      month: m,
      firstDay,
      lastDate,
      dayMap,
    };
  }, [selectedMonth, transactions]);

  // 일별 차트용 데이터
  const dailyChartData = useMemo(() => {
    if (!calendarData) return [];
    const list = [];
    for (let d = 1; d <= calendarData.lastDate; d++) {
      const data = calendarData.dayMap.get(d);
      list.push({
        day: `${d}일`,
        지출: Math.max(0, data?.expense || 0),
        수입: Math.max(0, data?.income || 0),
      });
    }
    return list;
  }, [calendarData]);

  // 월간 일별 지출 타임라인 데이터
  const timelineDays = useMemo(() => {
    if (!calendarData) return [];
    const [y, m] = (selectedMonth.includes('-') ? selectedMonth : `${selectedMonth}-01`).split('-').map(Number);
    const list = [];
    for (let d = 1; d <= calendarData.lastDate; d++) {
      const data = calendarData.dayMap.get(d);
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(y, m - 1, d).getDay();
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek];
      const savings = data?.savings || 0;
      const expense = data?.expense || 0;
      const income = data?.income || 0;
      const formattedSavings = savings >= 10000
        ? `${(savings / 10000).toFixed(savings % 10000 === 0 ? 0 : 1)}만`
        : savings > 0 ? savings.toLocaleString() : '';
      const formattedExpense = expense >= 10000
        ? `${(expense / 10000).toFixed(expense % 10000 === 0 ? 0 : 1)}만`
        : expense > 0 ? expense.toLocaleString() : '-';
      const formattedIncome = income >= 10000
        ? `${Math.round(income / 10000)}만`
        : income > 0 ? income.toLocaleString() : '';
      list.push({
        day: d,
        dateStr,
        dayOfWeek,
        dayName,
        savings,
        expense,
        income,
        formattedSavings,
        formattedExpense,
        formattedIncome,
        txCount: data?.txs.length || 0,
      });
    }
    return list;
  }, [calendarData, selectedMonth]);

  // 카테고리별 지출 및 수입 집계 요약
  const categorySummary = useMemo(() => {
    const expenseMap = new Map<string, number>();
    const incomeMap = new Map<string, number>();
    const savingsMap = new Map<string, number>();
    let totalExpense = 0;
    let totalIncome = 0;

    for (const tx of transactions) {
      if (!isRecognized(tx)) continue;
      const role = classifyTransactionRole(tx);
      const cat = tx.category || '미분류';
      const categoryType = resolveCategoryInfo(cat, categories).type;
      if (role === 'SAVINGS' || categoryType === 'SAVINGS') {
        const amount = tx.type === 'CANCEL' ? -tx.amount : tx.amount;
        savingsMap.set(cat, (savingsMap.get(cat) || 0) + amount);
      } else if (role === 'CONSUMPTION') {
        const amt = tx.type === 'CANCEL' ? -tx.amount : tx.amount;
        expenseMap.set(cat, (expenseMap.get(cat) || 0) + amt);
        totalExpense += amt;
      } else if (role === 'INCOME') {
        incomeMap.set(cat, (incomeMap.get(cat) || 0) + tx.amount);
        totalIncome += tx.amount;
      }
    }

    const rawExpenseList = Array.from(expenseMap.entries())
      .map(([cat, amount]) => {
        const info = resolveCategoryInfo(cat, categories);
        return {
          name: cat,
          label: info.label,
          emoji: info.emoji,
          amount: Math.max(0, amount),
          percent: totalExpense > 0 ? (Math.max(0, amount) / totalExpense) * 100 : 0,
        };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const expenseList = rawExpenseList.map((item, idx) => ({
      ...item,
      color: PASTEL_EXPENSE_COLORS[idx % PASTEL_EXPENSE_COLORS.length],
    }));

    const rawIncomeList = Array.from(incomeMap.entries())
      .map(([cat, amount]) => {
        const info = resolveCategoryInfo(cat, categories);
        return {
          name: cat,
          label: info.label,
          emoji: info.emoji,
          amount,
          percent: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
        };
      })
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const incomeList = rawIncomeList.map((item, idx) => ({
      ...item,
      color: PASTEL_INCOME_COLORS[idx % PASTEL_INCOME_COLORS.length],
    }));

    const netSavingsByCategory = Array.from(savingsMap.entries())
      .map(([name, amount]) => ({ name, amount: Math.max(0, amount) }))
      .filter(item => item.amount > 0);
    const totalSavings = netSavingsByCategory.reduce((sum, item) => sum + item.amount, 0);
    const savingsList = netSavingsByCategory
      .map(({ name: cat, amount }) => {
        const info = resolveCategoryInfo(cat, categories);
        return { name: cat, label: info.label, emoji: info.emoji, amount,
          percent: totalSavings > 0 ? (amount / totalSavings) * 100 : 0 };
      })
      .filter(item => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((item, idx) => ({ ...item, color: PASTEL_SAVINGS_COLORS[idx % PASTEL_SAVINGS_COLORS.length] }));

    const expensePieData = expenseList.length <= 6
      ? expenseList
      : [
          ...expenseList.slice(0, 5),
          {
            name: '기타',
            label: '기타',
            emoji: '📦',
            color: '#94a3b8',
            amount: expenseList.slice(5).reduce((s, c) => s + c.amount, 0),
            percent: totalExpense > 0 ? (expenseList.slice(5).reduce((s, c) => s + c.amount, 0) / totalExpense) * 100 : 0,
          },
        ];

    const incomePieData = incomeList.length <= 6
      ? incomeList
      : [
          ...incomeList.slice(0, 5),
          {
            name: '기타',
            label: '기타',
            emoji: '📦',
            color: '#94a3b8',
            amount: incomeList.slice(5).reduce((s, c) => s + c.amount, 0),
            percent: totalIncome > 0 ? (incomeList.slice(5).reduce((s, c) => s + c.amount, 0) / totalIncome) * 100 : 0,
          },
        ];

    const savingsPieData = savingsList.length <= 6
      ? savingsList
      : [
          ...savingsList.slice(0, 5),
          {
            name: '기타', label: '기타', emoji: '📦', color: '#94a3b8',
            amount: savingsList.slice(5).reduce((sum, item) => sum + item.amount, 0),
            percent: totalSavings > 0 ? (savingsList.slice(5).reduce((sum, item) => sum + item.amount, 0) / totalSavings) * 100 : 0,
          },
        ];

    return { expenseList, incomeList, savingsList, expensePieData, incomePieData, savingsPieData, totalExpense, totalIncome, totalSavings };
  }, [transactions, categories]);

  // 카테고리 차트용 데이터
  const categoryChartData = useMemo(() => {
    if (!monthlyStats?.categoryBreakdown) return [];
    return monthlyStats.categoryBreakdown.map((c: any) => {
      const cat = getCategoryBadge(c.code, categories);
      return {
        name: c.label,
        amount: c.amount,
        percentage: c.percentage,
        color: cat.color,
      };
    });
  }, [monthlyStats, categories]);

  const handleCellSaved = (updated: Transaction) => {
    ++transactionRequestId.current; // Discard reads started before this committed write.
    setLoading(false);
    // Update locally to retain the selected cell and refresh derived statistics.
    setTransactions(current => {
      const date = kstDate(updated.notifiedAt);
      const inPeriod = !selectedMonth || selectedMonth === 'ALL' || date.startsWith(selectedMonth);
      const next = current.filter(item => item.id !== updated.id);
      const previous = current.find(item => item.id === updated.id);
      return inPeriod && isRecognized(updated) ? [...next, { ...previous, ...updated }] : next;
    });
    void fetchMonthlyStats();
  };
  const handleHistoryDeleted = (ids: string[]) => {
    ++transactionRequestId.current;
    const removed = new Set(ids);
    setLoading(false);
    setTransactions(current => current.filter(item => !removed.has(item.id)));
    setSelectedIds(current => new Set([...current].filter(id => !removed.has(id))));
    void fetchMonthlyStats(); setStatsRefreshKey(key => key + 1);
  };
  const refreshLedger = () => { void fetchTransactions(); void fetchMonthlyStats(); setStatsRefreshKey(k => k + 1); };
  const openTransactionEditor = (tx: Transaction) => {
    setEditingTx(tx);
    setEditForm({ id: tx.id, notifiedAt: kstDate(tx.notifiedAt), sourceApp: tx.sourceApp, type: tx.type, amount: formatCellAmount(String(tx.amount)), merchant: tx.merchant || '', category: tx.category || '', cardOrAccount: tx.cardOrAccount || '', content: tx.content });
    setShowEditModal(true);
  };
  const filterCount = [searchQuery.trim(), typeFilter !== 'ALL', sourceAppFilter !== 'ALL', categoryFilter !== 'ALL', isReportedFilter !== 'ALL', specificDateFilter, cardAccountFilter.trim()].filter(Boolean).length;
  const clearLedgerFilters = () => { setSearchQuery(''); setTypeFilter('ALL'); setSourceAppFilter('ALL'); setCategoryFilter('ALL'); setIsReportedFilter('ALL'); setSpecificDateFilter(''); setCardAccountFilter(''); };
  const openQuickEntry = (date?: string) => {
    const targetDate = date || defaultTransactionDate(selectedMonth);
    clearLedgerFilters(); setEntryDate(targetDate);
    setSelectedMonth(targetDate.slice(0, 7)); setActiveTab('ledger');
    setEntryInvite(Date.now());
  };


  return (
    <div className="card-history-app ledger-home" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <header className="ledger-workspace-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="ledger-brand-trigger" aria-label="길게 눌러 추가 메뉴 열기" aria-haspopup="menu" aria-expanded={mobileMoreOpen} onClick={event => { if (event.detail === 0) setMobileMoreOpen(open => !open); }} onPointerDown={startMobileMorePress} onPointerUp={endMobileMorePress} onPointerCancel={endMobileMorePress} onPointerLeave={endMobileMorePress} onContextMenu={event => { event.preventDefault(); setMobileMoreOpen(true); }}>
              <h1><Wallet size={25} aria-hidden="true" />{householdInfo?.name || '가계부'}</h1>
            </button>
            {householdInfo?.type && (
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'var(--ledger-control-bg)', color: 'var(--text-muted)', border: '1px solid var(--surface-border)', letterSpacing: '0.02em' }}>
                {householdInfo.type === 'COMPANY' ? '회사' : householdInfo.type === 'CLUB' ? '모임' : '가족'}
              </span>
            )}
          </div>
        </div>
        <div className="ledger-primary-actions">
          <button data-ledger-tour="entry" className="btn btn-primary" onClick={() => openQuickEntry()}><PlusCircle size={17}/>거래 추가</button>
          <button className="btn btn-secondary ledger-manage-button" onClick={() => router.push('/workspace')}><Users size={18}/>가계부 관리</button>
          <button className="btn btn-secondary ledger-icon-button" aria-label={privateIncome ? '프라이버시 모드 끄기' : '프라이버시 모드 켜기'} title="수입 가리기" aria-pressed={privateIncome} onClick={togglePrivateIncome} style={{ color: privateIncome ? 'var(--warning)' : 'var(--text-muted)', background: privateIncome ? 'var(--ledger-warning-soft)' : undefined }}><Eye size={18}/></button>
          <button className="btn btn-secondary ledger-icon-button" aria-label="화면 잠금" title="화면 잠금" onClick={() => void lockScreen()}><LockKeyhole size={18}/></button>
          <button className="btn btn-secondary ledger-icon-button" aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'} title={theme === 'dark' ? '라이트 모드' : '다크 모드'} onClick={() => handleSetTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <button data-ledger-tour="help" type="button" className="btn btn-secondary ledger-icon-button" aria-label="가계부 도움말" title="튜토리얼 다시 보기" onClick={() => { closeMobileMore(); setTutorialRun(run => run + 1); setShowTutorial(true); }}><HelpCircle size={18}/></button>
          <details className="ledger-menu"><summary className="btn btn-secondary">더보기 <ChevronDown size={14}/></summary><div className="ledger-menu-content">
            <button onClick={() => setShowBulkModal(true)}>여러 거래 붙여넣기</button>
            {isPersonalLedger && <button onClick={event => { setActiveTab('goal'); event.currentTarget.closest('details')?.removeAttribute('open'); }}>목돈 목표 · 부가 기능</button>}
            <button onClick={handleLogout}>로그아웃</button>
            <button onClick={refreshLedger}>새로고침</button>
            <button onClick={copyHouseholdUrl}>가계부 고유 주소 복사</button>
            <button onClick={() => router.push('/workspace')}>가계부 초대·구성원 관리</button>
            <button onClick={() => router.push('/workspace?tab=settings')}>가계부 설정</button>
            <button onClick={() => router.push('/mypage')}>마이페이지 · 계정 관리</button>
            <div className="ledger-menu-zoom"><button aria-label="화면 축소" onClick={handleZoomOut}>−</button><button aria-label="기본 배율로 복원" onClick={handleResetZoom}>{Math.round(zoomLevel * 100)}%</button><button aria-label="화면 확대" onClick={handleZoomIn}>+</button></div>
          </div></details>
        </div>
      </header>
      {showTutorial && screenReady && <LedgerTutorial isClubLedger={!isPersonalLedger} key={tutorialRun} onClose={closeTutorial} onComplete={completeTutorial} activeTab={activeTab} onNavigate={setActiveTab}/>}
      <div className="ledger-mobile-more-menu" role="menu" aria-label="추가 메뉴" hidden={!mobileMoreOpen}>
        <button role="menuitem" onClick={() => { closeMobileMore(); setShowBulkModal(true); }}>여러 거래 붙여넣기</button>
        <button role="menuitem" onClick={() => { closeMobileMore(); refreshLedger(); }}>새로고침</button>
        {isPersonalLedger && <button role="menuitem" onClick={() => { closeMobileMore(); setActiveTab('goal'); }}>목돈 목표 · 부가 기능</button>}
        <button role="menuitem" onClick={() => { closeMobileMore(); copyHouseholdUrl(); }}>가계부 고유 주소 복사</button>
        <button role="menuitem" onClick={() => { closeMobileMore(); router.push('/mypage'); }}>마이페이지 · 계정 관리</button>
        <button role="menuitem" onClick={handleLogout}>로그아웃</button>
        <div className="ledger-menu-zoom"><button aria-label="화면 축소" onClick={handleZoomOut}>−</button><button aria-label="기본 배율로 복원" onClick={handleResetZoom}>{Math.round(zoomLevel * 100)}%</button><button aria-label="화면 확대" onClick={handleZoomIn}>+</button></div>
      </div>
      <div className="ledger-workspace-toolbar">
        <nav className="ledger-main-nav" aria-label="가계부 메뉴">
          <div data-ledger-tour="review" className="ledger-nav-primary" aria-label="주요 메뉴">
            {([
              ['analytics', '분석', <BarChart3 key="analytics" size={16} aria-hidden="true"/>],
              ['ledger', '거래내역', <Table key="ledger" size={16} aria-hidden="true"/>],
              ...(isCompanyLedger ? [['company', '세금계산서·예측', <Briefcase key="company" size={16} aria-hidden="true"/>] as const] : []),
              ...(isClubLedger ? [['dues', '회비 관리', <Users key="dues" size={16} aria-hidden="true"/>] as const] : []),
              ['calendar', '달력', <CalendarIcon key="calendar" size={16} aria-hidden="true"/>],
            ] as const).map(([id, label, icon]) => (
              <button
                key={id}
                className={activeTab === id ? 'is-active' : ''}
                aria-current={activeTab === id ? 'page' : undefined}
                onClick={() => setActiveTab(id)}
              >
                {icon}<span>{label}</span>
              </button>
            ))}
          </div>
          <span className="ledger-nav-divider" aria-hidden="true" />
          <div data-ledger-tour="manage" className="ledger-nav-secondary" aria-label="관리 메뉴">{([
            ['fixed-expenses', '고정비 관리', <Repeat key="fixed" size={14} aria-hidden="true"/>],
            ...(isPersonalLedger ? [['assets', '자산 관리', <Wallet key="assets" size={14} aria-hidden="true"/>] as const] : []),
            ['categories', '카테고리 관리', <SlidersHorizontal key="cat" size={14} aria-hidden="true"/>],
            ['payment-methods', '결제수단 관리', <CreditCard key="pay" size={14} aria-hidden="true"/>],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              className={activeTab === id ? 'is-active' : ''}
              aria-current={activeTab === id ? 'page' : undefined}
              onClick={() => setActiveTab(id)}
            >
              {icon}<span>{label}</span>
            </button>
          ))}</div>
        </nav>
        <div data-ledger-tour="month" className="ledger-month-control"><button className="btn btn-secondary" aria-label="이전 달" onClick={handlePrevMonth}><ChevronLeft size={17}/></button><input type="month" aria-label="조회 월" value={validMonth(selectedMonth) ? selectedMonth : `${selectedMonth}-01`} onChange={e => { if (validMonth(e.target.value)) setSelectedMonth(e.target.value); }}/><button className="btn btn-secondary" aria-label="다음 달" onClick={handleNextMonth}><ChevronRight size={17}/></button><button className="btn btn-secondary" onClick={handleCurrentMonth}>이번 달</button></div>
      </div>
      {/* 알림 메시지 배너 */}
      {reportResult && (
        <div
          className="glass-panel"
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: reportResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            borderColor: reportResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {reportResult.success ? <CheckCircle2 size={15} color="#10b981" /> : <AlertCircle size={15} color="#ef4444" />}
            <span style={{ fontSize: '0.8rem', color: reportResult.success ? 'var(--success)' : "var(--danger)" }}>
              {reportResult.message}
            </span>
          </div>
          <button
            onClick={() => setReportResult(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
          >
            닫기
          </button>
        </div>
      )}

      {activeTab === 'analytics' && (
        <PeriodAnalytics
          isClubLedger={isClubLedger}
          privacyMode={privateIncome}
          categories={categories}
          initialMonth={selectedMonth}
          budgetConfig={budgetConfig}
          refreshKey={statsRefreshKey}
          onBudgetUpdated={(newBudget) => setBudgetConfig(newBudget)}
          onEditTransaction={(tx) => {
            setEditingTx(tx);
            setEditForm({
              id: tx.id,
              notifiedAt: tx.notifiedAt ? getLocalDateString(new Date(tx.notifiedAt)) : '',
              sourceApp: tx.sourceApp || 'MANUAL',
              type: tx.type || 'PAYMENT',
              amount: formatCellAmount(String(tx.amount || 0)),
              merchant: tx.merchant || '',
              category: tx.category || '',
              cardOrAccount: tx.cardOrAccount || '',
              content: tx.content || '',
            });
            setShowEditModal(true);
          }}
          onDeleteTransaction={async (id) => {
            await handleDeleteOne(id);
            setStatsRefreshKey((k) => k + 1);
          }}
          onSelectMerchant={handleSelectMerchant}
        />
      )}

      {activeTab === 'goal' && isPersonalLedger && <section className="ledger-optional-goal">
        <div className="ledger-section-heading"><div><span className="ledger-mode-label">부가 기능</span><h2>목돈 목표</h2><p className="ledger-muted">원할 때 목표를 정하고, 현재 자산과 저축 속도로 예상 기간을 살펴보세요.</p></div><button className="btn btn-secondary" onClick={() => router.push('/workspace?tab=settings')}>목표 금액 설정</button></div>
        {householdInfo?.goalAmount ? <WealthGoalDashboard privacyMode={privateIncome} refreshKey={statsRefreshKey} goalAmount={householdInfo.goalAmount}/> : <div className="ledger-goal-empty"><Target size={28}/><h3>원하는 목돈 목표를 정해보세요</h3><p className="ledger-muted">여행 자금, 비상금, 내 집 마련까지. 목표 금액을 정하면 현재 자산과 저축 속도로 예상 기간을 확인할 수 있어요.</p><button className="btn btn-primary" onClick={() => router.push('/workspace?tab=settings')}>가계부 설정에서 목표 정하기</button></div>}
      </section>}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 탭 2: 가계부 달력 (Calendar View) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'dues' && isClubLedger && <ClubDues month={validMonth(selectedMonth) ? selectedMonth : `${selectedMonth}-01`} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} onCurrentMonth={handleCurrentMonth} onChanged={refreshLedger} onEdit={openTransactionEditor}/>}
      {activeTab === 'company' && isCompanyLedger && <CompanyFinance onChanged={refreshLedger}/>}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <HouseholdCalendar
            month={selectedMonth}
            data={calendarData}
            categories={categories}
            selectedDate={calendarSelectedDate}
            onMonthChange={(month) => {
              setCalendarSelectedDate(null);
              setCalendarModalAnchor(null);
              setSelectedMonth(month);
            }}
            onSelect={(date, rect) => {
              if (calendarSelectedDate === date) {
                setCalendarSelectedDate(null);
                setCalendarModalAnchor(null);
              } else {
                setCalendarModalAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height });
                setCalendarSelectedDate(date);
              }
            }}
          />

          {/* 달력 날짜 선택 시 거래 내역 상대 위치 모달 팝업 */}
          {calendarSelectedDate && (
            <div
              onClick={() => {
                setCalendarSelectedDate(null);
                setCalendarModalAnchor(null);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--calendar-overlay, rgba(0, 0, 0, 0.35))',
                zIndex: 950,
                display: 'block',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="glass-panel"
                style={{
                  position: 'fixed',
                  ...calendarPopupPos,
                  maxHeight: 'min(520px, 82vh)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  boxShadow: 'var(--calendar-popover-shadow, 0 20px 48px rgba(0, 0, 0, 0.4))',
                  borderRadius: '14px',
                  animation: 'fadeIn 0.15s ease-out',
                  background: 'var(--surface-card)',
                }}
              >
                {(() => {
                  const dayNum = parseInt(calendarSelectedDate.split('-')[2], 10);
                  const cellData = calendarData.dayMap.get(dayNum);
                  const dayTxs = cellData?.txs || [];
                  const savingsTotal = cellData?.savings || 0;
                  const expenseTotal = cellData?.expense || 0;
                  const incomeTotal = cellData?.income || 0;

                  // 정렬 방식: 저축 -> 지출 -> 소득
                  const sortedDayTxs = [...dayTxs].sort((a, b) => {
                    const roleA = classifyTransactionRole(a);
                    const roleB = classifyTransactionRole(b);
                    const rank = (r: string) => r === 'SAVINGS' ? 1 : r === 'CONSUMPTION' ? 2 : r === 'INCOME' ? 3 : 4;
                    const diff = rank(roleA) - rank(roleB);
                    if (diff !== 0) return diff;
                    return b.amount - a.amount;
                  });

                  const dateParts = calendarSelectedDate.split('-').map(Number);
                  const dayOfWeekName = ['일', '월', '화', '수', '목', '금', '토'][
                    new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay()
                  ];
                  const formattedDateStr = `${dateParts[0]}년 ${dateParts[1]}월 ${dateParts[2]}일 (${dayOfWeekName})`;

                  return (
                    <>
                      {/* 팝업 헤더 */}
                      <div
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--surface-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--ledger-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              display: 'grid',
                              placeItems: 'center',
                              color: 'var(--success)',
                            }}
                          >
                            <CalendarIcon size={16} />
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800 }}>
                              {formattedDateStr}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.72rem', flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--text-muted)' }}>총 {dayTxs.length}건</span>
                              {savingsTotal > 0 && (
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                  저축 ₩{savingsTotal.toLocaleString()}
                                </span>
                              )}
                              {expenseTotal > 0 && (
                                <span style={{ color: 'var(--expense-color, #3b82f6)', fontWeight: 700 }}>
                                  지출 -₩{expenseTotal.toLocaleString()}
                                </span>
                              )}
                              {incomeTotal > 0 && (
                                <span data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)', fontWeight: 700 }}>
                                  소득 +₩{incomeTotal.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 오른쪽 상단 닫기 x 버튼 */}
                        <button
                          onClick={() => {
                            setCalendarSelectedDate(null);
                            setCalendarModalAnchor(null);
                          }}
                          style={{
                            background: 'var(--ledger-control-bg)',
                            border: '1px solid var(--surface-border)',
                            borderRadius: '6px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.88rem',
                            transition: 'all 0.15s ease',
                          }}
                          title="닫기 (ESC)"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-main)';
                            e.currentTarget.style.background = 'var(--ledger-control-hover)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)';
                            e.currentTarget.style.background = 'var(--ledger-control-bg)';
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* 팝업 본문 (스크롤 가능한 거래 내역 목록) */}
                      <div
                        style={{
                          padding: '12px 14px',
                          overflowY: 'auto',
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {dayTxs.length === 0 ? (
                          <div style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <p style={{ margin: 0, fontSize: '0.85rem' }}>해당 일자의 거래 내역이 없습니다.</p>
                            <button
                              onClick={() => {
                                openQuickEntry(calendarSelectedDate);
                                setCalendarSelectedDate(null);
                                setCalendarModalAnchor(null);
                              }}
                              className="btn btn-secondary"
                              style={{ marginTop: '12px', fontSize: '0.76rem', padding: '6px 12px' }}
                            >
                              <PlusCircle size={14} /> 이 날짜로 거래 추가
                            </button>
                          </div>
                        ) : (
                          sortedDayTxs.map((tx) => {
                            const cat = getCategoryBadge(tx.category, categories);
                            const role = classifyTransactionRole(tx);
                            const isSavings = role === 'SAVINGS';
                            const isTransfer = role === 'TRANSFER';
                            const isDeposit = tx.type === 'DEPOSIT';
                            const isExpense = role === 'CONSUMPTION';
                            return (
                              <div data-sensitive-income={role === 'INCOME' || resolveCategoryInfo(tx.category, categories).type === 'INCOME' || /급여|월급|이자|배당|수입/.test(`${tx.merchant || ''} ${tx.title || ''} ${tx.content || ''}`) ? 'true' : undefined}
                                key={tx.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '9px 12px',
                                  background: 'var(--ledger-subtle)',
                                  borderRadius: '8px',
                                  border: '1px solid var(--surface-border)',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.emoji}</span>
                                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        fontWeight: 600,
                                        fontSize: '0.84rem',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                      title={tx.merchant || tx.cardOrAccount || tx.title}
                                    >
                                      {tx.merchant || tx.cardOrAccount || tx.title}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dark)', marginTop: '2px' }}>
                                      {new Date(tx.notifiedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} · {cat.label} · {tx.cardOrAccount || tx.sourceApp}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: '0.88rem',
                                      color: isDeposit ? 'var(--income-color, #ef4444)' : isSavings ? '#10b981' : isTransfer ? '#06b6d4' : isExpense ? "var(--expense-color, #3b82f6)" : '#999',
                                    }}
                                  >
                                    {isDeposit ? '+' : isTransfer ? '🔄 ' : isExpense ? '-' : ''}₩{tx.amount.toLocaleString()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingTx(tx);
                                      setEditForm({
                                        id: tx.id,
                                        notifiedAt: kstDate(tx.notifiedAt),
                                        sourceApp: tx.sourceApp,
                                        type: tx.type,
                                        amount: formatCellAmount(String(tx.amount)),
                                        merchant: tx.merchant || '',
                                        category: tx.category || '',
                                        cardOrAccount: tx.cardOrAccount || '',
                                        content: tx.content || '',
                                      });
                                      setShowEditModal(true);
                                    }}
                                    className="btn btn-secondary"
                                    title="수정"
                                    style={{ padding: '4px 6px', fontSize: '0.72rem' }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOne(tx.id)}
                                    className="btn btn-secondary"
                                    title="삭제"
                                    style={{ padding: '4px 6px', fontSize: '0.72rem', color: 'var(--danger)' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* 팝업 하단 푸터 (항목별 합계 및 빠른 등록 연동) */}
                      {dayTxs.length > 0 && (
                        <div
                          style={{
                            padding: '10px 14px',
                            borderTop: '1px solid var(--surface-border)',
                            background: 'var(--ledger-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.74rem',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            {savingsTotal > 0 && <span>저축 <strong style={{ color: '#10b981' }}>₩{savingsTotal.toLocaleString()}</strong></span>}
                            {expenseTotal > 0 && <span>지출 <strong style={{ color: 'var(--expense-color, #3b82f6)' }}>₩{expenseTotal.toLocaleString()}</strong></span>}
                            {incomeTotal > 0 && <span>소득 <strong data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)' }}>₩{incomeTotal.toLocaleString()}</strong></span>}
                          </div>
                          <button
                            onClick={() => {
                              openQuickEntry(calendarSelectedDate);
                              setCalendarSelectedDate(null);
                              setCalendarModalAnchor(null);
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          >
                            <PlusCircle size={13} /> 이 날짜로 거래 추가
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 탭 3: 거래 내역 장부 (Ledger Table & Filters) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ledger' && <>
        {loadError && <div role="alert" className="ledger-error">{loadError} <button className="btn btn-secondary" onClick={refreshLedger}>다시 시도</button></div>}
        
        {/* 1. 핵심 지표 요약 카드 (레이어 UI) */}
        <div className={`ledger-month-summary${isClubLedger ? ' ledger-month-summary--club' : ''}`} aria-label="조회 기간 요약">
          <div className="ledger-summary-card"><span>{isClubLedger ? '회비·기타 수입' : isCompanyLedger ? '매출·수입' : '수입'}</span><strong data-sensitive-income="true" style={{ color: 'var(--income-color, #ef4444)' }}>{loading ? '—' : `₩${ledgerTotals.income.toLocaleString()}`}</strong></div>
          <div className="ledger-summary-card"><span>{isClubLedger ? '공동 지출' : isCompanyLedger ? '비용' : '지출'}</span><strong style={{ color: 'var(--expense-color, #3b82f6)' }}>{loading ? '—' : `₩${ledgerTotals.expense.toLocaleString()}`}</strong></div>
          {isPersonalLedger && <div className="ledger-summary-card"><span>저축</span><strong>{loading ? '—' : `₩${ledgerTotals.savings.toLocaleString()}`}</strong></div>}
          <div className="ledger-summary-card"><span>{isClubLedger ? '잔액 증감' : isCompanyLedger ? '순이익' : '수입 − 지출'}</span><strong data-sensitive-income="true" style={{ color: (ledgerTotals.income - ledgerTotals.expense) >= 0 ? 'var(--income-color, #ef4444)' : 'var(--expense-color, #3b82f6)' }}>{loading ? '—' : `₩${(ledgerTotals.income - ledgerTotals.expense).toLocaleString()}`}</strong></div>
        </div>
        <details className="ledger-overview">
          <summary><PieChartIcon size={17}/>날짜별·카테고리별 요약 보기<ChevronDown size={16}/></summary>
        {/* 2. 월간 일별 지출 타임라인 한 줄 달력 */}
        <div className="glass-panel" style={{ padding: '12px 16px', marginBottom: '14px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📆 {selectedMonth} 월간 일별 지출 타임라인
              </span>

            </div>
            {specificDateFilter && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSpecificDateFilter('')}
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
              >
                전체 날짜 보기 (필터 해제)
              </button>
            )}
          </div>
          <div className="ledger-month-timeline-days">
            {timelineDays.map((d) => {
              const isSelected = specificDateFilter === d.dateStr;
              const hasSavings = (d.savings || 0) > 0;
              const hasExpense = (d.expense || 0) > 0;
              const hasIncome = (d.income || 0) > 0;
              const isSunday = d.dayOfWeek === 0;
              const isSaturday = d.dayOfWeek === 6;
              return (
                <div
                  key={d.dateStr}
                  onClick={() => setSpecificDateFilter(isSelected ? '' : d.dateStr)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderRadius: '8px',
                    background: isSelected
                      ? 'rgba(56, 189, 248, 0.22)'
                      : hasSavings
                      ? 'rgba(16, 185, 129, 0.08)'
                      : hasExpense
                      ? 'rgba(59, 130, 246, 0.08)'
                      : 'var(--ledger-subtle)',
                    border: isSelected
                      ? '1.5px solid #38bdf8'
                      : hasSavings
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : hasExpense
                      ? '1px solid rgba(59, 130, 246, 0.22)'
                      : '1px solid var(--surface-border)',
                    boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.4)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                  }}
                  title={`${d.dateStr} (${d.dayName}): ${[
                    hasSavings ? `저축 ₩${d.savings.toLocaleString()}` : '',
                    hasExpense ? `지출 ₩${d.expense.toLocaleString()}` : '',
                    hasIncome ? `소득 ₩${d.income.toLocaleString()}` : '',
                  ].filter(Boolean).join(' / ') || '내역 없음'}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isSelected ? '#38bdf8' : isSunday ? '#ef4444' : isSaturday ? '#3b82f6' : 'var(--text-main)' }}>
                      {d.day}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: isSunday ? '#ef4444' : isSaturday ? '#3b82f6' : 'var(--text-muted)' }}>
                      {d.dayName}
                    </span>
                  </div>
                  {/* 정렬 순서: 저축 -> 지출 -> 소득 */}
                  {hasSavings && (
                    <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 600 }}>
                      {d.formattedSavings}
                    </span>
                  )}
                  <span style={{ fontSize: '0.66rem', color: isSelected ? 'var(--text-main)' : hasExpense ? 'var(--expense-color, #3b82f6)' : 'var(--text-muted)', fontWeight: 600 }}>
                    {hasExpense ? d.formattedExpense : (!hasSavings && !hasIncome ? '-' : '')}
                  </span>
                  {hasIncome && (
                    <span data-sensitive-income="true" style={{ fontSize: '0.62rem', color: 'var(--income-color, #ef4444)', fontWeight: 600 }}>
                      +{d.formattedIncome}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`glass-panel ledger-category-summary${isClubLedger ? ' ledger-category-summary--club' : ''}`}>
          <div className="ledger-category-summary-grid">
            <CategoryBreakdown kind="expense" total={categorySummary.totalExpense} items={categorySummary.expenseList} pieData={categorySummary.expensePieData} selected={categoryFilter} onSelect={setCategoryFilter}/>
            <CategoryBreakdown kind="income" total={categorySummary.totalIncome} items={categorySummary.incomeList} pieData={categorySummary.incomePieData} selected={categoryFilter} onSelect={setCategoryFilter}/>
            {isPersonalLedger && <CategoryBreakdown kind="savings" total={categorySummary.totalSavings} items={categorySummary.savingsList} pieData={categorySummary.savingsPieData} selected={categoryFilter} onSelect={setCategoryFilter} savingsRate={currentSavingsRate}/>}
          </div>
        </div>

        </details>

        <div role="status" aria-live="polite" aria-atomic="true">{recentSave && <div className="ledger-save-feedback" key={recentSave.time}><span aria-hidden="true">✓</span>기록을 저장했어요.</div>}</div>

        {/* 고정비를 거래 내역 위에 한 단으로 배치 */}
        <LedgerHistoryProvider onChanged={refreshLedger} onDeleted={handleHistoryDeleted}><div className="ledger-two-column-grid">
          <div style={{ minWidth: 0 }}>
            {validMonth(selectedMonth) ? <MonthlyFixedExpenses categories={categories} paymentMethods={paymentMethods} onCellSaved={handleCellSaved} key={selectedMonth} month={selectedMonth} actual={transactions} refreshKey={statsRefreshKey} onChanged={refreshLedger} onManage={() => setActiveTab('fixed-expenses')} onEdit={openTransactionEditor}/> : <p className="ledger-muted">고정비는 월을 선택하면 확인할 수 있습니다.</p>}
          </div>
          <div style={{ minWidth: 0 }}>
            <TransactionLedger isClubLedger={isClubLedger} canEdit={canEditTransactions} month={selectedMonth} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} onCurrentMonth={handleCurrentMonth} onBulkPasted={refreshLedger} onCellSaved={handleCellSaved} paymentMethods={paymentMethods} onCreated={(item, date) => {
              setRecentSave({ id: item.id, time: Date.now() });
              clearLedgerFilters();
              if (date.slice(0, 7) !== selectedMonth) {
                ++transactionRequestId.current;
                setTransactions([item]);
                setSelectedMonth(date.slice(0, 7));
              } else handleCellSaved(item);
            }} items={displayTransactions} all={transactions} loading={loading} categories={categories} search={searchQuery} onSearch={setSearchQuery} filterCount={filterCount} onClear={clearLedgerFilters}
              sortField={sortField} sortOrder={dateSortOrder} onSort={handleSortColumn} order={ledgerOrder} selected={selectedIds} onSelect={setSelectedIds} onDeleteSelected={handleDeleteSelected} deleting={deleting} confirmBulk={activeBulkDelete}
              onEdit={openTransactionEditor} onDelete={handleDeleteOne} confirmDeleteId={activeDeleteId} entryInvite={entryInvite} entryDate={entryDate} onEntryInviteHandled={() => setEntryInvite(0)}
              filters={<>
                <label className="ledger-field">구분<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="ALL">전체</option><option value="PAYMENT">지출</option><option value="WITHDRAWAL">출금</option><option value="DEPOSIT">수입</option><option value="CANCEL">취소</option></select></label>
                <label className="ledger-field">카테고리<select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="ALL">전체</option>{categories.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}</select></label>
                <label className="ledger-field">결제수단<select value={sourceAppFilter} onChange={e => setSourceAppFilter(e.target.value)}><option value="ALL">전체</option>{paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}{extraSourceApps.map(app => <option key={app} value={app}>{app === 'MANUAL' ? '직접 입력' : app}</option>)}</select></label>
                <label className="ledger-field">날짜<input type="date" value={specificDateFilter} onChange={e => setSpecificDateFilter(e.target.value)}/></label>
                <label className="ledger-field">카드·계좌<input value={cardAccountFilter} onChange={e => setCardAccountFilter(e.target.value)} placeholder="이름 검색"/></label>
                <label className="ledger-field">리포트<select value={isReportedFilter} onChange={e => setIsReportedFilter(e.target.value)}><option value="ALL">전체</option><option value="true">전송됨</option><option value="false">미전송</option></select></label>
              </>}/>
          </div>
        </div></LedgerHistoryProvider>
      </>}

      {['fixed-expenses', 'categories', 'payment-methods', 'assets'].includes(activeTab) && <section data-ledger-tour={`${activeTab}-intro`} className="ledger-surface ledger-management-intro">
        <h2>
          {activeTab === 'fixed-expenses' ? '고정비 관리'
           : activeTab === 'assets' ? '자산 관리'
           : activeTab === 'payment-methods' ? '결제 / 금융 수단 관리'
           : '가계부 카테고리 관리'}
        </h2>
        <p className="ledger-muted">
          {activeTab === 'fixed-expenses' ? '매달 반복되는 항목의 기본값을 관리합니다. 장부에서 고정비 추가하기를 눌러 해당 월에 반영하세요. 이미 불러온 달의 내역은 바뀌지 않습니다.'
           : activeTab === 'assets' ? '보유한 자산과 부채를 정리하고 현재 가치를 확인하세요.'
           : activeTab === 'payment-methods' ? '거래 내역 장부에서 선택할 수 있는 금융사, 카드, 결제 앱, 현금 등의 수단을 등록하고 관리합니다.'
           : '거래를 쉽게 분류할 수 있도록 지출, 수입, 저축, 이체 카테고리를 체계적으로 관리하세요.'}
        </p>
      </section>}
      {activeTab === 'fixed-expenses' && (
        <FixedExpensesManagement
          categories={categories}
          onSelectMerchantInLedger={(merchant) => {
            setSearchQuery(merchant);
            setActiveTab('ledger');
          }}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 탭 5: 카테고리 관리 & 결제수단 관리 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {(activeTab === 'categories' || activeTab === 'payment-methods') && (
        <CategoryManagement
          categories={categories}
          onCategoriesUpdated={fetchCategories}
          paymentMethods={paymentMethods}
          onPaymentMethodsUpdated={fetchPaymentMethods}
          forcedType={activeTab === 'payment-methods' ? 'PAYMENT_METHOD' : 'CATEGORIES'}
        />
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 탭 6: 카드 · 통장 · 자산 관리 (예적금, 주식, 순자산) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'assets' && isPersonalLedger && (
        <AssetManagement />
      )}


      {/* ───────────────────────────────────────────────────────────── */}
      {/* 📊 모달: 장부 거래 내역 대량(벌크) 복붙 등록 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <BulkTransactionModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        categories={categories}
        currentMonth={selectedMonth}
        existingTransactions={transactions}
        onSuccess={(importedMonth) => {
          if (importedMonth && importedMonth !== selectedMonth && /^\d{4}-\d{2}$/.test(importedMonth)) {
            setSelectedMonth(importedMonth);
          }
          fetchTransactions();
          fetchMonthlyStats();
          setStatsRefreshKey((k) => k + 1);
        }}
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 모달: 거래 내역 전체 수정 모달 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showEditModal && editingTx && <LedgerDialog title={editingTx.fixedExpenseId ? '이달의 고정비 수정' : '거래 수정'} onClose={() => { if (!updating) setShowEditModal(false); }}>
        <form onSubmit={handleEditSubmit}>
          {editingTx.fixedExpenseId && <p className="ledger-muted">이달의 내역만 수정합니다. 다음 달의 기본값은 고정비 관리에서 변경해 주세요.</p>}
          <label className="ledger-field">구분<select value={editForm.type} disabled={!!editingTx.fixedExpenseId} onChange={e => setEditForm({ ...editForm, type: e.target.value })}><option value="PAYMENT">지출</option><option value="WITHDRAWAL">출금</option><option value="DEPOSIT">수입</option><option value="CANCEL">취소</option><option value="OTHER">기타</option></select></label>
          <div data-sensitive-income={isIncomeSensitive(editForm, categories) ? 'true' : undefined}>
            <label className="ledger-field">금액 (원)<input required inputMode="numeric" value={formatCellAmount(editForm.amount)} onChange={e => setEditForm({ ...editForm, amount: formatCellAmount(e.target.value) })}/></label>
            <label className="ledger-field">사용처·수입처<input required value={editForm.merchant} onChange={e => setEditForm({ ...editForm, merchant: e.target.value })}/></label>
          </div>
          <label className="ledger-field">날짜<input type="date" required value={editForm.notifiedAt} onChange={e => setEditForm({ ...editForm, notifiedAt: e.target.value })}/></label>
          <label className="ledger-field">카테고리<select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}><option value="">미분류</option>{!categories.some(c => c.name === editForm.category) && editForm.category && <option value={editForm.category}>{getCategoryBadge(editForm.category, categories).label}</option>}{categories.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}</select></label>
          <details className="ledger-advanced"><summary>결제수단·메모 수정</summary>
            <label className="ledger-field">결제수단<input value={editForm.sourceApp} onChange={e => setEditForm({ ...editForm, sourceApp: e.target.value })}/></label>
            <label className="ledger-field">카드·계좌<input value={editForm.cardOrAccount} onChange={e => setEditForm({ ...editForm, cardOrAccount: e.target.value })}/></label>
            <label className="ledger-field" data-sensitive-income={isIncomeSensitive(editForm, categories) ? 'true' : undefined}>메모<textarea rows={3} value={editForm.content} onChange={e => setEditForm({ ...editForm, content: e.target.value })}/></label>
          </details>
          {isClubLedger && editingTx.type === 'DEPOSIT' && <TransactionDues key={editingTx.id} transactionId={editingTx.id} canEdit={canEditTransactions} onChanged={refreshLedger}/>}
          <TransactionReceipts key={editingTx.id} transactionId={editingTx.id} canEdit={canEditTransactions} onChanged={refreshLedger}/>
          <div className="ledger-dialog-actions"><button type="button" className="btn btn-secondary" disabled={updating} onClick={() => setShowEditModal(false)}>취소</button><button className="btn btn-primary" type="submit" disabled={updating}>{updating ? '저장 중…' : '저장'}</button></div>
        </form>
      </LedgerDialog>}

    </div>
  );
}

export default function HouseholdLedgerPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          가계부 데이터를 불러오는 중입니다...
        </div>
      }
    >
      <HouseholdLedgerContent />
    </Suspense>
  );
}
