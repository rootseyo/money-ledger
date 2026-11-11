import { dataScope, scopedSettingKey, transactionBoundary } from './data-scope';
import { PrismaClient } from '../generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { 
  prisma: PrismaClient;
  pgPool: Pool;
};

let prisma: PrismaClient;

const dbUrl = process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'production') {
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    globalForPrisma.pgPool = new Pool({ connectionString: dbUrl });
    const adapter = new PrismaPg(globalForPrisma.pgPool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

const scopedPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const scope = dataScope.getStore();
        if (!scope) return query(args);
        // Prisma extensions also apply inside interactive transactions.
        const input = args as unknown as { where?: Record<string, unknown>; data?: Record<string, unknown> | Record<string, unknown>[]; create?: Record<string, unknown>; update?: Record<string, unknown> };
        if (model === 'CardTransaction') {
          if (operation !== 'create' && operation !== 'createMany' && operation !== 'createManyAndReturn') {
            const where = input.where || {};
            if (typeof where.fixedOccurrenceKey === 'string' && scope.role !== 'OWNER' && !where.fixedOccurrenceKey.startsWith(`${scope.id}:`)) where.fixedOccurrenceKey = `${scope.id}:${where.fixedOccurrenceKey}`;
            input.where = { ...where, AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), transactionBoundary(scope)] };
          }
          const assign = (row: Record<string, unknown>, creating: boolean) => {
            if (creating) row.userId = scope.id === 'legacy-device' ? null : scope.id;
            else { delete row.userId; delete row.user; }
            if (scope.role === 'DEMO') row.isReported = true;
            if (scope.role !== 'OWNER' && typeof row.fixedOccurrenceKey === 'string' && !row.fixedOccurrenceKey.startsWith(`${scope.id}:`)) row.fixedOccurrenceKey = `${scope.id}:${row.fixedOccurrenceKey}`;
          };
          if (input.data) for (const row of Array.isArray(input.data) ? input.data : [input.data]) assign(row, operation.startsWith('create'));
          if (input.create) assign(input.create, true);
          if (input.update) assign(input.update, false);
        }
        if (model === 'SystemSetting') {
          if (typeof input.where?.key === 'string') input.where.key = scopedSettingKey(input.where.key, scope);
          for (const row of [input.create, ...(Array.isArray(input.data) ? input.data : [input.data])]) {
            if (row && typeof row.key === 'string') {
              row.key = scopedSettingKey(row.key, scope);
              if (scope.role !== 'OWNER') row.userId = scope.id;
            }
          }
        }
        return query(args);
      },
    },
  },
});
export { scopedPrisma as prisma };
