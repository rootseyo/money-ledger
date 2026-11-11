interface Rect { left: number; top: number; width: number; height: number; }
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

export function positionLedgerTour({ target, viewport, note }: { target: Rect; viewport: Rect; note: { width: number; height: number } }) {
  const margin = 12;
  const gap = 38;
  const center = target.left + target.width / 2;
  const bottom = target.top + target.height;
  const viewportBottom = viewport.top + viewport.height;
  const fitsBelow = bottom + gap + note.height <= viewportBottom - margin;
  const fitsAbove = target.top - gap - note.height >= viewport.top + margin;
  const below = fitsBelow || (!fitsAbove && viewportBottom - bottom >= target.top - viewport.top);
  const left = clamp(center - note.width / 2, viewport.left + margin, viewport.left + viewport.width - note.width - margin);
  const top = clamp(below ? bottom + gap : target.top - gap - note.height, viewport.top + margin, viewportBottom - note.height - margin);
  const startX = clamp(center, left + 20, left + note.width - 20);
  const startY = below ? top : top + note.height;
  const endY = below ? bottom + 7 : target.top - 7;
  const bend = (startY + endY) / 2;
  return {
    left, top,
    highlight: { left: target.left - 5, top: target.top - 5, width: target.width + 10, height: target.height + 10 },
    arrow: `M ${startX} ${startY} C ${startX} ${bend}, ${center} ${bend}, ${center} ${endY}`,
  };
}
