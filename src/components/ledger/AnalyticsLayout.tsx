'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { GripVertical, Maximize2, Save, Settings2, RotateCcw, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardId, DashboardItem, DASHBOARD_TITLES, defaultDashboardLayout, moveDashboardItem, validDashboardLayout } from '@/lib/analytics-layout';
import './analytics-layout.css';

const Context = createContext<{
  desktop: boolean; editing: boolean; layout: DashboardItem[];
  source: DashboardId | null; setSource: (id: DashboardId | null) => void;
  move: (from: DashboardId, to: DashboardId) => void;
  size: (id: DashboardId, width: number, height: number | null) => void;
} | null>(null);

export function AnalyticsLayout({ children, isClubLedger = false }: { children: React.ReactNode; isClubLedger?: boolean }) {
  const [desktop, setDesktop] = useState(false);
  const [layout, setLayout] = useState(defaultDashboardLayout);
  const [saved, setSaved] = useState(defaultDashboardLayout);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<DashboardId | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const sync = () => { setDesktop(media.matches); if (!media.matches) setSource(null); };
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/card-transactions/analytics-layout', { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(body => { if (controller.signal.aborted) return; if (!validDashboardLayout(body.layout)) throw new Error(); setLayout(body.layout); setSaved(body.layout); setReady(true); })
      .catch(() => { if (!controller.signal.aborted) setMessage('배치를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.'); });
    return () => controller.abort();
  }, []);
  const move = (from: DashboardId, to: DashboardId) => setLayout(current => moveDashboardItem(current, from, to));
  const size = (id: DashboardId, width: number, height: number | null) => setLayout(current => current.map(item => item.id === id ? { ...item, width, height } : item));
  async function save() {
    setSaving(true); setSource(null); setMessage('');
    try {
      const response = await fetch('/api/card-transactions/analytics-layout', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout }) });
      if (!response.ok) throw new Error();
      setSaved(layout); setEditing(false); setMessage('배치를 저장했어요. 다음에도 이 배치로 보여드려요.');
    } catch { setMessage('저장하지 못했어요. 다시 저장해 주세요.'); }
    finally { setSaving(false); }
  }
  return <Context.Provider value={{ desktop, editing: editing && desktop && !saving, layout, source, setSource, move, size }}>
    <div className="analytics-layout-toolbar">
      <span className="analytics-layout-message" role="status">{message || (editing ? '상단 손잡이로 이동 · 오른쪽 아래 모서리로 크기 조절' : '내가 보기 편한 대시보드')}</span>
      <div>{editing ? <>
        <button type="button" disabled={saving} onClick={() => { setLayout(defaultDashboardLayout()); setMessage('추천 배치로 바꿨어요. 저장하면 적용됩니다.'); }}><RotateCcw size={14} />추천 배치</button>
        <button type="button" disabled={saving} onClick={() => { setLayout(saved); setEditing(false); setMessage(''); }}><X size={14} />취소</button>
        <button type="button" className="is-primary" disabled={saving} onClick={save}><Save size={14} />{saving ? '저장 중…' : '배치 저장'}</button>
      </> : <button type="button" disabled={!ready} onClick={() => { setEditing(true); setMessage(''); }}><Settings2 size={14} />배치 편집</button>}{!ready && message && <button type="button" onClick={() => window.location.reload()}>다시 불러오기</button>}</div>
    </div>
    <div className="analytics-dashboard-shell"><div ref={grid} className={`analytics-dashboard-grid${desktop ? ' is-custom-layout' : ''}${editing && desktop ? ' is-editing' : ''}${isClubLedger ? ' is-club-ledger' : ''}`}>
      {children}
    </div></div>
  </Context.Provider>;
}

