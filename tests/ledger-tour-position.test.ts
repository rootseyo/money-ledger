import test from 'node:test';
import assert from 'node:assert/strict';
import { positionLedgerTour } from '../src/lib/ledger-tour-position';

test('mobile guide fits beside viewport edges without covering its target', () => {
  const viewport = { left: 0, top: 0, width: 320, height: 640 };
  const note = { width: 296, height: 200 };
  for (const left of [8, 270]) {
    const target = { left, top: 60, width: 40, height: 40 };
    const result = positionLedgerTour({ target, viewport, note });
    assert.ok(result.left >= 12);
    assert.ok(result.left + note.width <= viewport.width - 12);
    assert.ok(result.top > target.top + target.height);
    assert.ok(result.top + note.height <= viewport.height - 12);
    assert.ok(result.arrow.endsWith(`${left + 20} 107`));
  }
});

test('guide moves above a target near the bottom of the screen', () => {
  const target = { left: 800, top: 660, width: 120, height: 44 };
  const note = { width: 300, height: 180 };
  const result = positionLedgerTour({ target, note, viewport: { left: 0, top: 0, width: 1024, height: 768 } });
  assert.ok(result.top + note.height < target.top);
  assert.ok(result.left + note.width <= 1012);
  assert.ok(result.arrow.endsWith('860 653'));
});

test('guide stays inside a shifted visual viewport after zoom or keyboard resize', () => {
  const viewport = { left: 30, top: 100, width: 360, height: 300 };
  const note = { width: 290, height: 200 };
  const result = positionLedgerTour({ target: { left: 260, top: 230, width: 60, height: 40 }, viewport, note });
  assert.ok(result.left >= viewport.left + 12);
  assert.ok(result.left + note.width <= viewport.left + viewport.width - 12);
  assert.ok(result.top >= viewport.top + 12);
  assert.ok(result.top + note.height <= viewport.top + viewport.height - 12);
});
