'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { createPortal } from 'react-dom';
import { LockKeyhole, Shield, UnlockKeyhole } from 'lucide-react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

interface SecurityContextValue {
  screenReady: boolean;
  privateIncome: boolean;
  togglePrivateIncome: () => void;
  lockScreen: () => Promise<void>;
  registerPasskey: (password: string) => Promise<{ success: boolean; error?: string }>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useScreenSecurity() {
  const value = useContext(SecurityContext);
  if (!value) throw new Error('useScreenSecurity must be used inside ScreenSecurity');
  return value;
}

// Backwards-compatible alias for existing components
export const useAdminScreenSecurity = useScreenSecurity;

export default function ScreenSecurity({ children }: { children: ReactNode }) {
  const segment = useSelectedLayoutSegment();
  const publicPage = ['login', 'signup', 'terms', 'privacy'].includes(segment || '');
  const [privateIncome, setPrivateIncome] = useState(false);
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [unlockMode, setUnlockMode] = useState('password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/screen-lock', { cache: 'no-store' });
      if (!response.ok) throw new Error('잠금 상태를 확인하지 못했습니다.');
      const data = await response.json();
      setLocked(data.locked);
      setUnlockMode(data.unlockMode || 'password');
      setHasPasskey(data.hasPasskey);
      setChecked(true);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '상태 확인 실패');
    }
  }, []);

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (!endpoint) return;

    try {
      const visitorKey = 'money_visitor_id';
      const sessionKey = 'money_session_id';
      let visitorId = localStorage.getItem(visitorKey);
      if (!visitorId) {
        visitorId = (
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        ).replace(/-/g, '');
        localStorage.setItem(visitorKey, visitorId);
      }
      let sessionId = sessionStorage.getItem(sessionKey);
      if (!sessionId) {
        sessionId = (
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        ).replace(/-/g, '');
        sessionStorage.setItem(sessionKey, sessionId);
      }
      void fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          siteId: 'money',
          path: window.location.pathname,
          referrer: document.referrer,
          screenWidth: window.screen?.width ?? window.innerWidth,
          visitorId,
          sessionId,
        }),
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        credentials: 'omit',
        mode: 'cors',
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore analytics errors
    }
  }, []);

  useEffect(() => {
    if (!publicPage) void refresh();
  }, [refresh, publicPage]);

  useEffect(() => {
    if (privateIncome) {
      document.documentElement.setAttribute('data-income-private', 'true');
    } else {
      document.documentElement.removeAttribute('data-income-private');
    }
    return () => document.documentElement.removeAttribute('data-income-private');
  }, [privateIncome]);

  useEffect(() => {
    if (locked) passwordRef.current?.focus();
  }, [locked]);

  const lockScreen = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/screen-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock' }),
      });
      if (!response.ok) throw new Error('화면 잠금을 설정하지 못했습니다.');
      setPrivateIncome(true);
      setLocked(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '잠금 실패');
    } finally {
      setBusy(false);
    }
  }, []);

  const unlock = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/screen-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '잠금 해제에 실패했습니다.');
      setLocked(false);
      setPassword('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '잠금 해제 실패');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    await unlock({ action: 'unlock-password', password });
  };

  const handlePasskeyUnlock = async () => {
    setBusy(true);
    setError('');
    try {
      const optionsRes = await fetch('/api/screen-lock/passkey?action=authenticate-options', {
        method: 'POST',
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) throw new Error(options.error || '인증 옵션을 받지 못했습니다.');

      const assertion = await startAuthentication({ optionsJSON: options });
      await unlock({ action: 'unlock-passkey', credential: assertion });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '패스키 인증 실패');
      setBusy(false);
    }
  };

  const registerPasskey = async (pwd: string) => {
    try {
      const optionsRes = await fetch('/api/screen-lock/passkey?action=register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      const options = await optionsRes.json();
      if (!optionsRes.ok) return { success: false, error: options.error || '등록 옵션 오류' };

      const attestation = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch('/api/screen-lock/passkey?action=register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: attestation }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) return { success: false, error: verifyData.error || '등록 검증 실패' };

      await refresh();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '패스키 등록 실패' };
    }
  };

  const togglePrivateIncome = useCallback(() => {
    setPrivateIncome((prev) => !prev);
  }, []);

  return (
    <SecurityContext.Provider
      value={{
        screenReady: checked && !locked,
        privateIncome,
        togglePrivateIncome,
        lockScreen,
        registerPasskey,
      }}
    >
      {children}
      {!publicPage && locked && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(10, 15, 29, 0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              color: '#f8fafc',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '380px',
                background: '#131b2e',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '32px 24px',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <LockKeyhole size={24} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 700 }}>
                가계부 화면이 잠겨 있습니다
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: '#94a3b8' }}>
                {unlockMode === 'demo' ? '체험을 계속하려면 아래 버튼을 눌러주세요.' : unlockMode === 'kakao' ? '카카오로 다시 인증하여 잠금을 해제하세요.' : '계정 비밀번호 또는 패스키로 잠금을 해제하세요.'}
              </p>

              {error && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              {unlockMode === 'password' ? <form onSubmit={handlePasswordUnlock}>
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="계정 비밀번호 입력"
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#0a0f1d',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    marginBottom: '12px',
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !password.trim()}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: '#3b82f6',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: busy || !password.trim() ? 'not-allowed' : 'pointer',
                    opacity: busy || !password.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: hasPasskey ? '8px' : '0',
                  }}
                >
                  <UnlockKeyhole size={16} /> 비밀번호로 잠금 해제
                </button>
              </form> : <button type="button" disabled={busy} style={{ width: '100%', padding: 12, background: '#3b82f6', color: '#fff', border: 0, borderRadius: 8 }} onClick={async () => {
                if (unlockMode === 'demo') { await unlock({ action: 'unlock-demo' }); return; }
                setBusy(true); setError('');
                try {
                  const response = await fetch('/api/auth/kakao', { method: 'POST' });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error || '인증 실패');
                  window.location.assign(data.url);
                } catch (cause) { setError(cause instanceof Error ? cause.message : '인증 실패'); setBusy(false); }
              }}>{unlockMode === 'demo' ? '데모 체험 계속하기' : '카카오로 잠금 해제'}</button>}


              {hasPasskey && (
                <button
                  type="button"
                  onClick={handlePasskeyUnlock}
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Shield size={16} /> 패스키(Touch ID / Face ID)로 해제
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </SecurityContext.Provider>
  );
}
