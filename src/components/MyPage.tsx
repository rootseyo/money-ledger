'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, Download, KeyRound, LogOut, MessageCircle, ShieldCheck, UserRound } from 'lucide-react';
import styles from './MyPage.module.css';

type Profile = { id: string; name: string; email: string | null; isDemo: boolean; createdAt: string; kakaoLinked: boolean; hasPassword: boolean; hasHousehold: boolean; deletionVerified: boolean };

type Feedback = { kind: 'error' | 'success'; text: string } | null;

export default function MyPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/account/profile', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) { router.replace('/login'); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '계정 정보를 불러오지 못했습니다.');
        setProfile(data.user);
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : '계정 정보를 불러오지 못했습니다.'); });
    return () => controller.abort();
  }, [router]);

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setFeedback(null);
    try { await task(); } catch (error) { setFeedback({ kind: 'error', text: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.' }); }
    finally { setBusy(''); }
  }

  async function post(url: string, body: unknown) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
    return data;
  }

  function changePassword(event: FormEvent) {
    event.preventDefault();
    void run('password', async () => {
      if (newPassword !== confirmPassword) throw new Error('새 비밀번호가 일치하지 않습니다.');
      await post('/api/account/password', { currentPassword, newPassword, confirmPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setFeedback({ kind: 'success', text: '비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용해 주세요.' });
    });
  }

  function startKakao(action: 'link' | 'delete') {
    void run(action, async () => {
      const data = await post('/api/account/kakao', { action, password: linkPassword });
      setLinkPassword('');
      window.location.assign(data.url);
    });
  }

  function deleteAccount(event: FormEvent) {
    event.preventDefault();
    void run('delete', async () => {
      await post('/api/account/delete', { password: deletePassword, confirmation, email: profile?.email });
      router.replace('/login?deleted=1');
    });
  }

  const kakaoResult = params.get('kakao');
  const oauthFeedback: Feedback = kakaoResult === 'linked' ? { kind: 'success', text: '카카오 계정을 연결했습니다. 이제 이메일과 카카오로 같은 가계부에 로그인할 수 있어요.' } : kakaoResult === 'verified' ? { kind: 'success', text: '본인 인증을 완료했습니다. 5분 안에 아래 회원 탈퇴를 진행해 주세요.' } : kakaoResult === 'conflict' ? { kind: 'error', text: '이미 연결된 계정입니다. 다른 회원이 사용하는 카카오 계정은 연결할 수 없습니다.' } : kakaoResult === 'error' ? { kind: 'error', text: '카카오 인증을 완료하지 못했습니다. 연결할 카카오 계정을 확인하고 다시 시도해 주세요.' } : null;
  const notice = feedback || oauthFeedback;

  return (
    <div className={`account-page ${styles.page}`}>
      <div className={styles.container}>
        <nav className={styles.nav} aria-label="페이지 이동"><Link href="/"><ArrowLeft size={16} />가계부로 돌아가기</Link><Link href="/workspace">가계부 관리</Link></nav>
        <header className={styles.heading}><p>내 계정</p><h1>마이페이지</h1><span>로그인 방법과 계정 정보를 한곳에서 관리하세요.</span></header>
        {loadError && <p className={styles.error} role="alert">{loadError} <button onClick={() => window.location.reload()}>다시 시도</button></p>}
        {!profile && !loadError && <p className={styles.loading} role="status">계정 정보를 불러오는 중…</p>}
        {profile && <main className={styles.content}>
          {notice && <p className={notice.kind === 'error' ? styles.error : styles.success} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
          <section className={styles.card} aria-labelledby="profile-title">
            <div className={styles.sectionTitle}><UserRound size={20} /><h2 id="profile-title">내 정보</h2>{profile.isDemo && <span className={styles.badge}>데모 체험</span>}</div>
            <dl className={styles.info}><div><dt>이름</dt><dd>{profile.name}</dd></div><div><dt>이메일</dt><dd>{profile.email || '카카오로 가입한 계정'}</dd></div><div><dt>가입일</dt><dd>{new Date(profile.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</dd></div></dl>
          </section>

          <section className={styles.card} aria-labelledby="login-title">
            <div className={styles.sectionTitle}><ShieldCheck size={20} /><h2 id="login-title">로그인 방법</h2></div>
            <div className={styles.loginMethod}><div className={styles.methodName}><MessageCircle size={20} /><div><strong>카카오 계정</strong><p>{profile.kakaoLinked ? '카카오로 같은 가계부에 로그인할 수 있어요.' : '기존 가계부 그대로, 카카오로도 간편하게 로그인하세요.'}</p></div></div><span className={profile.kakaoLinked ? styles.connected : styles.badge}>{profile.kakaoLinked ? <><Check size={14} />연결됨</> : '미연결'}</span></div>
            {!profile.kakaoLinked && !profile.isDemo && profile.hasPassword && <form onSubmit={event => { event.preventDefault(); startKakao('link'); }} className={styles.form}>
              <label htmlFor="link-password">연결 전 현재 비밀번호 확인</label><input id="link-password" type="password" autoComplete="current-password" required disabled={Boolean(busy)} value={linkPassword} onChange={event => setLinkPassword(event.target.value)} />
              <p className={styles.hint}>비밀번호 확인 후 카카오 인증 화면으로 이동합니다. 다른 회원에게 연결된 카카오 계정은 사용할 수 없어요.</p>
              <button className={styles.kakao} disabled={Boolean(busy)}>{busy === 'link' ? '카카오 인증으로 이동 중…' : '카카오 계정 연결하기'}</button>
            </form>}
            {profile.isDemo && <p className={styles.hint}>카카오 연결과 비밀번호 변경은 가입 후 이용할 수 있어요. <Link href="/signup">회원가입</Link></p>}
          </section>

          {profile.hasPassword && <section className={styles.card} aria-labelledby="password-title">
            <div className={styles.sectionTitle}><KeyRound size={20} /><h2 id="password-title">비밀번호 변경</h2></div>
            <form onSubmit={changePassword} className={styles.form}>
              <label htmlFor="current-password">현재 비밀번호</label><input id="current-password" type="password" autoComplete="current-password" required disabled={Boolean(busy)} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
              <label htmlFor="new-password">새 비밀번호</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} disabled={Boolean(busy)} value={newPassword} onChange={event => setNewPassword(event.target.value)} aria-describedby="password-hint" />
              <p id="password-hint" className={styles.hint}>8자 이상 입력해 주세요. 한글 등 다국어는 UTF-8 기준 72바이트까지 사용할 수 있어요.</p>
              <label htmlFor="confirm-password">새 비밀번호 확인</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} disabled={Boolean(busy)} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
              <button className={styles.primary} disabled={Boolean(busy)}>{busy === 'password' ? '변경 중…' : '비밀번호 변경하기'}</button>
            </form>
          </section>}

          <section className={styles.card} aria-labelledby="data-title">
            <div className={styles.sectionTitle}><Download size={20} /><h2 id="data-title">데이터 및 계정 관리</h2></div>
            <p className={styles.hint}>거래 내역과 설정을 파일로 보관할 수 있어요.</p>
            <div className={styles.actions}><button disabled={Boolean(busy)} onClick={() => void run('backup', async () => {
              const response = await fetch('/api/account/export');
              if (!response.ok) throw new Error('데이터를 내보내지 못했습니다. 다시 시도해 주세요.');
              const url = URL.createObjectURL(await response.blob());
              const link = document.createElement('a'); link.href = url; link.download = 'money-ledger-export.json'; link.click(); URL.revokeObjectURL(url);
              setFeedback({ kind: 'success', text: '백업 파일을 다운로드했습니다.' });
            })}><Download size={16} />{busy === 'backup' ? '다운로드 중…' : '내 데이터 백업'}</button><button disabled={Boolean(busy)} onClick={() => void run('logout', async () => { await post('/api/auth/logout', {}); router.replace('/login'); })}><LogOut size={16} />로그아웃</button></div>
            <details className={styles.danger} open={kakaoResult === 'verified' ? true : undefined}>
              <summary>회원 탈퇴<ChevronDown size={16} /></summary>
              <div className={styles.dangerBody}>
                <p>탈퇴하면 개인 거래 내역, 설정, API 토큰이 영구 삭제되며 복구할 수 없습니다. 필요한 데이터는 먼저 백업해 주세요.</p>
                {profile.hasHousehold ? <p className={styles.warning}>참여 중인 가계부가 있습니다. <Link href="/workspace?tab=settings">가계부 관리</Link>에서 먼저 나가 주세요. 소유자는 소유권을 이전하거나 가계부를 삭제해야 합니다.</p> : <form onSubmit={deleteAccount} className={styles.form}>
                  {profile.hasPassword && <><label htmlFor="delete-password">현재 비밀번호</label><input id="delete-password" type="password" autoComplete="current-password" required disabled={Boolean(busy)} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></>}
                  {!profile.hasPassword && !profile.isDemo && <><p className={styles.hint}>{profile.deletionVerified ? '카카오 본인 인증을 완료했습니다.' : '탈퇴를 위해 카카오로 본인 인증을 진행해 주세요.'}</p><button type="button" className={styles.kakao} disabled={Boolean(busy)} onClick={() => startKakao('delete')}>카카오로 {profile.deletionVerified ? '다시 ' : ''}본인 인증</button></>}
                  <label htmlFor="delete-confirmation">확인 문구: 계정 삭제</label><input id="delete-confirmation" required disabled={Boolean(busy)} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="계정 삭제" autoComplete="off" />
                  <label className={styles.checkbox}><input type="checkbox" required disabled={Boolean(busy)} checked={deleteAcknowledged} onChange={event => setDeleteAcknowledged(event.target.checked)} />데이터가 영구 삭제되는 것을 확인했습니다.</label>
                  <button className={styles.deleteButton} disabled={Boolean(busy) || confirmation !== '계정 삭제' || !deleteAcknowledged || (!profile.hasPassword && !profile.isDemo && !profile.deletionVerified)}>{busy === 'delete' ? '탈퇴 처리 중…' : '회원 탈퇴하기'}</button>
                </form>}
              </div>
            </details>
          </section>
        </main>}
      </div>
    </div>
  );
}
