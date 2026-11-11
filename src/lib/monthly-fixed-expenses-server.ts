import 'server-only';
import { prisma } from './db';
import { FIXED_EXPENSES_SETTING_KEY, type FixedExpenseItem } from './fixed-expenses';
import { kstDate, matchesFixedPayment, monthBounds, scheduledDates, SCHEDULED_FIXED_PACKAGE } from './fixed-expense-schedule';
import { kstDatetime, transactionEntryPayload } from './transaction-entry';

/** A one-month entry, separate from the recurring fixed expense templates. */
export async function createMonthlyFixedExpense(month: string, adminId: string, input: Record<string, unknown>) {
  monthBounds(month);
  if (typeof input.entryId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.entryId)) throw new Error('올바른 등록 ID가 필요합니다.');
  const entryId = input.entryId;
  const date = new Date(String(input.notifiedAt || ''));
  if (!Number.isFinite(date.getTime()) || kstDate(date).slice(0, 7) !== month) throw new Error('납부일은 선택한 월 안에서 입력해 주세요.');
  const rawType = input.type === 'DEPOSIT' ? 'DEPOSIT' : 'PAYMENT';
  const values = transactionEntryPayload({
    notifiedAt: kstDatetime(date), merchant: String(input.merchant || ''), amount: String(input.amount ?? ''),
    category: String(input.category || ''), sourceApp: String(input.sourceApp || 'MANUAL'),
    cardOrAccount: String(input.cardOrAccount || ''), content: String(input.content || '월별 고정비'), type: rawType,
  });
  const occurrenceKey = `manual:${month}:${input.entryId}`;
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const existing = await db.cardTransaction.findUnique({ where: { fixedOccurrenceKey: occurrenceKey } });
    if (existing) return { success: true, transaction: existing };
    const scheduledFor = new Date(`${kstDate(date)}T12:00:00+09:00`);
    const transaction = await db.cardTransaction.create({ data: {
      ...values, notifiedAt: scheduledFor, scheduledFor, title: values.merchant,
      fixedExpenseId: `manual:${input.entryId}`, fixedOccurrenceKey: occurrenceKey,
      packageName: SCHEDULED_FIXED_PACKAGE, rawData: { manual: true, entryId, checked: false },
    } });
    const key = `household-fixed-month:${month}`;
    await db.systemSetting.upsert({ where: { key },
      create: { key, value: JSON.stringify({ importedAt: new Date().toISOString(), manual: true }), category: 'CARD_HISTORY', updatedBy: adminId },
      update: {},
    });
    return { success: true, transaction };
  });
}

export async function importMonthlyFixedExpenses(month: string, adminId: string, force = false) {
  const bounds = monthBounds(month);
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const key = `household-fixed-month:${month}`;
    const setting = await db.systemSetting.findUnique({ where: { key: FIXED_EXPENSES_SETTING_KEY } });
    const items: FixedExpenseItem[] = setting ? JSON.parse(setting.value) : [];
    // Explicitly importing a past month can backfill templates registered later.
    // Preserve the template start date and each cycle’s original anchor.
    const planned = items.flatMap(item => scheduledDates(item, month, force && month < kstDate().slice(0, 7)).map(date => ({ item, date })));
    if (!planned.length) return { alreadyImported: false, count: 0, addedCount: 0, updatedCount: 0 };
    const actual = await db.cardTransaction.findMany({ where: { fixedExpenseId: null, type: { in: ['PAYMENT', 'WITHDRAWAL', 'DEPOSIT'] }, notifiedAt: { gte: bounds.start, lte: bounds.end } } });
    const used = new Set<string>();
    let addedCount = 0;
    let updatedCount = 0;
    for (const { item, date } of planned) {
      const occurrenceKey = `${item.id}:${date}`;
      const scheduledFor = new Date(`${date}T12:00:00+09:00`);
      const fixed = { fixedExpenseId: item.id, fixedOccurrenceKey: occurrenceKey, scheduledFor };
      const existing = await db.cardTransaction.findUnique({ where: { fixedOccurrenceKey: occurrenceKey } });
      if (existing) {
        if (existing.packageName === SCHEDULED_FIXED_PACKAGE) {
          await db.cardTransaction.update({
            where: { id: existing.id },
            data: {
              amount: item.amount,
              merchant: item.name,
              category: item.category,
              title: item.name,
              content: item.memo || '월별 고정비',
              cardOrAccount: item.paymentMethod,
              scheduledFor,
              notifiedAt: scheduledFor,
            },
          });
          updatedCount++;
        }
        continue;
      }
      const candidates = actual.filter(tx => !used.has(tx.id) && matchesFixedPayment(item, date, tx));
      const match = candidates.length === 1 && planned.filter(p => matchesFixedPayment(p.item, p.date, candidates[0])).length === 1 ? candidates[0] : null;
      if (match) {
        used.add(match.id);
        const matchRaw = (match.rawData as Record<string, unknown>) || {};
        await db.cardTransaction.update({ where: { id: match.id }, data: { ...fixed, rawData: { ...matchRaw, checked: true } } });
        addedCount++;
      } else {
        await db.cardTransaction.create({ data: {
          ...fixed, sourceApp: 'MANUAL', type: 'PAYMENT', amount: item.amount, merchant: item.name,
          category: item.category, title: item.name, content: item.memo || '월별 고정비', cardOrAccount: item.paymentMethod,
          packageName: SCHEDULED_FIXED_PACKAGE, notifiedAt: scheduledFor,
          rawData: { fixedExpenseKeyword: item.merchantKeyword || item.name, checked: false },
        } });
        addedCount++;
      }
    }
    const settingValue = JSON.stringify({ importedAt: new Date().toISOString(), count: planned.length });
    await db.systemSetting.upsert({
      where: { key },
      create: { key, value: settingValue, category: 'CARD_HISTORY', updatedBy: adminId },
      update: { value: settingValue, updatedBy: adminId },
    });
    return { alreadyImported: false, count: planned.length, addedCount, updatedCount };
  }, { timeout: 20000 });
}