export function AnalyticsWidget({ id, children }: { id: DashboardId; children: React.ReactNode }) {
  const ctx = useContext(Context)!;
  const ref = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState(false);
  const gesture = useRef<{ x: number; y: number; width: number; height: number; step: number } | null>(null);
  const item = ctx.layout.find(item => item.id === id)!;
  const index = ctx.layout.findIndex(item => item.id === id);
  const style = ctx.desktop ? {
    gridColumn: `span ${item.width}`, order: index,
    '--widget-height': item.height === null ? 'auto' : `${item.height}px`,
    '--widget-chart-height': item.height === null ? undefined : `${Math.max(180, item.height - (id === 'summary' ? 250 : 130))}px`,
  } as React.CSSProperties : undefined;
  return <div ref={ref} className={`analytics-widget${ctx.source === id ? ' is-dragging' : ''}${dropTarget && ctx.source && ctx.source !== id ? ' is-drop-target' : ''}`} data-widget={id} data-fixed-height={ctx.desktop && item.height !== null ? 'true' : undefined} style={style}
    onDragEnter={() => { if (ctx.editing && ctx.source !== id) setDropTarget(true); }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(false); }}
    onDragOver={event => { if (ctx.editing && ctx.source && ctx.source !== id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
    onDrop={event => { if (!ctx.editing || !ctx.source) return; event.preventDefault(); setDropTarget(false); ctx.move(ctx.source, id); ctx.setSource(null); }}>
    {ctx.editing && <div className="analytics-widget-tools">
      <button type="button" className="analytics-widget-drag" draggable onDragStart={event => { ctx.setSource(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); if (ref.current) event.dataTransfer.setDragImage(ref.current, 20, 20); }} onDragEnd={() => ctx.setSource(null)} title="드래그해서 이동"><GripVertical size={15} />{DASHBOARD_TITLES[id]}</button>
      <div className="analytics-widget-actions">
        <button type="button" disabled={index === 0} onClick={() => ctx.move(id, ctx.layout[index - 1].id)} aria-label={`${DASHBOARD_TITLES[id]} 앞으로 이동`}><ChevronLeft size={13} /></button>
        <button type="button" disabled={index === ctx.layout.length - 1} onClick={() => ctx.move(id, ctx.layout[index + 1].id)} aria-label={`${DASHBOARD_TITLES[id]} 뒤로 이동`}><ChevronRight size={13} /></button>
        <label>폭<select aria-label={`${DASHBOARD_TITLES[id]} 너비`} value={item.width} onChange={event => ctx.size(id, Number(event.target.value), item.height)}>{Array.from({ length: 10 }, (_, number) => number + 3).map(width => <option key={width} value={width}>{width}/12</option>)}</select></label>
        <button type="button" onClick={() => ctx.size(id, item.width, null)} title="높이 자동 맞춤">자동</button>
      </div>
    </div>}
    <div className="analytics-widget-content">{children}</div>
    {ctx.editing && <button type="button" className="analytics-widget-resize" aria-label={`${DASHBOARD_TITLES[id]} 크기 조절, 방향키로도 조절 가능`}
      onPointerDown={event => {
        if (event.button !== 0 || !ref.current) return;
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
        const rect = ref.current.getBoundingClientRect();
        const parent = ref.current.closest('.analytics-dashboard-grid')!;
        const gap = parseFloat(getComputedStyle(parent).columnGap) || 12;
        gesture.current = { x: event.clientX, y: event.clientY, width: item.width, height: rect.height - (ref.current.querySelector('.analytics-widget-tools')?.getBoundingClientRect().height || 0), step: (parent.getBoundingClientRect().width + gap) / 12 };
      }}
      onPointerMove={event => {
        const start = gesture.current;
        if (!start) return;
        const width = Math.max(3, Math.min(12, start.width + Math.round((event.clientX - start.x) / start.step)));
        const height = Math.max(220, Math.min(1200, Math.round((start.height + event.clientY - start.y) / 20) * 20));
        ctx.size(id, width, height);
      }}
      onPointerUp={event => { gesture.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { gesture.current = null; }}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        ctx.size(id, Math.max(3, Math.min(12, item.width + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0))), Math.max(220, Math.min(1200, Math.round(((item.height ?? ref.current?.getBoundingClientRect().height ?? 320) + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0)) / 20) * 20)));
      }}><Maximize2 size={14} /></button>}
  </div>;
}
