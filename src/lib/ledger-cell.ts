import type { ChangeEvent, KeyboardEvent } from 'react';
import type { Transaction } from '@/components/ledger/ledger-types';
import type { HouseholdCategory } from './household-categories';
import { kstDatetime } from './transaction-entry';

export type TransactionCellField = 'notifiedAt' | 'merchant' | 'category' | 'content' | 'amount' | 'cardOrAccount';

export function formatCellAmount(value: string) {
  const raw = value.replace(/,/g, '');
  if (!/^\d*$/.test(raw)) return value;
  const stripped = raw.replace(/^0+(?=\d)/, '');
  return stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatNumberWithCommas(value: string | number | undefined | null, allowNegative = false): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  const raw = str.replace(/[^0-9]/g, '');
  if (!raw) return allowNegative && str.trim().startsWith('-') ? '-' : '';
  const stripped = raw.replace(/^0+(?=\d)/, '');
  if (stripped === '0') return '0';
  const isNegative = allowNegative && str.trim().startsWith('-');
  const formatted = stripped.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return isNegative ? `-${formatted}` : formatted;
}

export function handleNumericKeyDown(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Backspace') {
    const input = e.currentTarget;
    const { selectionStart, selectionEnd, value } = input;
    if (selectionStart !== null && selectionStart === selectionEnd && selectionStart > 1) {
      if (value[selectionStart - 1] === ',') {
        input.setSelectionRange(selectionStart - 1, selectionStart - 1);
      }
    }
  }
}

export function handleNumericInputChange(
  e: ChangeEvent<HTMLInputElement>,
  onChange: (value: string) => void,
  formatFn: (val: string) => string = formatNumberWithCommas
) {
  const input = e.target;
  const raw = input.value;
  const position = input.selectionStart;
  const digitsBefore = position !== null ? raw.slice(0, position).replace(/[^0-9]/g, '').length : 0;
  const formatted = formatFn(raw);
  onChange(formatted);
  if (position !== null && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      let caret = 0, count = 0;
      while (caret < formatted.length && count < digitsBefore) {
        if (formatted[caret] >= '0' && formatted[caret] <= '9') count++;
        caret++;
      }
      if (input.isConnected && document.activeElement === input) {
        input.setSelectionRange(caret, caret);
      }
    });
  }
}

// Send only the edited field so unrelated values and timestamp precision survive.
export function transactionCellPatch(item: Transaction, field: TransactionCellField, value: string, categories: HouseholdCategory[] = []) {
  const patch: Record<string, string | number | null> = { id: item.id };
  if (field === 'amount') {
    const raw = value.replace(/,/g, '').trim();
    const amount = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('0보다 큰 정수 금액을 입력해 주세요.');
    patch.amount = amount;
  } else if (field === 'notifiedAt') {
    const local = value.length === 10 ? `${value}T12:00` : value;
    const date = new Date(`${local}:00+09:00`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !Number.isFinite(date.getTime()) || kstDatetime(date) !== local) throw new Error('올바른 날짜와 시간을 입력해 주세요.');
    if (item.fixedExpenseId && item.scheduledFor && local.slice(0, 7) !== kstDatetime(item.scheduledFor).slice(0, 7)) throw new Error('고정비의 날짜는 해당 월 안에서 변경해 주세요.');
    patch.notifiedAt = date.toISOString();
  } else {
    const trimmed = value.trim();
    if (field === 'merchant' && !trimmed) throw new Error('사용처·항목명을 입력해 주세요.');
    patch[field] = field === 'category' || field === 'cardOrAccount' ? trimmed || null : trimmed;
    if (field === 'category') {
      const category = categories.find(c => c.name === trimmed);
      if (category?.type === 'INCOME') patch.type = 'DEPOSIT';
      else if (category && item.type === 'DEPOSIT') patch.type = 'PAYMENT';
    }
  }
  return patch;
}

export function nextGridPosition(row: number, column: number, rows: number, columns: number, key: string, shift = false, ctrl = false): [number, number] | null {
  if (!rows || !columns) return null;
  switch (key) {
    case 'ArrowUp': return [ctrl ? 0 : Math.max(0, row - 1), column];
    case 'ArrowDown': return [ctrl ? rows - 1 : Math.min(rows - 1, row + 1), column];
    case 'ArrowLeft': return [row, ctrl ? 0 : Math.max(0, column - 1)];
    case 'ArrowRight': return [row, ctrl ? columns - 1 : Math.min(columns - 1, column + 1)];
    case 'Home': return [ctrl ? 0 : row, 0];
    case 'End': return [ctrl ? rows - 1 : row, columns - 1];
    case 'Tab': {
      const index = row * columns + column + (shift ? -1 : 1);
      return index < 0 || index >= rows * columns ? null : [Math.floor(index / columns), index % columns];
    }
    default: return null;
  }
}
