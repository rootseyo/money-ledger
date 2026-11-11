'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Eye, X } from 'lucide-react';
import { useScreenSecurity } from '@/components/ScreenSecurity';
export default function LedgerDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { privateIncome, togglePrivateIncome } = useScreenSecurity();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="ledger-dialog" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="ledger-dialog-body"><header className="ledger-section-heading"><h2>{title}</h2><div className="ledger-dialog-header-actions"><button type="button" className="btn btn-secondary" aria-label={privateIncome ? '프라이버시 모드 끄기' : '프라이버시 모드 켜기'} aria-pressed={privateIncome} style={{ color: privateIncome ? 'var(--warning)' : 'var(--text-muted)' }} onClick={togglePrivateIncome}><Eye size={18}/></button><button type="button" className="btn btn-secondary" aria-label="닫기" onClick={onClose}><X size={18}/></button></div></header>{children}</div>
  </dialog>;
}
