'use client';

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatCellAmount, nextGridPosition } from '@/lib/ledger-cell';
import { ledgerSelectionBounds, moveLedgerSelection, type LedgerCellPosition } from '@/lib/ledger-selection';
import './spreadsheet.css';
import { useLedgerHistory } from './LedgerHistory';

const CELL_COLORS = ['#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3', '#ede9fe', '#fee2e2', '#e2e8f0'];
const GridContext = createContext<{ lock: { current: string | null }; cancel: { current: (() => void) | null }; isCellSelected?: (id: string) => boolean; colorFor?: (id: string) => string | undefined } | null>(null);
const cellsIn = (table: HTMLTableElement) => Array.from(table.querySelectorAll<HTMLTableCellElement>('[data-grid-cell]'));

function neighbor(cell: HTMLTableCellElement, key: string, shift = false, ctrl = false) {
  const table = cell.closest('table')!;
  const rows = Array.from(table.rows).filter(row => row.querySelector('[data-grid-cell]'));
  const row = rows.indexOf(cell.parentElement as HTMLTableRowElement);
  const columns = Array.from(rows[row].querySelectorAll<HTMLTableCellElement>('[data-grid-cell]'));
  const column = columns.indexOf(cell);
  const direction = key === 'ArrowRight' && column === columns.length - 1 ? 1
    : key === 'ArrowLeft' && column === 0 ? -1 : 0;
  if (direction && !ctrl) {
    const group = table.closest('.ledger-two-column-grid');
    const tables = group ? Array.from(group.querySelectorAll<HTMLTableElement>('table.ledger-spreadsheet'))
      .filter(candidate => !candidate.closest('[hidden]')) : [];
    const tableIndex = tables.indexOf(table);
    const adjacent = tables[tableIndex + direction];
    if (adjacent) {
      const adjacentRows = Array.from(adjacent.rows).filter(candidate => candidate.querySelector('[data-grid-cell]'));
      if (adjacentRows.length) {
        const targetRow = adjacentRows[Math.max(0, Math.min(adjacentRows.length - 1, row))];
        const targetCells = targetRow.querySelectorAll<HTMLTableCellElement>('[data-grid-cell]');
        return targetCells[direction > 0 ? 0 : targetCells.length - 1] || null;
      }
    }
  }
  const position = nextGridPosition(row, column, rows.length, columns.length, key, shift, ctrl);
  return position ? rows[position[0]].querySelectorAll<HTMLTableCellElement>('[data-grid-cell]')[position[1]] : null;
}

interface RowSelection {
  ids: string[];
  fields: string[];
  selected: Set<string>;
  onChange: (ids: Set<string>) => void;
  onNavigateRow: (id: string, removedIds?: string[]) => void;
}

export interface LedgerContextMenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

const cellPosition = (cell: HTMLTableCellElement): LedgerCellPosition | null => {
  const rowId = cell.closest('tr')?.dataset.transactionId;
  return rowId ? { rowId, field: cell.dataset.gridField! } : null;
};

