'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Paperclip, Plus, RefreshCw, Users } from 'lucide-react';
import { duesStatus, type DuesMember } from '@/lib/club-ledger';
import { kstDate } from '@/lib/fixed-expense-schedule';
import LedgerDialog from './LedgerDialog';
import TransactionReceipts from './TransactionReceipts';
import type { Transaction } from './ledger-types';
import './club-ledger.css';

type Payment = { transactionId: string; memberId: string; month: string; member: DuesMember; transaction: Transaction };
type Data = { members: DuesMember[]; payments: Payment[]; history: Payment[]; monthlyDues: number; canEdit: boolean };
export default function ClubDues({ month, onPrevMonth, onNextMonth, onCurrentMonth, onChanged, onEdit }: {
  month: string; onPrevMonth: () => void; onNextMonth: () => void; onCurrentMonth: () => void; onChanged: () => void; onEdit: (item: Transaction) => void;
}) {
  const [loadedData, setData] = useState<Data | null>(null);
  const [selectedMember, setSelectedMember] = useState('');
  const [version, setVersion] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<{ memberId: string; month: string; date: string; amount: string; memo: string; entryId: string } | null>(null);
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [detail, setDetail] = useState<Payment | null>(null);
  const queryKey = `${month}:${selectedMember}:${version}`;
  const loading = loadedKey !== queryKey;
  const data = loading ? null : loadedData;
  const refresh = useCallback(() => { setVersion(value => value + 1); onChanged(); }, [onChanged]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/club-dues?month=${encodeURIComponent(month)}${selectedMember ? `&memberId=${selectedMember}` : ''}`, { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '불러오지 못했습니다.'); setError(''); setData(result);
    }).catch(error => { if (!controller.signal.aborted) { setData(null); setError(error.message); } }).finally(() => { if (!controller.signal.aborted) setLoadedKey(queryKey); });
    return () => controller.abort();
  }, [month, selectedMember, version, queryKey]);
  async function action(body: Record<string, unknown>) {
    if (pending.current) return null;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/club-dues', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.'); refresh(); return result;
    } catch (error) { setError(error instanceof Error ? error.message : '저장하지 못했습니다.'); return null; }
    finally { pending.current = false; setBusy(false); }
  }
  const payments = data?.payments || [];
  const members = data?.members || [];
  const activeMembers = members.filter(member => !member.archived);
  const totalFor = (id: string) => payments.filter(payment => payment.memberId === id).reduce((sum, payment) => sum + payment.transaction.amount, 0);
  const total = payments.reduce((sum, payment) => sum + payment.transaction.amount, 0);
  const paidCount = activeMembers.filter(member => totalFor(member.id) >= (data?.monthlyDues || 1)).length;
  const displayedPayments = selectedMember ? data?.history || [] : payments;
  function openPayment(memberId = selectedMember) {
    setSaved(null); setForm({ memberId: memberId || activeMembers[0]?.id || '', month, date: kstDate(), amount: data?.monthlyDues ? String(data.monthlyDues) : '', memo: '', entryId: crypto.randomUUID() });
  }
  return <section className="ledger-surface club-ledger" aria-busy={loading || busy}>
    <header className="club-section-title"><div><h2><Users size={20}/>구성원별 회비</h2><p className="ledger-muted">입금일과 회비 대상 월을 구분해 분할 납부·선납 내역을 기록합니다.</p></div><nav className="ledger-inline-month-nav" aria-label="회비 조회 월"><button className="btn btn-secondary" onClick={onPrevMonth} aria-label="지난달"><ChevronLeft size={16}/></button><strong>{month}</strong><button className="btn btn-secondary" onClick={onNextMonth} aria-label="다음달"><ChevronRight size={16}/></button><button className="btn btn-secondary" onClick={onCurrentMonth}>이번 달</button><button className="btn btn-secondary" onClick={() => setVersion(value => value + 1)} aria-label="회비 새로고침"><RefreshCw size={15}/></button></nav></header>
    {error && <p role="alert" className="club-feedback">{error}</p>}
    <div className="club-summary"><div><span>대상 월 회비 합계</span><strong data-sensitive-income="true">₩{total.toLocaleString()}</strong></div><div><span>{data?.monthlyDues ? '납부 완료' : '입금한 구성원'}</span><strong>{paidCount} / {activeMembers.length}명</strong></div><div><span>월 회비 기준</span><strong>{data?.monthlyDues ? `₩${data.monthlyDues.toLocaleString()}` : '미설정'}</strong></div></div>
    <div className="club-section-title"><h3>회비 명단</h3>{data?.canEdit && <button type="button" className="btn btn-primary" disabled={!activeMembers.length || busy} onClick={() => openPayment()}><Plus size={16}/>회비 입금 등록</button>}</div>
    {!data?.monthlyDues && <p className="ledger-muted">가계부 설정에서 월 회비 기준을 입력하면 납부 완료·일부 입금·미입금 상태를 확인할 수 있습니다.</p>}
    <div className="club-table-scroll"><table className="club-member-table"><thead><tr><th>구성원</th><th>입금 합계</th><th>최근 입금일</th><th>납부 상태</th>{data?.canEdit && <th>관리</th>}</tr></thead><tbody>
      {members.filter(member => showArchived || !member.archived || totalFor(member.id) > 0).map(member => {
        const sum = totalFor(member.id); const last = payments.find(payment => payment.memberId === member.id);
        return <tr key={member.id}><td><button type="button" className="club-member-name" aria-pressed={selectedMember === member.id} onClick={() => setSelectedMember(previous => previous === member.id ? '' : member.id)}>{member.name}{member.archived ? ' (활동 종료)' : ''}</button></td><td className="club-amount" data-sensitive-income="true">₩{sum.toLocaleString()}</td><td>{last ? kstDate(last.transaction.notifiedAt) : '—'}</td><td><span className="club-status" data-paid={sum > 0 && (!data?.monthlyDues || sum >= data.monthlyDues)}>{duesStatus(sum, data?.monthlyDues || 0)}</span></td>{data?.canEdit && <td><div className="club-form-actions">{!member.archived && <button type="button" className="ledger-text-button" disabled={busy} onClick={() => openPayment(member.id)}>입금 등록</button>}<button type="button" className="ledger-text-button" disabled={busy} onClick={() => { setRenaming(member.id); setNewName(member.name); }}>이름 변경</button><button type="button" className="ledger-text-button" disabled={busy} onClick={() => void action({ action: 'archive-member', memberId: member.id, archived: !member.archived })}>{member.archived ? '복귀' : '활동 종료'}</button></div></td>}</tr>;
      })}
      {!members.length && <tr><td colSpan={5}>{loading ? '불러오는 중…' : '회비를 기록할 구성원을 추가해 주세요.'}</td></tr>}
    </tbody></table></div>
    <label className="ledger-muted"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)}/> 활동 종료 구성원 표시</label>
    {data?.canEdit && <form className="club-member-tools" onSubmit={async event => { event.preventDefault(); const result = await action({ action: renaming ? 'rename-member' : 'add-member', name: newName, memberId: renaming }); if (result) { setNewName(''); setRenaming(''); } }}>
      <label className="ledger-field">{renaming ? '구성원 이름 변경' : '구성원 추가 (앱 가입 없이 등록 가능)'}<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={40} required placeholder="예: 김민수"/></label><button className="btn btn-secondary" disabled={busy || !newName.trim()} type="submit">{renaming ? '이름 저장' : '추가'}</button>{renaming ? <button type="button" className="ledger-text-button" onClick={() => { setRenaming(''); setNewName(''); }}>취소</button> : <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void action({ action: 'import-members' })}>앱 구성원 불러오기</button>}
    </form>}
    <div className="club-section-title"><h3>{selectedMember ? `${members.find(member => member.id === selectedMember)?.name || ''}의 전체 입금 내역 (최근 200건)` : `${month} 대상 회비 입금 내역`}</h3>{selectedMember && <button className="ledger-text-button" onClick={() => setSelectedMember('')}>전체 구성원 보기</button>}</div>
    <div className="club-table-scroll"><table className="club-member-table"><thead><tr><th>입금일</th><th>구성원</th><th>회비 대상 월</th><th>금액</th><th>메모·영수증</th></tr></thead><tbody>{displayedPayments.map(payment => <tr key={payment.transactionId}><td>{kstDate(payment.transaction.notifiedAt)}</td><td>{payment.member.name}</td><td>{payment.month}</td><td className="club-amount" data-sensitive-income="true">₩{payment.transaction.amount.toLocaleString()}</td><td><button className="ledger-text-button" type="button" onClick={() => setDetail(payment)}><Paperclip size={14}/>{payment.transaction._count?.receipts || 0}개 · 상세 보기</button></td></tr>)}{!displayedPayments.length && <tr><td colSpan={5}>{loading ? '불러오는 중…' : '등록된 입금 내역이 없습니다.'}</td></tr>}</tbody></table></div>
    {form && <LedgerDialog title={saved ? '회비 입금 등록 완료' : '회비 입금 등록'} onClose={() => { if (!busy) { setForm(null); setSaved(null); } }}>
      {saved ? <><p>거래 내역에도 함께 등록했습니다. 입금 증빙을 첨부할 수 있습니다.</p><TransactionReceipts transactionId={saved.id} canEdit={!!data?.canEdit} onChanged={refresh}/><div className="ledger-dialog-actions"><button type="button" className="btn btn-primary" onClick={() => { setForm(null); setSaved(null); }}>완료</button></div></> : <form className="club-form" onSubmit={async event => { event.preventDefault(); const result = await action({ action: 'payment', ...form, amount: Number(form.amount.replace(/,/g, '')) }); if (result) setSaved(result.transaction); }}>
        <label className="ledger-field">납부자<select required value={form.memberId} onChange={event => setForm({ ...form, memberId: event.target.value })}><option value="">구성원 선택</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
        <div className="club-form-grid"><label className="ledger-field">입금일<input type="date" required value={form.date} onChange={event => setForm({ ...form, date: event.target.value })}/></label><label className="ledger-field">회비 대상 월<input type="month" required value={form.month} onChange={event => setForm({ ...form, month: event.target.value })}/></label></div>
        <label className="ledger-field">입금액 (원)<input inputMode="numeric" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value.replace(/[^0-9,]/g, '') })}/></label><label className="ledger-field">메모<textarea value={form.memo} maxLength={2000} rows={2} onChange={event => setForm({ ...form, memo: event.target.value })}/></label>
        {error && <p role="alert">{error}</p>}<div className="ledger-dialog-actions"><button className="btn btn-primary" disabled={busy} type="submit">{busy ? '저장 중…' : '입금 등록'}</button></div>
      </form>}
    </LedgerDialog>}
    {detail && <LedgerDialog title={`${detail.member.name} 회비 입금`} onClose={() => setDetail(null)}><p>{kstDate(detail.transaction.notifiedAt)} 입금 · {detail.month} 대상</p><h3 data-sensitive-income="true">₩{detail.transaction.amount.toLocaleString()}</h3><p>{detail.transaction.content || '메모 없음'}</p><TransactionReceipts transactionId={detail.transactionId} canEdit={!!data?.canEdit} onChanged={refresh}/>{data?.canEdit && <div className="ledger-dialog-actions"><button type="button" className="btn btn-primary" onClick={() => { onEdit(detail.transaction); setDetail(null); }}>거래 수정</button></div>}</LedgerDialog>}
  </section>;
}
