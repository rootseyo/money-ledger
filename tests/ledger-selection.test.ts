import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerSelectionBounds, moveLedgerSelection } from '../src/lib/ledger-selection';

const ids = Array.from({ length: 200 }, (_, i) => `row-${i}`);
const fields = ['notifiedAt', 'merchant', 'category', 'cardOrAccount', 'amount'];
const cell = (row: number, column = 1) => ({ rowId: ids[row], field: fields[column] });

test('Shift-click ranges include both ends, work backwards, and contract around the anchor', () => {
  assert.deepEqual(ledgerSelectionBounds(ids, fields, cell(4, 1), cell(7, 3)), { rows: ids.slice(4, 8), fields: fields.slice(1, 4) });
  assert.deepEqual(ledgerSelectionBounds(ids, fields, cell(7, 3), cell(4, 1)), { rows: ids.slice(4, 8), fields: fields.slice(1, 4) });
  assert.deepEqual(ledgerSelectionBounds(ids, fields, cell(4), cell(5)), { rows: ids.slice(4, 6), fields: ['merchant'] });
  assert.equal(ledgerSelectionBounds(ids, fields, { rowId: 'deleted', field: 'merchant' }, cell(5)), null);
  assert.equal(ledgerSelectionBounds(ids, fields, cell(0), { rowId: ids[1], field: 'hidden' }), null);
});

test('Shift arrows extend in each direction and clamp at the transaction boundaries', () => {
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(3), 'ArrowDown', 10), cell(4));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(3), 'ArrowUp', 10), cell(2));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(3), 'ArrowRight', 10), cell(3, 2));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(3), 'ArrowLeft', 10), cell(3, 0));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(0, 0), 'ArrowUp', 10), cell(0, 0));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(199, 4), 'ArrowDown', 10), cell(199, 4));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(199, 4), 'ArrowRight', 10), cell(199, 4));
});

test('PageUp/PageDown range selection spans rendered pages without selecting empty entry rows', () => {
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(75), 'PageDown', 18), cell(93));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(93), 'PageUp', 18), cell(75));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(0), 'PageUp', 18), cell(0));
  assert.deepEqual(moveLedgerSelection(ids, fields, cell(199), 'PageDown', 18), cell(199));
  assert.equal(moveLedgerSelection(ids, fields, { rowId: 'new-transaction-top', field: 'amount' }, 'ArrowDown', 10), null);
  assert.equal(moveLedgerSelection(ids, fields, cell(0), 'Tab', 10), null);
});