export function SpreadsheetTable({ children, label, disabled = false, rowSelection, rowActions }: { children: ReactNode; label: string; disabled?: boolean; rowSelection?: RowSelection; rowActions?: (rowId: string) => LedgerContextMenuAction[] }) {
  const table = useRef<HTMLTableElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = useRef<string | null>(null);
  const lock = useRef<string | null>(null);
  const cancel = useRef<(() => void) | null>(null);
  const anchor = useRef<LedgerCellPosition | null>(null);
  const extending = useRef(false);
  const pendingFocus = useRef<LedgerCellPosition | null>(null);
  const deleting = useRef(false);
  const [range, setRange] = useState<{ anchor: LedgerCellPosition; extent: LedgerCellPosition; order: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [cellColors, setCellColors] = useState<Record<string, string>>({});
  const [colorMenu, setColorMenu] = useState<{ id: string; rowId: string | null; x: number; y: number } | null>(null);
  const longPress = useRef<number | null>(null);
  useEffect(() => {
    try { setCellColors(JSON.parse(localStorage.getItem('ledger-cell-colors') || '{}')); } catch { setCellColors({}); }
  }, []);
  useEffect(() => {
    if (!colorMenu) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setColorMenu(null);
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setColorMenu(null);
      }
    };
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnKeyDown);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnKeyDown);
    };
  }, [colorMenu]);
  useLayoutEffect(() => {
    if (!colorMenu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const clampedX = Math.max(8, Math.min(colorMenu.x, window.innerWidth - rect.width - 8));
    const clampedY = Math.max(8, Math.min(colorMenu.y, window.innerHeight - rect.height - 8));
    if (clampedX !== colorMenu.x || clampedY !== colorMenu.y) {
      menuRef.current.style.left = `${clampedX}px`;
      menuRef.current.style.top = `${clampedY}px`;
    }
  }, [colorMenu]);
  const openColorMenu = (cell: HTMLTableCellElement, x: number, y: number) => {
    if (disabled || history.busy || !cell.dataset.gridCell) return;
    const rowId = cell.closest('tr')?.dataset.transactionId || null;
    setColorMenu({
      id: cell.dataset.gridCell,
      rowId,
      x: Math.max(8, Math.min(x, window.innerWidth - 230)),
      y: Math.max(8, Math.min(y, window.innerHeight - 280)),
    });
  };
  const setCellColor = (id: string, color: string) => {
    setCellColors(current => {
      const next = { ...current };
      if (color) next[id] = color; else delete next[id];
      try { localStorage.setItem('ledger-cell-colors', JSON.stringify(next)); } catch {}
      return next;
    });
    setColorMenu(null);
  };
  const history = useLedgerHistory();
  const order = rowSelection?.ids.join('|') || '';
  const bounds = range && rowSelection && range.order === order ? ledgerSelectionBounds(rowSelection.ids, rowSelection.fields, range.anchor, range.extent) : null;
  const ranged = bounds && bounds.rows.length === rowSelection?.selected.size && bounds.rows.every(id => rowSelection?.selected.has(id)) ? bounds : null;
  const isCellSelected = (id: string) => {
    const separator = id.lastIndexOf(':');
    const rowId = id.slice(0, separator), field = id.slice(separator + 1);
    return !!rowSelection?.selected.has(rowId) && (!ranged || ranged.fields.includes(field));
  };
  const focusPosition = (position: LedgerCellPosition) => {
    const target = table.current && cellsIn(table.current).find(cell => cell.dataset.gridCell === `${position.rowId}:${position.field}`);
    if (target) {
      extending.current = true; target.focus(); extending.current = false;
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    } else { pendingFocus.current = position; rowSelection?.onNavigateRow(position.rowId); }
  };
  const selectRange = (position: LedgerCellPosition) => {
    if (!rowSelection || disabled || history.busy || deleting.current) return;
    const origin = anchor.current && rowSelection.ids.includes(anchor.current.rowId) ? anchor.current : position;
    anchor.current = origin;
    const selection = ledgerSelectionBounds(rowSelection.ids, rowSelection.fields, origin, position);
    if (!selection) return;
    setRange({ anchor: origin, extent: position, order });
    rowSelection.onChange(new Set(selection.rows)); setDeleteError('');
    focusPosition(position);
  };
  useLayoutEffect(() => {
    if (!table.current) return;
    const cells = cellsIn(table.current);
    if (pendingFocus.current) {
      const requested = pendingFocus.current;
      const target = cells.find(cell => cell.dataset.gridCell === `${requested.rowId}:${requested.field}`);
      if (target) {
        pendingFocus.current = null;
        extending.current = true; target.focus(); extending.current = false;
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    }
    const current = cells.find(cell => cell.dataset.gridCell === active.current) || cells[0];
    cells.forEach(cell => { cell.tabIndex = cell === current ? 0 : -1; });
    if (lock.current && !cells.some(cell => cell.dataset.gridCell === lock.current)) lock.current = null;
  });
  const mouseCell = (target: HTMLElement) => target.closest<HTMLTableCellElement>('[data-grid-cell]')
    || (target.matches('input[type="checkbox"]') ? target.closest('tr')?.querySelector<HTMLTableCellElement>('[data-grid-cell]') : null);
  const deleteRows = async (cell: HTMLTableCellElement) => {
    if (deleting.current || disabled || history.busy) return;
    const position = cellPosition(cell);
    if (!position) return;
    const selected = rowSelection ? rowSelection.ids.filter(id => rowSelection.selected.has(id)) : [];
    const ids = selected.length ? selected : [position.rowId];
    const removed = new Set(ids);
    const remaining = rowSelection?.ids.filter(id => !removed.has(id)) || [];
    const index = rowSelection?.ids.indexOf(position.rowId) || 0;
    const nextId = remaining[Math.min(Math.max(0, index - (rowSelection?.ids.slice(0, index).filter(id => removed.has(id)).length || 0)), remaining.length - 1)];
    deleting.current = true; setDeleteError(''); cancel.current?.();
    try {
      await history.perform(ids.length > 1 ? { action: 'delete-many', ids } : { action: 'delete', id: ids[0] });
      anchor.current = null; setRange(null);
      if (nextId && rowSelection) {
        pendingFocus.current = { rowId: nextId, field: position.field };
        rowSelection.onNavigateRow(nextId, ids);
        requestAnimationFrame(() => {
          const target = table.current && cellsIn(table.current).find(item => item.dataset.gridCell === `${nextId}:${position.field}`);
          target?.focus();
        });
      } else requestAnimationFrame(() => table.current?.querySelector<HTMLTableCellElement>('[data-grid-cell]')?.focus());
    } catch (error) { setDeleteError(error instanceof Error ? error.message : '삭제하지 못했습니다. 다시 시도해 주세요.'); }
    finally { deleting.current = false; }
  };
  const menuActions = colorMenu?.rowId && rowActions ? rowActions(colorMenu.rowId) : [];
  return <GridContext.Provider value={{ lock, cancel, isCellSelected: rowSelection ? isCellSelected : undefined, colorFor: id => cellColors[id] }}>
    {deleteError && <p className="ledger-error" role="alert">{deleteError}</p>}
    {colorMenu && <div ref={menuRef} className="ledger-cell-color-menu" role="menu" aria-label="셀 및 행 메뉴" style={{ left: colorMenu.x, top: colorMenu.y }} onContextMenu={event => event.preventDefault()}>
      {menuActions.length > 0 && <>
        <div className="ledger-context-menu-actions">
          {menuActions.map(action => <button key={action.label} type="button" role="menuitem" disabled={action.disabled} className={`ledger-context-menu-item${action.danger ? ' is-danger' : ''}`} onClick={() => { setColorMenu(null); action.onClick(); }}>{action.label}</button>)}
        </div>
        <div className="ledger-context-menu-divider" role="separator" />
      </>}
      <strong>셀 색상</strong><div className="ledger-cell-color-swatches">{CELL_COLORS.map(color => <button key={color} type="button" role="menuitem" aria-label={`${color} 색상`} aria-pressed={cellColors[colorMenu.id] === color} title="색상 적용" className={cellColors[colorMenu.id] === color ? 'is-selected' : ''} style={{ backgroundColor: color }} onClick={() => setCellColor(colorMenu.id, color)}/>)}</div>
      <button className="ledger-cell-color-clear" type="button" role="menuitem" onClick={() => setCellColor(colorMenu.id, '')}>색상 지우기</button>
    </div>}
    <div className="ledger-table-scroll ledger-grid-scroll"><table ref={table} role="grid" aria-label={label} aria-busy={disabled || history.busy} aria-multiselectable={rowSelection ? true : undefined} className="ledger-table ledger-simple-table ledger-spreadsheet"
      onContextMenu={event => {
        const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('[data-grid-cell]');
        if (!cell) return;
        event.preventDefault(); openColorMenu(cell, event.clientX, event.clientY);
      }}
      onTouchStart={event => {
        const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>('[data-grid-cell]');
        if (!cell) return;
        if (longPress.current) window.clearTimeout(longPress.current);
        const touch = event.touches[0];
        longPress.current = window.setTimeout(() => openColorMenu(cell, touch.clientX, touch.clientY), 500);
      }}
      onTouchMove={() => { if (longPress.current) window.clearTimeout(longPress.current); longPress.current = null; }}
      onTouchEnd={() => { if (longPress.current) window.clearTimeout(longPress.current); longPress.current = null; }}
      onMouseDownCapture={e => {
        if (!rowSelection || e.button !== 0 || disabled || history.busy) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, a, [role="menu"]') || target.matches('input:not([type="checkbox"]), select, textarea')) return;
        const cell = mouseCell(target);
        const position = cell && cellPosition(cell);
        if (!position) return;
        if (e.shiftKey) { e.preventDefault(); cancel.current?.(); selectRange(position); }
        else {
          anchor.current = position; setRange(null); setDeleteError('');
          if (!target.matches('input[type="checkbox"]')) rowSelection.onChange(new Set());
        }
      }}
      onClickCapture={e => {
        if (!rowSelection || !e.shiftKey) return;
        const cell = mouseCell(e.target as HTMLElement);
        if (!cell || !cellPosition(cell) || (e.target as HTMLElement).closest('button, a, [role="menu"]') || (e.target as HTMLElement).matches('input:not([type="checkbox"]), select, textarea')) return;
        e.preventDefault(); e.stopPropagation();
      }}
      onFocusCapture={e => {
        const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-grid-cell]');
        if (!cell) return;
        active.current = cell.dataset.gridCell!;
        const position = cellPosition(cell);
        if (!extending.current && position) anchor.current = position;
        cellsIn(table.current!).forEach(other => { other.tabIndex = other === cell ? 0 : -1; });
      }}
      onKeyDownCapture={e => {
        if (e.nativeEvent.isComposing) return;
        const target = e.target as HTMLElement;
        const cell = mouseCell(target);
        if (!cell) return;
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault(); e.stopPropagation();
          const rect = cell.getBoundingClientRect();
          openColorMenu(cell, rect.left + 16, rect.bottom - 4);
          return;
        }
        if (e.altKey) return;
        if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
          if (!cellPosition(cell) || target.matches('input:not([type="checkbox"]), select, textarea') || target.isContentEditable) return;
          e.preventDefault(); e.stopPropagation();
          if (!e.repeat) void deleteRows(cell);
          return;
        }
        if (!rowSelection || target !== cell || disabled || history.busy) return;
        const position = cellPosition(cell);
        if (!position) return;
        if (e.key === 'Escape') { e.preventDefault(); rowSelection.onChange(new Set()); setRange(null); anchor.current = position; return; }
        if (!e.shiftKey && e.key !== 'PageUp' && e.key !== 'PageDown') return;
        const step = Math.max(1, Math.floor((window.innerHeight - 120) / Math.max(1, cell.closest('tr')!.getBoundingClientRect().height)) - 1);
        const destination = moveLedgerSelection(rowSelection.ids, rowSelection.fields, position, e.key, step, e.metaKey || e.ctrlKey);
        if (!destination) return;
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) selectRange(destination);
        else { rowSelection.onChange(new Set()); setRange(null); anchor.current = destination; focusPosition(destination); }
      }}
      onKeyDown={e => {
        if (!e.nativeEvent.isComposing && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, select, textarea')) {
          e.preventDefault(); e.stopPropagation(); if (!e.repeat) void history.undo(); return;
        }
        if (e.target !== (e.target as HTMLElement).closest('[data-grid-cell]') || e.nativeEvent.isComposing) return;
        const cell = e.target as HTMLTableCellElement;
        const target = neighbor(cell, e.key, e.shiftKey, e.ctrlKey || e.metaKey);
        if (target) { e.preventDefault(); if (rowSelection && !e.shiftKey) { rowSelection.onChange(new Set()); setRange(null); } target.focus(); }
      }}>
      {children}
    </table></div>
  </GridContext.Provider>;
}

