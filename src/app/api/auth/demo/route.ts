import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSession } from '@/lib/auth-session';
import { demoTransactions } from '@/lib/demo-data';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/user-api';
export async function POST(request: NextRequest) {
  const limit = await checkRateLimit(`demo:${getClientIp(request)}`, { limit: 10, windowMs: 15 * 60000 });
  if (!limit.allowed) return NextResponse.json({ error: '잠시 후 다시 체험해주세요.' }, { status: 429 });
  try {
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const user = await prisma.$transaction(async db => {
      const user = await db.user.create({ data: { email: `demo-${randomUUID()}@demo.invalid`, name: '데모 체험', password, role: 'DEMO', lastLoginAt: new Date() } });
      await db.cardTransaction.createMany({ data: demoTransactions().map(row => ({ ...row, userId: user.id })) });
      await db.systemSetting.createMany({ data: [
        { key: `${user.id}:household_budget`, userId: user.id, category: 'FINANCE', value: JSON.stringify({ monthlyTotal: 1500000, monthlyFixedIncome: 0, categoryBudgets: { FOOD: 400000, CAFE: 100000, SHOPPING: 200000 } }) },
        { key: `${user.id}:financial_assets_data`, userId: user.id, category: 'FINANCE', value: JSON.stringify({ cards: [], accounts: [{ id: 'demo-account', name: '샘플 생활비 통장', bank: '샘플 은행', accountNumber: '0000', type: 'CHECKING', balance: 4250000, interestRate: 0, color: '#60a5fa', isActive: true }], savings: [], investments: [], liabilities: [], realEstates: [], updatedAt: new Date().toISOString() }) },
      ] });
      return user;
    });
    return setSession(NextResponse.json({ success: true }), user);
  } catch (error) {
    console.error('Demo failed:', error);
    return NextResponse.json({ error: '데모를 준비하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
}
