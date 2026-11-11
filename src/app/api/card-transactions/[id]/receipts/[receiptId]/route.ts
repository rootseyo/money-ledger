import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withLedgerScope } from '@/lib/ledger-scope';

type Context = { params: Promise<{ id: string; receiptId: string }> };
export const runtime = 'nodejs';
async function get(_request: NextRequest, context: Context) {
  const { id, receiptId } = await context.params;
  const transaction = await prisma.cardTransaction.findUnique({ where: { id }, select: { id: true } });
  if (!transaction) return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
  const receipt = await prisma.transactionReceipt.findFirst({ where: { id: receiptId, transactionId: id } });
  if (!receipt) return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 });
  return new Response(receipt.data, { headers: {
    'Content-Type': receipt.mimeType, 'Content-Length': String(receipt.size),
    'Content-Disposition': `inline; filename="receipt"; filename*=UTF-8''${encodeURIComponent(receipt.name)}`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'",
  } });
}
async function remove(_request: NextRequest, context: Context) {
  const { id, receiptId } = await context.params;
  const transaction = await prisma.cardTransaction.findUnique({ where: { id }, select: { id: true } });
  if (!transaction) return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
  const result = await prisma.transactionReceipt.deleteMany({ where: { id: receiptId, transactionId: id } });
  if (!result.count) return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
export const GET = withLedgerScope(get);
export const DELETE = withLedgerScope(remove);