/** Link explicitly selected payment; preserve its original time and content. */
export async function linkFixedPayment(scheduledId: string, actualId: string) {
  return prisma.$transaction(async db => {
    const scheduled = await db.cardTransaction.findUnique({ where: { id: scheduledId } });
    if (!scheduled?.scheduledFor || scheduled.packageName !== SCHEDULED_FIXED_PACKAGE) throw new Error('이미 연결되었거나 삭제된 고정비입니다.');
    const month = kstDate(scheduled.scheduledFor).slice(0, 7);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const actual = await db.cardTransaction.findUnique({ where: { id: actualId } });
    if (!actual || actual.fixedExpenseId || !['PAYMENT', 'WITHDRAWAL', 'DEPOSIT'].includes(actual.type) || kstDate(actual.notifiedAt).slice(0, 7) !== month) throw new Error('이달의 미연결 내역을 선택해 주세요.');
    // deleteMany guards concurrent linking/deletion; the transaction rolls back on any conflict.
    const deleted = await db.cardTransaction.deleteMany({ where: { id: scheduledId, packageName: SCHEDULED_FIXED_PACKAGE } });
    if (deleted.count !== 1) throw new Error('고정비가 변경되었습니다. 새로고침해 주세요.');
    const actualRaw = (actual.rawData as Record<string, unknown>) || {};
    const updated = await db.cardTransaction.updateMany({ where: { id: actualId, fixedExpenseId: null }, data: {
      fixedExpenseId: scheduled.fixedExpenseId, fixedOccurrenceKey: scheduled.fixedOccurrenceKey, scheduledFor: scheduled.scheduledFor,
      rawData: { ...actualRaw, checked: true },
    } });
    if (updated.count !== 1) throw new Error('이미 다른 고정비와 연결된 내역입니다.');
    return { success: true };
  });
}

export async function removeMonthlyFixedExpense(id: string) {
  return prisma.$transaction(async db => {
    const item = await db.cardTransaction.findUnique({ where: { id } });
    if (!item?.fixedExpenseId || !item.scheduledFor) throw new Error('고정비를 찾을 수 없습니다.');
    const month = kstDate(item.scheduledFor).slice(0, 7);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const current = await db.cardTransaction.findUnique({ where: { id } });
    if (!current?.fixedExpenseId) throw new Error('이미 제외된 고정비입니다.');
    if (current.packageName === SCHEDULED_FIXED_PACKAGE) await db.cardTransaction.delete({ where: { id } });
    else {
      const currentRaw = (current.rawData as Record<string, unknown>) || {};
      const { checked: _, ...restRaw } = currentRaw;
      await db.cardTransaction.update({ where: { id }, data: { fixedExpenseId: null, fixedOccurrenceKey: null, scheduledFor: null, rawData: restRaw as any } });
    }
    return { success: true };
  });
}

export async function toggleMonthlyFixedExpenseChecked(id: string, checked: boolean) {
  return prisma.$transaction(async db => {
    const item = await db.cardTransaction.findUnique({ where: { id } });
    if (!item?.fixedExpenseId || !item.scheduledFor) throw new Error('고정비를 찾을 수 없습니다.');
    const month = kstDate(item.scheduledFor).slice(0, 7);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const currentRaw = (item.rawData as Record<string, unknown>) || {};
    const updated = await db.cardTransaction.update({
      where: { id },
      data: {
        rawData: { ...currentRaw, checked },
      },
    });
    return { success: true, transaction: updated };
  });
}

export async function syncMonthlyFixedExpensesChecked(month: string, checkedIds: string[]) {
  const { start, end } = monthBounds(month);
  return prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixed-expenses:${month}`}))`;
    const items = await db.cardTransaction.findMany({
      where: { fixedExpenseId: { not: null }, scheduledFor: { gte: start, lte: end } },
    });
    const checkedSet = new Set(checkedIds);
    let updatedCount = 0;
    for (const item of items) {
      const shouldBeChecked = checkedSet.has(item.id);
      const currentRaw = (item.rawData as Record<string, unknown>) || {};
      if (Boolean(currentRaw.checked) !== shouldBeChecked) {
        await db.cardTransaction.update({
          where: { id: item.id },
          data: { rawData: { ...currentRaw, checked: shouldBeChecked } },
        });
        updatedCount++;
      }
    }
    return { success: true, count: updatedCount };
  });
}
