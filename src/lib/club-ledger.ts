export type DuesMember = { id: string; name: string; userId: string | null; archived: boolean };
export type ReceiptInfo = { id: string; name: string; mimeType: string; size: number; createdAt: string };
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const MAX_RECEIPTS = 5;

export function validDuesMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}

export function validDuesAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647;
}

export function duesStatus(total: number, monthlyDues: number) {
  if (monthlyDues <= 0) return total > 0 ? '입금 있음' : '내역 없음';
  return total >= monthlyDues ? '납부 완료' : total > 0 ? '일부 입금' : '미입금';
}

// Detect actual content; the browser-provided file type is not trusted.
export function receiptMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

/** null means no goal; undefined means an invalid supplied amount. */
export function parseOptionalGoalAmount(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 100_000_000_000 ? amount : undefined;
}
