'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Key,
  Link,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Target,
  Trash2,
  UserMinus,
  Users,
  Wallet,
  WalletCards,
  AlertTriangle,
} from 'lucide-react';
import { formatNumberWithCommas } from '@/lib/ledger-cell';
import './workspace.css';
import WorkspaceOnboarding from './WorkspaceOnboarding';

type HouseholdRole = 'ADMIN' | 'EDITOR' | 'VIEWER';

type Household = {
  id: string;
  name: string;
  goalAmount?: number | null;
  type?: 'WEALTH' | 'CLUB' | 'COMPANY';
  monthlyDues?: number;
  inviteCode: string;
  inviteExpiresAt?: string;
  ownerId?: string;
};

type Member = {
  id: string;
  name: string;
  email?: string;
  isOwner: boolean;
  role: HouseholdRole;
};

type Invite = {
  code: string;
  role: HouseholdRole;
  expiresAt: string;
  createdAt: string;
  createdByName: string;
  isDefault: boolean;
};

type AccountInfo = { id?: string; email: string; name?: string; role: string };

type MyHousehold = {
  id: string;
  name: string;
  type: 'WEALTH' | 'CLUB' | 'COMPANY';
  isOwner: boolean;
  isActive: boolean;
};

const ROLE_LABELS: Record<HouseholdRole, string> = {
  ADMIN: '관리자',
  EDITOR: '에디터',
  VIEWER: '뷰어',
};

const ROLE_DESCRIPTIONS: Record<HouseholdRole, string> = {
  ADMIN: '가계부 설정, 초대 링크 발급/취소, 구성원 권한 관리',
  EDITOR: '거래내역 등록, 수정, 삭제 및 자산/카테고리 관리',
  VIEWER: '거래내역 및 분석 그래프 읽기 전용',
};

function formatKoreanCurrency(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return '';
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const won = amount % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (won > 0) parts.push(`${won.toLocaleString('ko-KR')}`);
  return parts.length > 0 ? `${parts.join(' ')} 원` : `${amount.toLocaleString('ko-KR')}원`;
}

