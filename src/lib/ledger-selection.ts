export interface LedgerCellPosition { rowId: string; field: string }

export function ledgerSelectionBounds(ids: string[], fields: string[], anchor: LedgerCellPosition, extent: LedgerCellPosition) {
  const firstRow = ids.indexOf(anchor.rowId), lastRow = ids.indexOf(extent.rowId);
  const firstColumn = fields.indexOf(anchor.field), lastColumn = fields.indexOf(extent.field);
  if ([firstRow, lastRow, firstColumn, lastColumn].some(index => index < 0)) return null;
  return { rows: ids.slice(Math.min(firstRow, lastRow), Math.max(firstRow, lastRow) + 1),
    fields: fields.slice(Math.min(firstColumn, lastColumn), Math.max(firstColumn, lastColumn) + 1) };
}

export function moveLedgerSelection(ids: string[], fields: string[], current: LedgerCellPosition, key: string, pageSize: number, edge = false): LedgerCellPosition | null {
  let row = ids.indexOf(current.rowId), column = fields.indexOf(current.field);
  if (row < 0 || column < 0) return null;
  switch (key) {
    case 'ArrowUp': row = edge ? 0 : row - 1; break;
    case 'ArrowDown': row = edge ? ids.length - 1 : row + 1; break;
    case 'ArrowLeft': column = edge ? 0 : column - 1; break;
    case 'ArrowRight': column = edge ? fields.length - 1 : column + 1; break;
    case 'PageUp': row -= Math.max(1, Math.floor(pageSize)); break;
    case 'PageDown': row += Math.max(1, Math.floor(pageSize)); break;
    case 'Home': column = 0; if (edge) row = 0; break;
    case 'End': column = fields.length - 1; if (edge) row = ids.length - 1; break;
    default: return null;
  }
  return { rowId: ids[Math.min(ids.length - 1, Math.max(0, row))], field: fields[Math.min(fields.length - 1, Math.max(0, column))] };
}
