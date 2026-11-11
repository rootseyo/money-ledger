'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wallet, MessageCircle } from 'lucide-react';
import LoginFeatureCarousel from '@/components/LoginFeatureCarousel';
import './auth.css';
import './auth-refresh.css';
export default function AuthForm({ signup = false, kakaoPending = false, kakaoError = false }: { signup?: boolean; kakaoPending?: boolean; kakaoError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTerms] = useState(false);
  const [privacyAccepted, setPrivacy] = useState(false);
  const [ignoreKakaoError, setIgnoreKakaoError] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const displayError = error || (kakaoError && !ignoreKakaoError ? '카카오 로그인에 실패했거나 취소되었습니다. 다시 시도해주세요.' : '');
  async function submit(endpoint: string, action: string, body: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(action); setError(''); setIgnoreKakaoError(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '요청에 실패했습니다.');
      if (data.url) { window.location.assign(data.url); return; }
      router.replace(action === 'demo' ? '/' : '/workspace'); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '요청에 실패했습니다.'); }
    finally { setBusy(''); }
  }
  return <main className={`auth-shell${signup ? ' auth-shell-signup' : ''}`}>
    {!signup && <section className="auth-intro" aria-label="서비스 소개">
      <Link href="/" className="auth-brand auth-brand-left"><span className="auth-logo"><Wallet size={27} /></span><span><strong>함께 쓰는 가계부</strong><small>나의 생활비부터 우리 모임의 회비까지</small></span></Link>
      <a href="#auth-account" className="auth-start-link">로그인·시작하기 →</a>
      <div className="auth-intro-copy"><p className="auth-eyebrow">혼자 써도, 함께 써도</p><h1>개인·가족·모임 가계부,<br /><em>함께 기록해요.</em></h1><p className="auth-lead">일상의 수입과 지출, 가족의 생활비, 동호회 회비까지.<br />목적에 맞는 가계부를 만들고 필요한 사람과 함께 기록하세요.</p></div>
      <LoginFeatureCarousel />
      <div className="auth-shared-features" aria-label="공통 기능">
        <div><strong>기록은 간편하게</strong><p>거래 입력부터 월별 조회, 고정비 관리까지.</p></div>
        <div><strong>증빙은 꼼꼼하게</strong><p>거래마다 사진·PDF 영수증을 첨부해요.</p></div>
        <div><strong>함께 써도 안심</strong><p>구성원을 초대하고 읽기·기록·관리 권한을 나눠요.</p></div>
      </div>
      <p className="auth-optional-note">목돈을 모으고 싶을 때는 <strong>목돈 목표</strong>도 이용해 보세요. 자산 현황과 저축 속도를 살펴보는 부가 기능입니다.</p>
    </section>}
    <section className="auth-card" id="auth-account">
    {signup && <div className="auth-brand"><span className="auth-logo"><Wallet size={26} /></span><h1>함께 쓰는 가계부</h1><p>개인·가족·모임, 내게 맞는 가계부를 시작해요.</p></div>}
    <h2>{signup ? (kakaoPending ? '카카오 회원가입 완료하기' : '회원가입') : '로그인'}</h2>
    <p className="auth-description">{signup ? '가입 후 가계부를 만들거나 초대로 참여할 수 있어요.' : '내 가계부와 함께 쓰는 기록을 이어가세요.'}</p>
    {displayError && <p className="auth-error" role="alert">{displayError}</p>}
    <form onSubmit={event => {
      event.preventDefault();
      void submit(signup ? (kakaoPending ? '/api/auth/kakao/register' : '/api/auth/register') : '/api/auth/login', 'account', { email, password, termsAccepted, privacyAccepted });
    }}>
      {!kakaoPending && <>
        <label htmlFor="auth-email">이메일</label><input id="auth-email" type="email" autoComplete="email" required maxLength={254} placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={!!busy} />
        <label htmlFor="auth-password">비밀번호</label><input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : undefined} placeholder={signup ? '8자 이상 입력해주세요' : '비밀번호를 입력해주세요'} value={password} onChange={e => setPassword(e.target.value)} disabled={!!busy} />
      </>}
      {signup && <fieldset className="auth-consent" disabled={!!busy}><legend>필수 약관 동의</legend>
        <label><input type="checkbox" checked={termsAccepted && privacyAccepted} onChange={e => { setTerms(e.target.checked); setPrivacy(e.target.checked); }} />전체 동의</label>
        <div><label><input type="checkbox" required checked={termsAccepted} onChange={e => setTerms(e.target.checked)} />[필수] 서비스 이용약관 동의</label><Link href="/terms" target="_blank" rel="noopener noreferrer">보기</Link></div>
        <div><label><input type="checkbox" required checked={privacyAccepted} onChange={e => setPrivacy(e.target.checked)} />[필수] 개인정보 수집·이용 동의</label><Link href="/privacy" target="_blank" rel="noopener noreferrer">처리방침</Link></div>
        <p>이메일·암호화된 비밀번호 또는 카카오 회원번호를 계정 생성·인증에 사용하며, 회원 탈퇴 시 삭제합니다. 동의를 거부할 수 있으나 가입이 제한됩니다.</p>
      </fieldset>}
      <button className="auth-primary" disabled={!!busy}>{busy === 'account' ? '처리 중…' : signup ? '회원가입' : '로그인'}</button>
    </form>
    {!kakaoPending && <><div className="auth-divider">또는</div><button className="auth-kakao" disabled={!!busy} onClick={() => void submit('/api/auth/kakao', 'kakao')}><MessageCircle size={18} fill="currentColor" />{busy === 'kakao' ? '카카오 연결 중…' : signup ? '카카오로 회원가입' : '카카오로 로그인'}</button></>}
    <p className="auth-switch">{signup ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'} <Link href={signup ? '/login' : '/signup'}>{signup ? '로그인' : '회원가입'}</Link></p>
    <button className="auth-demo" disabled={!!busy} onClick={() => void submit('/api/auth/demo', 'demo')}>{busy === 'demo' ? '샘플 가계부 준비 중…' : '가입 없이 가계부 체험하기 →'}</button>
    <p className="auth-demo-note">가입 없이 샘플 데이터로 체험하세요.<br />체험용 가계부에는 실제 개인정보를 입력하지 마세요.</p>
    <footer><Link href="/terms">서비스 이용약관</Link><Link href="/privacy">개인정보 처리방침</Link></footer>
    </section>
  </main>;
}
