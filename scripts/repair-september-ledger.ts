/** Explicit one-time repair requested by the owner; retains a database snapshot. */
async function main() {
  process.loadEnvFile();
  const { prisma } = await import('../src/lib/db');
  const { monthBounds } = await import('../src/lib/fixed-expense-schedule');
  const { importMonthlyFixedExpenses } = await import('../src/lib/monthly-fixed-expenses-server');
  const month = '2026-09';
  const { start, end } = monthBounds(month);
  const fields = ['merchant', 'title', 'content', 'cardOrAccount', 'category'] as const;
  try {
    const cleaned = await prisma.$transaction(async db => {
      const rows = await db.cardTransaction.findMany({ where: {
        notifiedAt: { gte: start, lte: end }, OR: fields.map(field => ({ [field]: { contains: '세요)' } })),
      } });
      if (!rows.length) return 0;
      const snapshots = [];
      for (const row of rows) {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ledger-edit:${row.id}`}))`;
        const current = await db.cardTransaction.findUniqueOrThrow({ where: { id: row.id } });
        const changes = Object.fromEntries(fields.filter(field => current[field]?.includes('세요)')).map(field => [field, current[field]!.replace(/세요\)\s*/g, '').trim()]));
        if (!Object.keys(changes).length) continue;
        snapshots.push(current);
        await db.cardTransaction.update({ where: { id: row.id }, data: changes });
      }
      await db.systemSetting.create({ data: {
        key: `ledger-repair:${month}:${Date.now()}`, category: 'MAINTENANCE_BACKUP', updatedBy: 'owner-request',
        description: 'Before removal of legacy merchant prefix', value: JSON.stringify(snapshots),
      } });
      return snapshots.length;
    }, { timeout: 20000 });
    const imported = await importMonthlyFixedExpenses(month, 'owner-request', true);
    const fixedCount = await prisma.cardTransaction.count({ where: { fixedExpenseId: { not: null }, scheduledFor: { gte: start, lte: end } } });
    const remaining = await prisma.cardTransaction.count({ where: { notifiedAt: { gte: start, lte: end }, OR: fields.map(field => ({ [field]: { contains: '세요)' } })) } });
    console.log(JSON.stringify({ month, cleaned, imported, fixedCount, remaining }));
  } finally { await prisma.$disconnect(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
