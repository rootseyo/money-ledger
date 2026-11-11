'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

export function ListOrderStatus({ custom, saving, disabled, error, reset }: {
  custom: boolean; saving: boolean; disabled: boolean; error: string; reset: () => void;
}) {
  return <div className="ledger-order-status">
    <span role="status" aria-live="polite">{saving ? '순서 저장 중…' : custom ? '사용자 지정 순서' : '왼쪽 손잡이를 끌어 순서를 변경하세요'}</span>
    {custom && <button type="button" className="btn btn-secondary" disabled={disabled} onClick={reset}>기본 순서로 복원</button>}
    {error && <span role="alert" style={{ color: 'var(--danger)' }}>{error}</span>}
  </div>;
}

interface DragState {
  target: string;
  table: HTMLTableElement;
  scroller: HTMLElement | null;
  x: number;
  y: number;
}

function clearMarkers(table: HTMLTableElement) {
  table.querySelectorAll<HTMLElement>('[data-order-id]').forEach((row) => {
    delete row.dataset.dragging;
    delete row.dataset.dropTarget;
    delete row.dataset.dropPosition;
  });
}

export function ListDragHandle({ id, ids, disabled, move }: {
  id: string; ids: string[]; disabled: boolean; move: (source: string, target: string) => void;
}) {
  const drag = useRef<DragState | null>(null);
  const frame = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (drag.current) clearMarkers(drag.current.table);
  }, []);

  const clear = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (drag.current) clearMarkers(drag.current.table);
    drag.current = null;
    setActive(false);
  };

  const track = () => {
    const current = drag.current;
    if (!current) return;
    const bounds = current.scroller?.getBoundingClientRect();
    const top = bounds?.top ?? 0;
    const bottom = bounds?.bottom ?? window.innerHeight;
    const scroll = current.y < top + 48 ? -12 : current.y > bottom - 48 ? 12 : 0;
    if (scroll) {
      if (current.scroller) current.scroller.scrollBy(0, scroll);
      else window.scrollBy(0, scroll);
    }
    const row = document.elementFromPoint(current.x, current.y)?.closest<HTMLElement>('tr[data-order-id]');
    current.table.querySelectorAll<HTMLElement>('[data-drop-target]').forEach((item) => { delete item.dataset.dropTarget; delete item.dataset.dropPosition; });
    current.target = id;
    if (row?.closest('table') === current.table && row.dataset.orderId && row.dataset.orderId !== id) {
      current.target = row.dataset.orderId;
      row.dataset.dropTarget = 'true';
      row.dataset.dropPosition = ids.indexOf(id) < ids.indexOf(current.target) ? 'after' : 'before';
    }
    frame.current = requestAnimationFrame(track);
  };

  return <button
    type="button" className="ledger-drag-handle" disabled={disabled}
    aria-label="항목 순서 변경" aria-pressed={active}
    title="끌어서 이동 · 키보드 위/아래 화살표로 이동"
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return;
      const table = event.currentTarget.closest('table');
      if (!table) return;
      let scroller: HTMLElement | null = table.parentElement;
      while (scroller && (scroller.scrollHeight <= scroller.clientHeight || !/auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      drag.current = { target: id, table, scroller, x: event.clientX, y: event.clientY };
      event.currentTarget.closest<HTMLElement>('tr')?.setAttribute('data-dragging', 'true');
      event.currentTarget.setPointerCapture(event.pointerId);
      setActive(true);
      frame.current = requestAnimationFrame(track);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
    }}
    onPointerUp={(event) => {
      const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('tr[data-order-id]');
      if (drag.current && row?.closest('table') === drag.current.table && row.dataset.orderId && row.dataset.orderId !== id) move(id, row.dataset.orderId);
      clear();
    }}
    onPointerCancel={clear} onLostPointerCapture={clear}
    onKeyDown={(event) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      const target = ids[ids.indexOf(id) + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) move(id, target);
    }}
  ><GripVertical size={16} aria-hidden="true" /></button>;
}