export default function WorkspaceSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [household, setHousehold] = useState<Household | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<HouseholdRole>('EDITOR');
  const [activeTab, setActiveTab] = useState<'members' | 'invites' | 'settings'>(() => { const tab = searchParams.get('tab'); return tab === 'settings' || tab === 'invites' ? tab : 'members'; });

  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [myHouseholds, setMyHouseholds] = useState<MyHousehold[]>([]);

  const [name, setName] = useState('우리집 가계부');
  const [householdType, setHouseholdType] = useState<'WEALTH' | 'CLUB' | 'COMPANY'>('WEALTH');
  const [settingsName, setSettingsName] = useState('');
  const [settingsType, setSettingsType] = useState<'WEALTH' | 'CLUB' | 'COMPANY'>('WEALTH');
  const [settingsGoal, setSettingsGoal] = useState('');
  const [settingsDues, setSettingsDues] = useState('0');
  const [goalAmount, setGoalAmount] = useState('');
  const [inviteCode, setInviteCode] = useState(() => (searchParams.get('invite') || '').toUpperCase());
  const [setupMode, setSetupMode] = useState<'create' | 'join'>(() => searchParams.get('invite') ? 'join' : 'create');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  // New invite form state
  const [newInviteRole, setNewInviteRole] = useState<HouseholdRole>('EDITOR');

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const copyHouseholdUrl = () => {
    if (!household?.id) return;
    const url = `${window.location.origin}/?household=${household.id}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('가계부 고유 주소가 복사되었습니다.');
    }).catch(() => {
      prompt('가계부 고유 주소:', url);
    });
  };


  const loadHousehold = () => {
    fetch('/api/households')
      .then(response => response.json())
      .then(data => {
        if (data.household) {
          setHousehold(data.household);
          setSettingsName(data.household.name);
          setSettingsType(data.household.type || 'WEALTH');
          setSettingsGoal(data.household.goalAmount ? formatNumberWithCommas(data.household.goalAmount) : '');
          setSettingsDues(formatNumberWithCommas(data.household.monthlyDues ?? 0));
          setMemberCount(data.memberCount || 0);
          setMembers(data.members || []);
          setInvites(data.invites || []);
          setMyRole(data.myRole || 'EDITOR');
          setMyHouseholds(data.myHouseholds || []);
        } else {
          setHousehold(null);
        }
      })
      .catch(() => setError('가계부 정보를 불러오지 못했습니다.'));
  };

  useEffect(() => {
    loadHousehold();
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => {
        if (data.user) {
          setAccount({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            role: data.user.role,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function action(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');

      if (body.action === 'leave' || body.action === 'delete-household') {
        setMembers([]);
        setHousehold(null);
        setMemberCount(0);
        setInvites([]);
        showToast(body.action === 'leave' ? '가계부에서 나갔습니다.' : '가계부가 삭제되었습니다.');
      } else {
        loadHousehold();
        if (body.action === 'create-invite') showToast('새 초대 링크가 발급되었습니다.');
        if (body.action === 'delete-invite') showToast('초대 링크가 취소되었습니다.');
        if (body.action === 'rotate-invite') showToast('기본 초대 코드가 재발급되었습니다.');
        if (body.action === 'update-member-role') showToast('구성원 권한이 변경되었습니다.');
        if (body.action === 'remove-member') showToast('구성원을 내보냈습니다.');
        if (body.action === 'transfer-owner') showToast('소유권이 이전되었습니다.');
        if (body.action === 'update-settings') showToast('가계부 설정을 저장했습니다.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function create(event: FormEvent) {
    event.preventDefault();
    void action({ action: 'create', name: name.trim(), type: householdType, goalAmount: householdType === 'WEALTH' && goalAmount ? Number(goalAmount.replace(/,/g, '')) : null });
  }

  function join(event: FormEvent) {
    event.preventDefault();
    void action({ action: 'join', inviteCode });
  }

  function copyInviteLink(code: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/workspace?invite=${code}`;
    void navigator.clipboard.writeText(inviteUrl);
    showToast('초대 링크가 클립보드에 복사되었습니다.');
  }

  function copyInviteCodeOnly(code: string) {
    void navigator.clipboard.writeText(code);
    showToast('초대 코드가 복사되었습니다.');
  }

  function createNewInvite(e: FormEvent) {
    e.preventDefault();
    void action({ action: 'create-invite', role: newInviteRole });
  }

  const isOwner = Boolean(
    household &&
      (household.ownerId === account?.id || members.find(m => m.id === account?.id)?.isOwner)
  );
  const isAdmin = myRole === 'ADMIN';

  return (
    <div className={`ws-page${!household ? ' ws-onboarding-page' : ''}`}>
      {toast && (
        <div className="ws-toast">
          <Check size={16} strokeWidth={2.5} />
          <span>{toast}</span>
        </div>
      )}

      <div className="ws-container">
        {/* Top Navigation Bar */}
        <header className="ws-nav-header">
          <button type="button" className="ws-back-link" onClick={() => router.push('/')}>
            <ArrowLeft size={15} />
            <span>가계부로 돌아가기</span>
          </button>
          <div className="ws-brand-title">
            <span>💸 함께 쓰는 가계부</span>
          </div>
          {account && (
            <a className="ws-nav-user" href="/mypage" aria-label="마이페이지">
              <div className="ws-user-chip" title={account.email}>
                
                <strong>{account.name || '사용자'}</strong>
                
              </div>
            </a>
          )}
        </header>

        {error && (
          <div className="ws-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* --- WHEN HOUSEHOLD EXISTS --- */}
        {household ? (
          <>
            {/* Hero Overview Card */}
            <section className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="ws-badge ws-badge-owner">내 가계부</span>
                    {isOwner ? (
                      <span className="ws-badge ws-badge-admin">
                        <ShieldCheck size={12} />
                        소유자
                      </span>
                    ) : (
                      <span className={`ws-badge ws-badge-${myRole.toLowerCase()}`}>
                        <Shield size={12} />
                        내 권한: {ROLE_LABELS[myRole]}
                      </span>
                    )}
                  </div>
                  <h2>{household.name}</h2>
                  <p className="ws-card-subtitle">{household.type === 'CLUB' ? '모임 회비와 공동 지출을 함께 기록합니다.' : household.type === 'COMPANY' ? '매출·매입 세금계산서와 부가세, 고정비 현금흐름을 관리합니다.' : '함께 기록하고 자산 목표를 향해 나아갑니다.'}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="ws-stats-grid">
                <div className="ws-stat-item">
                  <span className="ws-stat-label">
                    {household.type === 'CLUB' || household.type === 'COMPANY' ? <Users size={13} color="#51d2a3" /> : <Target size={13} color="#38bdf8" />}
                    {household.type === 'CLUB' || household.type === 'COMPANY' ? '가계부 유형' : '목돈 목표 (선택)'}
                  </span>
                  <span className="ws-stat-value">
                    {household.type === 'CLUB' ? '모임 회계' : household.type === 'COMPANY' ? '회사 회계' : !household.goalAmount ? '미설정' : <>{formatKoreanCurrency(household.goalAmount || 0)}<small>({(household.goalAmount || 0).toLocaleString('ko-KR')}원)</small></>}
                  </span>
                </div>
                <div className="ws-stat-item">
                  <span className="ws-stat-label">
                    <Users size={13} color="#51d2a3" />
                    참여 구성원
                  </span>
                  <span className="ws-stat-value">{memberCount}명</span>
                </div>
                <div className="ws-stat-item">
                  <span className="ws-stat-label">
                    <Key size={13} color="#a78bfa" />
                    활성 초대 코드
                  </span>
                  <span className="ws-stat-value">{invites.length}개 발급됨</span>
                </div>
              </div>

              {/* Household Unique URL & Switcher */}
              <div style={{ display: 'grid', gap: '8px', margin: '0 0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ws-line)', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ws-text-muted)' }}>
                    <Link size={14} style={{ color: 'var(--ws-accent)' }} />
                    <span style={{ fontWeight: 500, color: 'var(--ws-text-primary)' }}>가계부 고유 주소:</span>
                    <code style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>/?household={household.id.slice(0, 8)}...</code>
                  </div>
                  <button
                    type="button"
                    className="ws-btn-secondary"
                    style={{ fontSize: '12px', padding: '4px 10px', height: '28px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    onClick={copyHouseholdUrl}
                  >
                    <Copy size={13} />
                    <span>주소 복사</span>
                  </button>
                </div>

                {myHouseholds.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '12px', color: 'var(--ws-text-muted)', padding: '4px 2px' }}>
                    <span>가계부 전환:</span>
                    {myHouseholds.map(h => (
                      <button
                        key={h.id}
                        type="button"
                        disabled={h.isActive || busy}
                        style={{
                          background: h.isActive ? 'var(--ws-accent)' : 'rgba(255,255,255,0.06)',
                          color: h.isActive ? '#08271e' : 'var(--ws-text-primary)',
                          border: '1px solid var(--ws-line)',
                          borderRadius: '6px',
                          padding: '3px 9px',
                          fontSize: '12px',
                          cursor: h.isActive ? 'default' : 'pointer',
                          fontWeight: h.isActive ? 600 : 400,
                        }}
                        onClick={() => void action({ action: 'switch', householdId: h.id })}
                      >
                        {h.name} {h.type === 'COMPANY' ? '(회사)' : h.type === 'CLUB' ? '(모임)' : '(개인)'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Primary CTA */}
              <button
                type="button"
                className="ws-btn-open-ledger"
                onClick={() => router.push('/')}
              >
                <span>가계부 열기</span>
                <ArrowRight size={17} />
              </button>
            </section>

            {/* Segmented Management Card */}
            <section className="ws-card" style={{ padding: '16px 20px 24px' }}>
              {/* Segmented Tabs */}
              <div className="ws-tabs-bar" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'members'}
                  className={`ws-tab-btn ${activeTab === 'members' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('members')}
                >
                  <Users size={15} />
                  <span>구성원 관리</span>
                  <span className="ws-tab-count">{members.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'invites'}
                  className={`ws-tab-btn ${activeTab === 'invites' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('invites')}
                >
                  <Link size={15} />
                  <span>초대 링크 & 코드</span>
                  <span className="ws-tab-count">{invites.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'settings'}
                  className={`ws-tab-btn ${activeTab === 'settings' ? 'is-active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <Lock size={15} />
                  <span>가계부 설정</span>
                </button>
              </div>

              {/* --- TAB 1: MEMBERS --- */}
              {activeTab === 'members' && (
                <div>
                  {/* Role Guide Callout */}
                  <div className="ws-role-guide">
                    <div className="ws-role-guide-item">
                      <ShieldCheck size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>관리자</strong>
                        <span>가계부 설정과 초대, 구성원 권한을 관리합니다.</span>
                      </div>
                    </div>
                    <div className="ws-role-guide-item">
                      <Pencil size={16} color="#34d399" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>기록 담당</strong>
                        <span>거래 내역을 기록하고 수정하거나 삭제합니다.</span>
                      </div>
                    </div>
                    <div className="ws-role-guide-item">
                      <Eye size={16} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>보기 전용</strong>
                        <span>거래 내역과 분석 내용을 확인할 수 있습니다.</span>
                      </div>
                    </div>
                  </div>

                  <ul className="ws-list">
                    {members.map(member => {
                      const isMe = member.id === account?.id;
                      return (
                        <li key={member.id} className="ws-item">
                          <div className="ws-member-profile">
                            <div className="ws-avatar">
                              {member.name ? member.name.charAt(0) : 'U'}
                            </div>
                            <div className="ws-member-text">
                              <div className="ws-member-name-row">
                                <span className="ws-member-name">{member.name}</span>
                                {isMe && <span className="ws-me-tag">나</span>}
                                {member.isOwner ? (
                                  <span className="ws-badge ws-badge-owner">소유자</span>
                                ) : (
                                  <span className={`ws-badge ws-badge-${member.role.toLowerCase()}`}>
                                    {ROLE_LABELS[member.role]}
                                  </span>
                                )}
                              </div>
                              {member.email && (
                                <div className="ws-member-email">{member.email}</div>
                              )}
                            </div>
                          </div>

                          <div className="ws-member-actions">
                            {isAdmin && !member.isOwner ? (
                              <>
                                <select
                                  className="ws-select"
                                  aria-label={`${member.name} 권한 변경`}
                                  value={member.role}
                                  disabled={busy}
                                  onChange={e =>
                                    void action({
                                      action: 'update-member-role',
                                      targetUserId: member.id,
                                      role: e.target.value as HouseholdRole,
                                    })
                                  }
                                >
                                  <option value="ADMIN">관리자</option>
                                  <option value="EDITOR">에디터</option>
                                  <option value="VIEWER">뷰어</option>
                                </select>

                                {isOwner && (
                                  <button
                                    type="button"
                                    className="ws-btn-sm ws-btn-subtle"
                                    disabled={busy}
                                    title="소유권 이전"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `${member.name}님에게 가계부 소유권을 넘길까요?\n소유권 이전 후 본인은 관리자 권한이 됩니다.`
                                        )
                                      ) {
                                        void action({ action: 'transfer-owner', targetUserId: member.id });
                                      }
                                    }}
                                  >
                                    소유권 이전
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="ws-btn-sm ws-btn-danger-sm"
                                  disabled={busy}
                                  title="내보내기"
                                  onClick={() => {
                                    if (confirm(`${member.name}님을 가계부에서 내보낼까요?`)) {
                                      void action({ action: 'remove-member', targetUserId: member.id });
                                    }
                                  }}
                                >
                                  <UserMinus size={13} />
                                  <span>내보내기</span>
                                </button>
                              </>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* --- TAB 2: INVITES --- */}
              {activeTab === 'invites' && (
                <div>
                  {/* Create Invite Box (Admin only) */}
                  {isAdmin ? (
                    <div className="ws-create-invite-box">
                      <div className="ws-create-invite-header">
                        <Plus size={16} color="#38bdf8" />
                        <h3>새 초대 링크 만들기</h3>
                      </div>
                      <p className="ws-create-invite-desc">
                        부여할 권한을 선택하여 새로운 초대 링크를 생성할 수 있습니다. (30일 유효)
                      </p>

                      <form onSubmit={createNewInvite}>
                        <div className="ws-role-cards-grid">
                          {(['EDITOR', 'VIEWER', 'ADMIN'] as HouseholdRole[]).map(role => (
                            <button
                              key={role}
                              type="button"
                              className={`ws-role-card ${newInviteRole === role ? 'is-selected' : ''}`}
                              onClick={() => setNewInviteRole(role)}
                            >
                              <div className="ws-role-card-top">
                                <span className="ws-role-card-title">{ROLE_LABELS[role]}</span>
                                {newInviteRole === role && (
                                  <Check size={14} color="#51d2a3" strokeWidth={3} />
                                )}
                              </div>
                              <span className="ws-role-card-desc">{ROLE_DESCRIPTIONS[role]}</span>
                            </button>
                          ))}
                        </div>

                        <div className="ws-invite-create-actions">
                          <button
                            type="submit"
                            className="ws-btn-open-ledger"
                            disabled={busy}
                            style={{ width: 'auto', padding: '10px 18px', fontSize: 13 }}
                          >
                            <Plus size={15} />
                            <span>{ROLE_LABELS[newInviteRole]} 초대 링크 생성</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 10,
                        fontSize: 12,
                        color: '#94a3b8',
                        marginBottom: 16,
                      }}
                    >
                      초대 링크 생성 및 취소는 가계부 관리자 권한이 필요합니다.
                    </div>
                  )}

                  <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#f1f5f9', fontWeight: 600 }}>
                    발급된 초대 목록 ({invites.length})
                  </h4>

                  {invites.length === 0 ? (
                    <div className="ws-empty-state">
                      <Key size={32} />
                      <p>현재 발급된 초대 코드가 없습니다.</p>
                    </div>
                  ) : (
                    <ul className="ws-list">
                      {invites.map(inv => (
                        <li key={inv.code} className="ws-invite-item">
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="ws-invite-code-pill">{inv.code}</span>
                              <span className={`ws-badge ws-badge-${inv.role.toLowerCase()}`}>
                                {ROLE_LABELS[inv.role]}
                              </span>
                              {inv.isDefault && (
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>기본 코드</span>
                              )}
                            </div>
                            <div className="ws-invite-meta-text">
                              발급자: {inv.createdByName} · 만료: {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('ko-KR') : '무제한'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="ws-btn-sm ws-btn-primary-sm"
                              onClick={() => copyInviteLink(inv.code)}
                              title="초대 링크 복사"
                            >
                              <Link size={13} />
                              <span>링크 복사</span>
                            </button>
                            <button
                              type="button"
                              className="ws-btn-sm ws-btn-subtle"
                              onClick={() => copyInviteCodeOnly(inv.code)}
                              title="코드 복사"
                            >
                              <Copy size={13} />
                              <span>코드 복사</span>
                            </button>
                            {isAdmin && !inv.isDefault && (
                              <button
                                type="button"
                                className="ws-btn-sm ws-btn-danger-sm"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm(`초대 코드 [${inv.code}]를 취소하시겠습니까?`)) {
                                    void action({ action: 'delete-invite', inviteCode: inv.code });
                                  }
                                }}
                                title="초대 취소"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* --- TAB 3: SETTINGS --- */}
              {activeTab === 'settings' && (
                <div className="ws-settings-section">
                  <form className="ws-form" onSubmit={event => { event.preventDefault(); void action({ action: 'update-settings', name: settingsName, type: settingsType, goalAmount: settingsGoal ? Number(settingsGoal.replace(/,/g, '')) : null, monthlyDues: Number(settingsDues.replace(/,/g, '')) }); }}>
                    <h3>기본 설정</h3>
                    <div className="ws-field-group"><label htmlFor="settings-household-name">가계부 이름</label><input id="settings-household-name" className="ws-input" required maxLength={40} disabled={!isAdmin || busy} value={settingsName} onChange={event => setSettingsName(event.target.value)}/></div>
                    <div className="ws-field-group"><label htmlFor="settings-household-type">가계부 유형</label><select id="settings-household-type" className="ws-input" disabled={!isAdmin || busy} value={settingsType} onChange={event => setSettingsType(event.target.value as 'WEALTH' | 'CLUB' | 'COMPANY')}><option value="WEALTH">개인·가족 가계부</option><option value="CLUB">모임 회계형</option><option value="COMPANY">회사 회계형</option></select><small>유형에 따라 자산 관리, 구성원별 회비 관리 또는 세금계산서·부가세 메뉴를 제공합니다.</small></div>
                    {settingsType === 'COMPANY' ? null : settingsType === 'WEALTH' ? <div className="ws-field-group"><label htmlFor="settings-household-goal">목돈 목표 (선택 · 원)</label><input id="settings-household-goal" className="ws-input" type="text" inputMode="numeric" placeholder="나중에 정해도 돼요" disabled={!isAdmin || busy} value={settingsGoal} onChange={event => setSettingsGoal(formatNumberWithCommas(event.target.value))}/><small>{settingsGoal ? formatKoreanCurrency(Number(settingsGoal.replace(/,/g, ''))) : '비워 두면 목돈 목표를 사용하지 않습니다.'}</small></div> : <div className="ws-field-group"><label htmlFor="settings-household-dues">1인당 월 회비 기준 (원)</label><input id="settings-household-dues" className="ws-input" type="text" inputMode="numeric" required disabled={!isAdmin || busy} value={settingsDues} onChange={event => setSettingsDues(formatNumberWithCommas(event.target.value))}/><small>0원으로 설정하면 입금 내역만 표시합니다. 기준 금액은 조회하는 달의 납부 상태 계산에 사용됩니다.</small></div>}
                    {isAdmin ? <button type="submit" className="ws-btn-open-ledger" disabled={busy}>{busy ? '저장 중…' : '설정 저장'}</button> : <p>가계부 관리자만 설정을 변경할 수 있습니다.</p>}
                  </form>
                  {/* Default invite rotation */}
                  {isAdmin && (
                    <div className="ws-action-card">
                      <div className="ws-action-text">
                        <h4>기본 초대 코드 갱신</h4>
                        <p>
                          기본 코드를 새로 생성하면 기존 기본 코드는 즉시 만료되어 접속할 수 없습니다.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ws-btn-sm ws-btn-subtle"
                        disabled={busy}
                        onClick={() => {
                          if (confirm('기본 초대 코드를 새로 갱신하시겠습니까?')) {
                            void action({ action: 'rotate-invite' });
                          }
                        }}
                      >
                        <RefreshCw size={13} />
                        <span>코드 재발급</span>
                      </button>
                    </div>
                  )}

                  {/* Leave household */}
                  {!isOwner && (
                    <div className="ws-action-card">
                      <div className="ws-action-text">
                        <h4>가계부 나가기</h4>
                        <p>이 가계부에서 퇴장하며, 더 이상 기록과 자산 현황을 조회할 수 없습니다.</p>
                      </div>
                      <button
                        type="button"
                        className="ws-btn-sm ws-btn-danger-sm"
                        disabled={busy}
                        onClick={() => {
                          if (confirm('정말로 가계부에서 나가시겠습니까?')) {
                            void action({ action: 'leave' });
                          }
                        }}
                      >
                        <LogOut size={13} />
                        <span>가계부 나가기</span>
                      </button>
                    </div>
                  )}

                  {/* Delete household (Owner only) */}
                  {isOwner && (
                    <div className="ws-action-card ws-danger-card">
                      <div className="ws-action-text">
                        <h4>가계부 삭제</h4>
                        <p>
                          {members.length > 1
                            ? '다른 구성원이 참여 중일 때는 먼저 소유권을 이전하거나 구성원을 내보내야 삭제할 수 있습니다.'
                            : '가계부를 영구 삭제합니다. 개인 계정에 기록된 거래 내역은 유지됩니다.'}
                        </p>
                      </div>
                      {members.length === 1 && (
                        <button
                          type="button"
                          className="ws-btn-sm ws-btn-danger-sm"
                          disabled={busy}
                          onClick={() => {
                            if (confirm('가계부를 완전히 삭제하시겠습니까? 거래 내역은 내 계정에 보존됩니다.')) {
                              void action({ action: 'delete-household' });
                            }
                          }}
                        >
                          <Trash2 size={13} />
                          <span>가계부 삭제</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <WorkspaceOnboarding
            mode={setupMode}
            onModeChange={mode => { setSetupMode(mode); setError(''); }}
            type={householdType}
            onTypeChange={type => {
              setHouseholdType(type);
              const defaults = { WEALTH: '우리집 가계부', CLUB: '테니스 동호회', COMPANY: '회사 가계부' } as const;
              if (Object.values(defaults).includes(name as typeof defaults[keyof typeof defaults])) setName(defaults[type]);
            }}
            name={name}
            onNameChange={setName}
            goal={goalAmount}
            onGoalChange={setGoalAmount}
            inviteCode={inviteCode}
            onInviteCodeChange={setInviteCode}
            busy={busy}
            onCreate={create}
            onJoin={join}
          />
        )}

        <footer className="ws-account-footer"><span>로그인 방법이나 계정 설정이 필요한가요?</span><a href="/mypage">마이페이지 <ArrowRight size={14} /></a></footer>
      </div>
    </div>
  );
}
