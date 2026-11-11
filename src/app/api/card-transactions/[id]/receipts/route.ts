import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withLedgerScope } from '@/lib/ledger-scope';
import { MAX_RECEIPT_BYTES, MAX_RECEIPTS, receiptMime } from '@/lib/club-ledger';
import { ClubLedgerError } from '@/lib/club-ledger-server';

type Context = { params: Promise<{ id: string }> };
export const runtime = 'nodejs';
const info = { id: true, name: true, mimeType: true, size: true, createdAt: true } as const;
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function transactionId(context: Context) {
  const { id } = await context.params;
  if (!await prisma.cardTransaction.findUnique({ where: { id }, select: { id: true } })) throw new ClubLedgerError('거래를 찾을 수 없습니다.', 404);
  return id;
}
function failed(error: unknown) {
  if (error instanceof ClubLedgerError) return json({ error: error.message }, error.status);
  console.error('Receipt request failed', error);
  return json({ error: '영수증 요청을 처리하지 못했습니다.' }, 500);
}
async function get(_request: NextRequest, context: Context) {
  try {
    const id = await transactionId(context);
    return json({ receipts: await prisma.transactionReceipt.findMany({ where: { transactionId: id }, select: info, orderBy: { createdAt: 'asc' } }) });
  } catch (error) { return failed(error); }
}
async function post(request: NextRequest, context: Context) {
  try {
    const id = await transactionId(context);
    const maxRequestBytes = MAX_RECEIPT_BYTES + 64 * 1024;
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new ClubLedgerError('파일 형식을 확인해 주세요.');
    if (Number(request.headers.get('content-length')) > maxRequestBytes) throw new ClubLedgerError('영수증은 파일당 5MB까지 첨부할 수 있습니다.', 413);
    const reader = request.body?.getReader();
    if (!reader) throw new ClubLedgerError('첨부할 파일이 없습니다.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.byteLength;
        if (size > maxRequestBytes) { await reader.cancel(); throw new ClubLedgerError('영수증은 파일당 5MB까지 첨부할 수 있습니다.', 413); }
        chunks.push(result.value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > MAX_RECEIPT_BYTES) throw new ClubLedgerError('1바이트부터 5MB까지의 파일을 선택해 주세요.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = receiptMime(bytes);
    if (!mimeType) throw new ClubLedgerError('JPG, PNG, WebP 이미지 또는 PDF를 첨부해 주세요.');
    const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180) || '영수증';
    const receipt = await prisma.$transaction(async db => {
      // Serialize concurrent uploads for this transaction, then enforce the limit.
      await db.cardTransaction.update({ where: { id }, data: { updatedAt: new Date() } });
      const count = await db.transactionReceipt.count({ where: { transactionId: id } });
      if (count >= MAX_RECEIPTS) throw new ClubLedgerError('거래당 영수증은 5개까지 첨부할 수 있습니다.');
      return db.transactionReceipt.create({ data: { transactionId: id, name, mimeType, size: bytes.byteLength, data: bytes }, select: info });
    });
    return json({ success: true, receipt }, 201);
  } catch (error) { return failed(error); }
}
export const GET = withLedgerScope(get);
export const POST = withLedgerScope(post);
