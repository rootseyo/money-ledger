'use client';

import { useId, useState } from 'react';
import { Wallet, House, Users, Paperclip, Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const examples = [
  {
    label: '개인 가계부', icon: Wallet, title: '내 생활비, 가볍게 시작하기',
    description: '커피 한 잔부터 월급까지 기록하고, 이번 달 어디에 썼는지 확인해요.',
    incomeLabel: '이번 달 수입', income: '3,000,000', expense: '684,500', balance: '2,315,500',
    rows: [['월급', '급여', '+3,000,000', false], ['주간 장보기', '식비', '−58,000', true], ['점심 식사', '식비', '−12,000', false]],
    note: '월별 내역 · 카테고리 분석 · 반복 고정비',
  },
  {
    label: '가족 가계부', icon: House, title: '가족의 생활비를 함께 보기',
    description: '장보기, 공과금, 아이 교육비까지. 같은 장부에서 함께 기록해요.',
    incomeLabel: '이번 달 수입', income: '5,000,000', expense: '2,145,000', balance: '2,855,000',
    rows: [['생활비 입금', '생활비', '+5,000,000', false], ['아파트 관리비', '주거비', '−245,000', true], ['가족 장보기', '식비', '−86,000', true]],
    note: '가족 초대 · 역할별 권한 · 공동 생활비 관리',
  },
  {
    label: '모임 가계부', icon: Users, title: '회비부터 공동 지출까지 투명하게',
    description: '테니스 동호회, 친구 모임, 소모임의 입금과 사용 내역을 관리해요.',
    incomeLabel: '회비·기타 수입', income: '300,000', expense: '180,000', balance: '120,000',
    rows: [['김민수 · 10월 회비', '회비', '+30,000', false], ['이서연 · 10월 회비', '회비', '+30,000', false], ['테니스 코트 대관', '대관료', '−180,000', true]],
    note: '구성원별 회비 입금 · 납부 상태 · 공동 지출 증빙',
  },
] as const;

export default function LoginFeatureCarousel() {
  const [active, setActive] = useState(0);
  const id = useId();
  const example = examples[active];
  return <section className="service-preview" aria-label="용도별 가계부 예시">
    <div className="service-preview-tabs" role="tablist" aria-label="가계부 용도">
      {examples.map((item, index) => <button key={item.label} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={active === index} aria-controls={`${id}-panel`} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => {
        let next: number | undefined;
        if (event.key === 'ArrowRight') next = (index + 1) % examples.length;
        if (event.key === 'ArrowLeft') next = (index + examples.length - 1) % examples.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = examples.length - 1;
        if (next !== undefined) { event.preventDefault(); setActive(next); document.getElementById(`${id}-tab-${next}`)?.focus(); }
      }}><item.icon size={18} aria-hidden="true"/>{item.label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="service-preview-panel">
      <div className="service-preview-heading"><h2>{example.title}</h2><span>예시 데이터</span></div>
      <p>{example.description}</p>
      <div className="service-preview-totals">
        <div><span><ArrowDownLeft size={14}/>{example.incomeLabel}</span><strong>₩{example.income}</strong></div>
        <div><span><ArrowUpRight size={14}/>{active === 2 ? '공동 지출' : '이번 달 지출'}</span><strong>₩{example.expense}</strong></div>
        <div><span>수입 − 지출</span><strong>₩{example.balance}</strong></div>
      </div>
      <table className="service-preview-table"><caption className="sr-only">{example.label} 거래 예시</caption><thead><tr><th scope="col">내역</th><th scope="col">분류</th><th scope="col">금액</th></tr></thead><tbody>{example.rows.map(([name, category, amount, receipt]) => <tr key={name}><td>{name}{receipt && <Paperclip size={13} aria-label="영수증 첨부"/>}</td><td>{category}</td><td className={amount.startsWith('+') ? 'is-income' : ''}>{amount}원</td></tr>)}</tbody></table>
      <p className="service-preview-note"><Check size={15}/>{example.note}</p>
    </div>
  </section>;
}
