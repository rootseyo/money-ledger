'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { positionLedgerTour } from '@/lib/ledger-tour-position';
import './ledger-tutorial.css';

type TutorialTab = 'ledger' | 'fixed-expenses' | 'categories' | 'payment-methods' | 'assets';
interface TutorialStep {
  target: string; name: string; title: string; description: string; tab?: TutorialTab;
  fallback?: { target: string; description: string };
}
const allSteps: TutorialStep[] = [
  { target: 'entry', tab: 'ledger', name: '입력', title: '여기서 거래를 추가해요', description: '사용처와 금액을 입력하고 카테고리·결제수단을 선택하세요. 어떤 화면에서든 이 버튼으로 거래를 등록할 수 있어요.' },
  { target: 'new-entry', tab: 'ledger', name: '입력', title: '목록에서도 바로 입력할 수 있어요', description: '이달의 수입·지출 내역 위·아래의 새 거래 추가를 눌러 입력하세요. PC에서는 빈 셀에 입력하고 금액 셀에서 Enter를 누르면 등록돼요.' },
  { target: 'monthly-fixed', tab: 'ledger', name: '고정비', title: '고정비는 매달 불러와요', description: '월을 선택한 뒤 이달의 고정비 불러오기를 누르세요. 고정비 관리에 등록한 반복 항목이 선택한 달에 반영돼요. 제목을 누르면 이번 달 내역과 금액을 펼쳐 볼 수 있어요.', fallback: { target: 'month', description: '먼저 여기서 월을 선택하면 이달의 고정비가 나타나요. 매달 불러오기 버튼으로 고정비 관리에 등록한 반복 항목을 반영할 수 있어요.' } },
  { target: 'fixed-expenses-intro', tab: 'fixed-expenses', name: '고정비 관리', title: '매달 불러올 기본 항목은 여기서 관리해요', description: '월세·보험료 같은 반복 항목의 금액, 결제일, 결제수단을 등록하세요. 거래내역에서 매달 불러올 수 있고, 이달의 고정비에서 직접 수정한 내용은 해당 월에 적용돼요.' },
  { target: 'categories-intro', tab: 'categories', name: '입력 준비', title: '거래 입력에서 고를 카테고리예요', description: '식비·교통비·급여처럼 자주 쓰는 분류를 추가하고 정리하세요. 여기서 관리한 항목이 이달의 수입·지출 내역을 입력할 때 카테고리 선택 목록에 나와요.' },
  { target: 'payment-methods-intro', tab: 'payment-methods', name: '입력 준비', title: '거래 입력에서 고를 결제수단이에요', description: '현금·체크카드·신용카드·계좌 등 실제 사용하는 수단을 등록하세요. 새 거래를 입력할 때 여기서 관리한 결제수단을 선택할 수 있어요.' },
  { target: 'assets-summary', tab: 'assets', name: '자산 관리', title: '자산과 부채를 모아 순자산을 확인해요', description: '아래의 부동산·예적금·통장·주식·투자 분류에서 보유 내역을 등록하고 수정하세요. 등록한 자산의 합계에서 부채를 뺀 금액이 순자산이에요.' },
  { target: 'asset-types', tab: 'assets', name: '자산 관리', title: '관리할 자산 종류를 선택하세요', description: '각 분류에서 자산을 추가하고 잔액이나 평가액을 관리해요. 자산 종합 요약에서는 전체 현황을 한눈에 확인할 수 있어요.' },
  { target: 'review', tab: 'ledger', name: '확인', title: '입력한 내역은 여기서 확인해요', description: '거래내역에서 기록을 찾고, 달력에서 날짜별로 보고, 분석에서 카테고리별 소비와 이번 달의 흐름을 확인하세요.' },
  { target: 'help', name: '다시 보기', title: '도움이 필요하면 이 ? 버튼을 눌러요', description: '로그아웃 왼쪽의 도움말 버튼으로 지금 안내를 언제든 다시 볼 수 있어요.' },
];

