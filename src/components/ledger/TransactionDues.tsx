'use client';
import { useEffect, useState } from 'react';
import type { DuesMember } from '@/lib/club-ledger';
import { kstDate } from '@/lib/fixed-expense-schedule';

export default function TransactionDues({ transactionId, onChanged, canEdit }: { transactionId: string; onChanged: () => void; canEdit: boolean }) {
  const [members, setMembers] = useState<DuesMember[]>([]);
  const [memberId, setMemberId] = useState('');
  const [month, setMonth] = useState(kstDate().slice(0, 7));
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetch(`/api/club-dues?month=${kstDate().slice(0, 7)}`, { signal: controller.signal }), fetch(`/api/card-transactions/${transactionId}`, { signal: controller.signal })]).then(async responses => {
      const [roster, detail] = await Promise.all(responses.map(response => response.json()));
      if (responses.some(response => !response.ok)) throw new Error(roster.error || detail.error || '회비 정보를 불러오지 못했습니다.');
      setMembers(roster.members); const payment = detail.transaction.duesPayment;
      setLinked(!!payment); setMemberId(payment?.memberId || ''); setMonth(payment?.month || kstDate(detail.transaction.notifiedAt).slice(0, 7));
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [transactionId]);
  async function save(unlink = false) {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/club-dues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: unlink ? 'unlink' : 'link', transactionId, memberId, month }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '회비 연결을 저장하지 못했습니다.');
      setLinked(!unlink); if (unlink) setMemberId(''); onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <section className="transaction-receipts" aria-label="회비 납부자 연결"><h3>회비 납부자 {linked && <small>· 연결됨</small>}</h3>
    <p className="ledger-muted">기존 입금 거래를 회비 명단에 연결합니다. 납부자 명단은 회비 관리에서 추가할 수 있습니다.</p>
    <div className="club-form-grid"><label className="ledger-field">납부자<select disabled={loading || busy || !canEdit} value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">일반 수입 (연결 안 함)</option>{members.filter(member => !member.archived || member.id === memberId).map(member => <option key={member.id} value={member.id}>{member.name}{member.archived ? ' (활동 종료)' : ''}</option>)}</select></label><label className="ledger-field">회비 대상 월<input type="month" disabled={loading || busy || !canEdit} value={month} onChange={event => setMonth(event.target.value)}/></label></div>
    {canEdit && <div className="club-form-actions"><button type="button" className="btn btn-secondary" disabled={loading || busy || !memberId || !month} onClick={() => void save()}>{busy ? '저장 중…' : '회비 연결 저장'}</button>{linked && <button type="button" className="ledger-text-button" disabled={loading || busy} onClick={() => void save(true)}>회비 연결 해제</button>}</div>}{error && <p role="alert">{error}</p>}
  </section>;
}