interface CellProps {
  id: string;
  label: string;
  value: string;
  children: ReactNode;
  placeholder?: string;
  type?: 'text' | 'date';
  numeric?: boolean;
  options?: { value: string; label: string }[];
  suggestions?: string[];
  initialValue?: () => string;
  onBegin?: () => void;
  activateOnClick?: boolean;
  onSubmit?: () => Promise<void>;
  submitOnEnter?: boolean;
  onSave?: (value: string) => Promise<void>;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function SpreadsheetCell({ id, label, value, children, type = 'text', numeric, options, suggestions, initialValue, onBegin, activateOnClick, onSubmit, submitOnEnter, onSave, disabled, className = '', style, placeholder }: CellProps) {
  const grid = useContext(GridContext)!;
  const history = useLedgerHistory();
  const cell = useRef<HTMLTableCellElement>(null);
  const control = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const pending = useRef(false);
  const editingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorId = useId();
  const suggestionsId = useId();
  const lock = grid.lock;
  const cellColor = grid.colorFor?.(id);
  useEffect(() => () => { if (lock.current === id) { lock.current = null; grid.cancel.current = null; } }, [lock, id]);
  useEffect(() => {
    if (!editing || typeof window === 'undefined' || !window.matchMedia('(max-width: 700px)').matches) return;
    const viewport = window.visualViewport;
    const revealEditor = () => {
      const active = control.current;
      if (!active) return;
      const rect = active.getBoundingClientRect();
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      if (rect.top < top + 12 || rect.bottom > bottom - 12) {
        active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    };
    const timer = window.setTimeout(revealEditor, 180);
    viewport?.addEventListener('resize', revealEditor);
    return () => { window.clearTimeout(timer); viewport?.removeEventListener('resize', revealEditor); };
  }, [editing]);
  const begin = () => {
    if (editingRef.current || !onSave || disabled || history.busy || (grid.lock.current && grid.lock.current !== id)) return;
    grid.lock.current = id;
    editingRef.current = true;
    grid.cancel.current = () => { if (!pending.current) { close(); cell.current?.focus(); } };
    const next = initialValue?.() ?? value;
    setDraft(numeric ? formatCellAmount(next) : next); setError(''); setEditing(true);
    onBegin?.();
  };
  const close = () => {
    editingRef.current = false;
    grid.lock.current = null;
    grid.cancel.current = null;
    setEditing(false); setError('');
  };
  const commit = async (destination?: HTMLElement | null, submit = false) => {
    if (pending.current || !editingRef.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const unchanged = numeric ? draft.replace(/,/g, '') === value.replace(/,/g, '') : draft === value;
      if (!unchanged) await onSave?.(draft);
      if (submit) await onSubmit?.();
      close();
      if (destination) requestAnimationFrame(() => {
        // Filtering can remove the edited row. Never focus a detached node.
        if (destination.isConnected) destination.focus();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다. 다시 시도해 주세요.');
      requestAnimationFrame(() => control.current?.focus());
    } finally { pending.current = false; setBusy(false); }
  };
  return <td ref={cell} role="gridcell" data-grid-cell={id} data-cell-colored={cellColor ? 'true' : undefined} tabIndex={-1} aria-label={label} aria-readonly={!onSave || disabled} aria-busy={busy} aria-selected={grid.isCellSelected ? grid.isCellSelected(id) : undefined}
    className={`ledger-grid-cell ${editing ? 'is-editing' : ''} ${className}`} data-label={label} data-grid-field={id.slice(id.lastIndexOf(':') + 1)} data-grid-first={id.endsWith(':notifiedAt') ? 'true' : undefined} style={{ ...style, ...(cellColor ? { '--cell-bg': cellColor, backgroundColor: cellColor, color: '#172033' } as CSSProperties : {}) }}
    onClick={e => {
      if ((e.target as HTMLElement).closest('button, input, select, a, [role="menu"]')) return;
      if (e.target === cell.current || !editing) { cell.current?.focus(); if (activateOnClick) begin(); }
    }}
    onDoubleClick={event => { if (!event.shiftKey) begin(); }}
    onKeyDown={e => {
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
      if (editing) {
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault(); e.stopPropagation();
          void commit(neighbor(cell.current!, e.key, false, true)); return;
        }
        if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z' && ((numeric ? draft.replace(/,/g, '') === value.replace(/,/g, '') : draft === value) || !!options)) {
          e.preventDefault(); e.stopPropagation();
          if (!pending.current) { if (options && draft !== value) setDraft(value); else { close(); cell.current?.focus(); void history.undo(); } } return;
        }
        if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          if (!pending.current) { close(); cell.current?.focus(); }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.stopPropagation();
          const target = neighbor(cell.current!, e.key === 'Enter' ? (e.shiftKey ? 'ArrowUp' : 'ArrowDown') : 'Tab', e.shiftKey);
          // At a Tab boundary let the browser move out of the grid; blur saves.
          if (target || e.key === 'Enter') {
            e.preventDefault();
            const submit = e.key === 'Enter' && !!onSubmit && (!!submitOnEnter || e.ctrlKey || e.metaKey);
            void commit(submit ? cell.current : target || cell.current, submit);
          }
        }
        return;
      }
      if (e.altKey && e.key === 'Enter') return;
      if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); begin(); }
    }}>
    {editing ? <>
      {options ? <select ref={node => { control.current = node; }} autoFocus aria-label={`${label} 수정`} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} disabled={busy} value={draft}
        onChange={e => { setDraft(e.target.value); setError(''); }} onBlur={() => { void commit(); }}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : <input ref={node => { control.current = node; }} autoFocus type={type} placeholder={placeholder} list={suggestions?.length ? suggestionsId : undefined} inputMode={numeric ? 'numeric' : undefined} aria-label={`${label} 수정`} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} readOnly={busy} value={draft}
        onFocus={e => { if (type === 'text') e.target.select(); }} onChange={e => {
          const input = e.target;
          const raw = input.value;
          const position = input.selectionStart;
          const formatted = numeric ? formatCellAmount(raw) : raw;
          setDraft(formatted); setError('');
          if (numeric && position !== null) {
            const digitsBefore = raw.slice(0, position).replace(/,/g, '').length;
            requestAnimationFrame(() => {
              let caret = 0, count = 0;
              while (caret < formatted.length && count < digitsBefore) { if (formatted[caret] !== ',') count++; caret++; }
              if (input.isConnected && document.activeElement === input) input.setSelectionRange(caret, caret);
            });
          }
        }} onBlur={() => { void commit(); }}/>}
      {suggestions?.length ? <datalist id={suggestionsId}>{suggestions.map(suggestion => <option key={suggestion} value={suggestion}/>)}</datalist> : null}
      {busy && <span className="ledger-grid-feedback" role="status">저장 중…</span>}
      {error && <span id={errorId} className="ledger-grid-feedback ledger-error" role="alert">{error}</span>}
    </> : children}
  </td>;
}
