'use client';
import { useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2 } from 'lucide-react';
import { MAX_RECEIPT_BYTES, MAX_RECEIPTS, type ReceiptInfo } from '@/lib/club-ledger';
import './club-ledger.css';

export default function TransactionReceipts({ transactionId, canEdit = true, onChanged }: { transactionId: string; canEdit?: boolean; onChanged?: () => void }) {
  const [receipts, setReceipts] = useState<ReceiptInfo[]>([]);
  const [loadedBase, setLoadedBase] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [removeId, setRemoveId] = useState('');
  const pending = useRef(false);
  const base = `/api/card-transactions/${encodeURIComponent(transactionId)}/receipts`;
  const loading = loadedBase !== base;
  useEffect(() => {
    const controller = new AbortController();
    fetch(base, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '영수증을 불러오지 못했습니다.');
      setMessage(''); setReceipts(data.receipts);
    }).catch(error => { if (!controller.signal.aborted) { setReceipts([]); setMessage(error.message); } }).finally(() => { if (!controller.signal.aborted) setLoadedBase(base); });
    return () => controller.abort();
  }, [base]);
  async function upload(files: File[]) {
    if (pending.current || !files.length) return;
    if (files.length + receipts.length > MAX_RECEIPTS) { setMessage('거래당 영수증은 5개까지 첨부할 수 있습니다.'); return; }
    if (files.some(file => file.size > MAX_RECEIPT_BYTES || !file.size)) { setMessage('파일당 5MB 이하의 영수증을 선택해 주세요.'); return; }
    pending.current = true; setBusy(true); setMessage('');
    let uploaded = 0;
    try {
      for (const file of files) {
        const form = new FormData(); form.append('file', file);
        const response = await fetch(base, { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '첨부하지 못했습니다.');
        setReceipts(previous => [...previous, data.receipt]); uploaded++;
      }
      setMessage(`${uploaded}개 영수증을 첨부했습니다.`);
    } catch (error) { setMessage(`${uploaded ? `${uploaded}개 첨부 완료. ` : ''}${error instanceof Error ? error.message : '첨부하지 못했습니다.'}`); }
    finally { pending.current = false; setBusy(false); if (uploaded) onChanged?.(); }
  }
  async function remove(id: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(`${base}/${id}`, { method: 'DELETE' });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || '삭제하지 못했습니다.'); }
      setReceipts(previous => previous.filter(receipt => receipt.id !== id)); setRemoveId(''); onChanged?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="transaction-receipts" aria-label="거래 영수증" aria-busy={loading || busy}>
    <div className="club-section-title"><h3><Paperclip size={16}/> 영수증 {receipts.length > 0 && <small>{receipts.length}개</small>}</h3>{canEdit && <label className="btn btn-secondary receipt-upload">{busy ? '처리 중…' : '파일 첨부'}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" multiple disabled={loading || busy || receipts.length >= MAX_RECEIPTS} onChange={event => { const files = Array.from(event.currentTarget.files || []); event.currentTarget.value = ''; void upload(files); }}/></label>}</div>
    {loading ? <p role="status" className="ledger-muted">영수증을 불러오는 중…</p> : receipts.length === 0 ? <p className="ledger-muted">첨부한 영수증이 없습니다.</p> : <ul className="receipt-list">{receipts.map(receipt => <li key={receipt.id}>
      <a href={`${base}/${receipt.id}`} target="_blank" rel="noopener noreferrer"><Paperclip size={14}/><span>{receipt.name}</span><small>{Math.ceil(receipt.size / 1024).toLocaleString()}KB</small></a>
      {canEdit && <button type="button" className="ledger-text-button" disabled={busy} aria-label={`${receipt.name} ${removeId === receipt.id ? '삭제 확인' : '삭제'}`} onClick={() => removeId === receipt.id ? void remove(receipt.id) : setRemoveId(receipt.id)}>{removeId === receipt.id ? '삭제 확인' : <Trash2 size={15}/>}</button>}
    </li>)}</ul>}
    {canEdit && <p className="ledger-muted receipt-hint">JPG·PNG·WebP·PDF · 파일당 5MB · 거래당 최대 5개 · 모바일 사진 촬영도 가능해요.</p>}
    {message && <p role="status" className="club-feedback">{message}</p>}
  </section>;
}