export default function LedgerTutorial({ onClose, onComplete, activeTab, onNavigate, isClubLedger = false }: { onClose: () => void; onComplete?: () => void; activeTab: string; onNavigate: (tab: TutorialTab) => void; isClubLedger?: boolean }) {
  const steps = isClubLedger ? allSteps.filter(item => item.tab !== 'assets') : allSteps;
  const layer = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState<ReturnType<typeof positionLedgerTour> | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const arrowId = `tour-arrow-${useId().replace(/:/g, '')}`;
  const current = steps[step];

  useLayoutEffect(() => {
    const node = layer.current!;
    // The non-modal top layer avoids clipping while leaving the app interactive.
    const previous = document.activeElement as HTMLElement | null;
    node.showPopover();
    const focusFrame = requestAnimationFrame(() => next.current?.focus({ preventScroll: true }));
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
    };
    document.addEventListener('keydown', escape);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', escape);
      const restoreFocus = node.contains(document.activeElement);
      node.hidePopover();
      if (restoreFocus) {
        const help = document.querySelector<HTMLButtonElement>('[data-ledger-tour="help"]');
        (help || previous)?.focus({ preventScroll: true });
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (current.tab && activeTab !== current.tab) {
      setLayout(null);
      onNavigate(current.tab);
    }
  }, [current.tab, activeTab, onNavigate]);

  useLayoutEffect(() => {
    // Wait for the requested tab to render before locating its guide anchor.
    if (current.tab && activeTab !== current.tab) return;
    const primary = document.querySelector<HTMLElement>(`[data-ledger-tour="${current.target}"]`);
    const target = primary || (current.fallback ? document.querySelector<HTMLElement>(`[data-ledger-tour="${current.fallback.target}"]`) : null);
    setUsingFallback(!primary);
    if (!target) { close.current(); return; }
    const viewport = window.visualViewport;
    let frame = 0;
    const measure = () => {
      const root = layer.current;
      const annotation = note.current;
      if (!root || !annotation) return;
      const rootRect = root.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      // Account for the app's body zoom when converting screen to layer coordinates.
      const scaleX = rootRect.width / root.clientWidth || 1;
      const scaleY = rootRect.height / root.clientHeight || 1;
      setLayout(positionLedgerTour({
        target: { left: (rect.left - rootRect.left) / scaleX, top: (rect.top - rootRect.top) / scaleY, width: rect.width / scaleX, height: rect.height / scaleY },
        viewport: { left: ((viewport?.offsetLeft || 0) - rootRect.left) / scaleX, top: ((viewport?.offsetTop || 0) - rootRect.top) / scaleY, width: (viewport?.width || window.innerWidth) / scaleX, height: (viewport?.height || window.innerHeight) / scaleY },
        note: { width: annotation.offsetWidth, height: annotation.offsetHeight },
      }));
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(target);
    observer.observe(note.current!);
    observer.observe(document.body);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    const useTarget = (event: MouseEvent) => {
      const control = (event.target as HTMLElement).closest('button, a, input, select, [data-grid-cell]');
      if (control && target.contains(control)) close.current();
    };
    if (current.target !== 'help') target.addEventListener('click', useTarget);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      target.removeEventListener('click', useTarget);
    };
  }, [current, activeTab]);

  return <div ref={layer} popover="manual" className="ledger-tour-layer">
    {layout && <>
      <div className="ledger-tour-highlight" aria-hidden="true" style={layout.highlight}/>
      <svg className="ledger-tour-arrow" aria-hidden="true"><defs><marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 L6 4 L1 7"/></marker></defs><path d={layout.arrow} markerEnd={`url(#${arrowId})`}/></svg>
    </>}
    <section ref={note} role="region" aria-label="가계부 화면 안내" className="ledger-tour-note" style={{ left: layout?.left ?? 12, top: layout?.top ?? 12, visibility: layout ? 'visible' : 'hidden' }}>
      <div className="ledger-tour-note-heading"><span>{step + 1} / {steps.length} · {current.name}</span><button type="button" aria-label="안내 닫기" onClick={onClose}><X size={17}/></button></div>
      <div aria-live="polite" aria-atomic="true"><h2>{current.title}</h2><p>{usingFallback && current.fallback ? current.fallback.description : current.description}</p></div>
      <div className="ledger-tour-controls"><button type="button" onClick={onClose}>그만 보기</button><div>{step > 0 && <button type="button" aria-label="이전 안내" onClick={() => setStep(step - 1)}><ChevronLeft size={16}/></button>}<button ref={next} type="button" className="ledger-tour-next" onClick={() => step === steps.length - 1 ? (onComplete ?? onClose)() : setStep(step + 1)}>{step === steps.length - 1 ? '완료' : '다음'}<ChevronRight size={15}/></button></div></div>
    </section>
  </div>;
}
