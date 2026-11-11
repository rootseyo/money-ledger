'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Transaction } from './ledger-types';

interface History {
  perform: (body: Record<string, unknown>) => Promise<{ transaction: Transaction | null; deletedIds?: string[] }>;
  undo: () => Promise<void>;
  busy: boolean;
  remember: (field: string, value: string) => void;
  recent: Record<string, string[]>;
}
const Context = createContext<History | null>(null);
export const useLedgerHistory = () => {
  const history = useContext(Context);
  if (!history) throw new Error('LedgerHistoryProvider is required');
  return history;
};
export default function LedgerHistoryProvider({ children, onChanged, onDeleted }: { children: ReactNode; onChanged: () => void; onDeleted?: (ids: string[]) => void }) {
  const stack = useRef<string[]>([]);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recent, setRecent] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ledger-recent-values') || '{}');
      if (saved && typeof saved === 'object') setRecent(Object.fromEntries(Object.entries(saved).filter(([, values]) => Array.isArray(values) && values.every(value => typeof value === 'string'))) as Record<string, string[]>);
    } catch {}
  }, []);
  const remember = (field: string, value: string) => {
    if (!value.trim()) return;
    setRecent(previous => {
      const next = { ...previous, [field]: [value, ...(previous[field] || []).filter(item => item !== value)].slice(0, 30) };
      try { localStorage.setItem('ledger-recent-values', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const request = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/card-transactions/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || '작업을 처리하지 못했습니다.');
    return data;
  };
  const perform = async (body: Record<string, unknown>) => {
    if (pending.current) throw new Error('이전 작업을 처리 중입니다.');
    pending.current = true; setBusy(true); setMessage('');
    try {
      const result = await request(body);
      if (result.undoToken) stack.current = [...stack.current.slice(-49), result.undoToken];
      if (body.action === 'delete' || body.action === 'delete-many') {
        const ids: string[] = result.deletedIds || [String(body.id)];
        if (onDeleted) onDeleted(ids); else onChanged();
        setMessage(`${ids.length}개 행을 삭제했습니다. ⌘Z / Ctrl+Z로 취소할 수 있습니다.`);
      }
      return result;
    } finally { pending.current = false; setBusy(false); }
  };
  const undo = async () => {
    if (pending.current) return;
    const token = stack.current.at(-1);
    if (!token) { setMessage('취소할 작업이 없습니다.'); return; }
    pending.current = true; setBusy(true);
    try {
      await request({ action: 'undo', token });
      stack.current.pop(); onChanged(); setMessage('이전 작업을 취소했습니다.');
    } catch (error) { setMessage(error instanceof Error ? error.message : '작업을 취소하지 못했습니다.'); }
    finally { pending.current = false; setBusy(false); }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault(); void undo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
  return <Context.Provider value={{ perform, undo, busy, remember, recent }}>{children}
    {message && <div className="ledger-history-notice" role="status">{message}<button type="button" aria-label="알림 닫기" onClick={() => setMessage('')}>×</button></div>}
  </Context.Provider>;
}
