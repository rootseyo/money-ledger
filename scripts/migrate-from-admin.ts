/**
 * Data Migration Script: Admin DB -> Money Ledger DB
 * 
 * Safely copies:
 * 1. Admin users -> User table
 * 2. CardTransaction records (preserving all IDs, timestamps, amounts, fixed occurrence keys)
 * 3. ApiTokens (preserving tokens, prefixes, expiration)
 * 4. Relevant SystemSettings (household_*, financial_assets_*, screen-passkeys, list-order)
 * 
 * Runs full financial reconciliation before and after migration.
 * Usage:
 *   npx tsx scripts/migrate-from-admin.ts [--dry-run]
 */

import { Pool } from 'pg';
import 'dotenv/config';

const DRY_RUN = process.argv.includes('--dry-run');

// Source DB (Admin DB)
const SOURCE_DB_URL =
  process.env.SOURCE_DATABASE_URL ||
  'postgresql://admin_user:admin_password@localhost:5432/admin_db?schema=public';

// Target DB (Money Ledger DB)
const TARGET_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://money_user:money_password@localhost:5432/money_db?schema=public';

const RELEVANT_SETTING_PREFIXES = [
  'household_',
  'financial_assets_',
  'admin-screen-passkeys',
  'card-list-order',
  'household-fixed-month:',
];

async function main() {
  console.log(`=======================================================`);
  console.log(`💸 Money Ledger Data Migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log(`=======================================================`);
  console.log(`Source: ${SOURCE_DB_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Target: ${TARGET_DB_URL.replace(/:[^:@]+@/, ':****@')}`);

  const sourcePool = new Pool({ connectionString: SOURCE_DB_URL });
  const targetPool = new Pool({ connectionString: TARGET_DB_URL });

  try {
    // 1. Check Source Connections
    console.log(`\n🔍 Checking connection to Source DB...`);
    const sourceTxCountRes = await sourcePool.query(`SELECT COUNT(*)::int AS count FROM "card_transactions"`);
    const sourceTxCount = sourceTxCountRes.rows[0].count;
    console.log(`✅ Source DB connected. Found ${sourceTxCount} transactions.`);

    // Check Target DB
    console.log(`🔍 Checking connection to Target DB...`);
    const targetTxCountRes = await targetPool.query(`SELECT COUNT(*)::int AS count FROM "card_transactions"`);
    const targetTxCount = targetTxCountRes.rows[0].count;
    console.log(`✅ Target DB connected. Current transactions: ${targetTxCount}`);

    // 2. Reconcile Source Baseline
    console.log(`\n📊 Calculating Source Financial Baseline...`);
    const baselineQuery = `
      SELECT 
        TO_CHAR("notifiedAt", 'YYYY-MM') AS month,
        "type",
        COUNT(*)::int AS count,
        COALESCE(SUM("amount"), 0)::bigint AS sum_amount
      FROM "card_transactions"
      GROUP BY TO_CHAR("notifiedAt", 'YYYY-MM'), "type"
      ORDER BY month DESC, "type" ASC
    `;
    const sourceBaseline = await sourcePool.query(baselineQuery);
    console.log(`Source Breakdown:`);
    console.table(sourceBaseline.rows.slice(0, 10));

    if (DRY_RUN) {
      console.log(`\n⚠️ DRY RUN complete. No changes were made to Target DB.`);
      return;
    }

    // 3. Migrate Users (Admins -> Users)
    console.log(`\n👥 1. Migrating Users...`);
    const adminsRes = await sourcePool.query(`
      SELECT "id", "email", "password", "name", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt"
      FROM "Admin"
    `);
    console.log(`Found ${adminsRes.rows.length} admin accounts.`);

    for (const admin of adminsRes.rows) {
      await targetPool.query(`
        INSERT INTO "users" ("id", "email", "password", "name", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT ("id") DO UPDATE SET
          "email" = EXCLUDED."email",
          "password" = EXCLUDED."password",
          "name" = EXCLUDED."name",
          "role" = EXCLUDED."role",
          "isActive" = EXCLUDED."isActive",
          "lastLoginAt" = EXCLUDED."lastLoginAt",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [
        admin.id,
        admin.email,
        admin.password,
        admin.name,
        admin.role,
        admin.isActive,
        admin.lastLoginAt,
        admin.createdAt,
        admin.updatedAt,
      ]);
    }
    console.log(`✅ Users migrated successfully.`);

    // 4. Migrate CardTransactions
    console.log(`\n💳 2. Migrating Card Transactions...`);
    const txsRes = await sourcePool.query(`
      SELECT 
        "id", "sourceApp", "type", "amount", "merchant", "category",
        "title", "content", "balance", "cardOrAccount", "packageName",
        "notifiedAt", "isReported", "reportedAt", "rawData",
        "fixedExpenseId", "fixedOccurrenceKey", "scheduledFor",
        "createdAt", "updatedAt"
      FROM "card_transactions"
      ORDER BY "notifiedAt" ASC
    `);

    let txInserted = 0;
    const primaryUserId = adminsRes.rows[0]?.id || null;

    for (const tx of txsRes.rows) {
      await targetPool.query(`
        INSERT INTO "card_transactions" (
          "id", "userId", "sourceApp", "type", "amount", "merchant", "category",
          "title", "content", "balance", "cardOrAccount", "packageName",
          "notifiedAt", "isReported", "reportedAt", "rawData",
          "fixedExpenseId", "fixedOccurrenceKey", "scheduledFor",
          "createdAt", "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21
        )
        ON CONFLICT ("id") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "sourceApp" = EXCLUDED."sourceApp",
          "type" = EXCLUDED."type",
          "amount" = EXCLUDED."amount",
          "merchant" = EXCLUDED."merchant",
          "category" = EXCLUDED."category",
          "title" = EXCLUDED."title",
          "content" = EXCLUDED."content",
          "balance" = EXCLUDED."balance",
          "cardOrAccount" = EXCLUDED."cardOrAccount",
          "packageName" = EXCLUDED."packageName",
          "notifiedAt" = EXCLUDED."notifiedAt",
          "isReported" = EXCLUDED."isReported",
          "reportedAt" = EXCLUDED."reportedAt",
          "rawData" = EXCLUDED."rawData",
          "fixedExpenseId" = EXCLUDED."fixedExpenseId",
          "fixedOccurrenceKey" = EXCLUDED."fixedOccurrenceKey",
          "scheduledFor" = EXCLUDED."scheduledFor",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [
        tx.id,
        primaryUserId,
        tx.sourceApp,
        tx.type,
        tx.amount,
        tx.merchant,
        tx.category,
        tx.title,
        tx.content,
        tx.balance,
        tx.cardOrAccount,
        tx.packageName,
        tx.notifiedAt,
        tx.isReported,
        tx.reportedAt,
        tx.rawData ? JSON.stringify(tx.rawData) : null,
        tx.fixedExpenseId,
        tx.fixedOccurrenceKey,
        tx.scheduledFor,
        tx.createdAt,
        tx.updatedAt,
      ]);
      txInserted++;
    }
    console.log(`✅ ${txInserted} transactions migrated.`);

    // 5. Migrate ApiTokens
    console.log(`\n🔑 3. Migrating API Tokens...`);
    const tokensRes = await sourcePool.query(`
      SELECT "id", "adminId", "name", "token", "tokenPrefix", "expiresAt", "lastUsedAt", "isActive", "createdAt", "updatedAt"
      FROM "api_tokens"
    `);
    for (const t of tokensRes.rows) {
      await targetPool.query(`
        INSERT INTO "api_tokens" ("id", "userId", "name", "token", "tokenPrefix", "expiresAt", "lastUsedAt", "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT ("id") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "name" = EXCLUDED."name",
          "token" = EXCLUDED."token",
          "tokenPrefix" = EXCLUDED."tokenPrefix",
          "expiresAt" = EXCLUDED."expiresAt",
          "lastUsedAt" = EXCLUDED."lastUsedAt",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [
        t.id,
        t.adminId || primaryUserId,
        t.name,
        t.token,
        t.tokenPrefix,
        t.expiresAt,
        t.lastUsedAt,
        t.isActive,
        t.createdAt,
        t.updatedAt,
      ]);
    }
    console.log(`✅ ${tokensRes.rows.length} API tokens migrated.`);

    // 6. Migrate SystemSettings
    console.log(`\n⚙️ 4. Migrating System Settings...`);
    const settingsRes = await sourcePool.query(`
      SELECT "key", "value", "description", "category", "updatedBy", "createdAt", "updatedAt"
      FROM "system_settings"
    `);

    let settingsCount = 0;
    for (const s of settingsRes.rows) {
      const isRelevant = RELEVANT_SETTING_PREFIXES.some(p => s.key.startsWith(p));
      if (!isRelevant) continue;

      await targetPool.query(`
        INSERT INTO "system_settings" ("key", "userId", "value", "description", "category", "updatedBy", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT ("key") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "value" = EXCLUDED."value",
          "description" = EXCLUDED."description",
          "category" = EXCLUDED."category",
          "updatedBy" = EXCLUDED."updatedBy",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [
        s.key,
        primaryUserId,
        s.value,
        s.description,
        s.category,
        s.updatedBy,
        s.createdAt,
        s.updatedAt,
      ]);
      settingsCount++;
    }
    console.log(`✅ ${settingsCount} settings migrated.`);

    // 7. Post-Migration Reconciliation & Verification
    console.log(`\n🔍 5. Performing Reconciliation Checks...`);
    const targetBaseline = await targetPool.query(baselineQuery);
    
    let mismatch = false;
    if (sourceBaseline.rows.length !== targetBaseline.rows.length) {
      mismatch = true;
      console.error(`❌ Mismatch in row groups count: Source=${sourceBaseline.rows.length}, Target=${targetBaseline.rows.length}`);
    }

    for (let i = 0; i < sourceBaseline.rows.length; i++) {
      const s = sourceBaseline.rows[i];
      const t = targetBaseline.rows.find(r => r.month === s.month && r.type === s.type);
      if (!t) {
        mismatch = true;
        console.error(`❌ Missing group in target: ${s.month} ${s.type}`);
        continue;
      }
      if (s.count !== t.count || String(s.sum_amount) !== String(t.sum_amount)) {
        mismatch = true;
        console.error(`❌ Data mismatch for ${s.month} ${s.type}: Source(${s.count}건, ₩${s.sum_amount}) vs Target(${t.count}건, ₩${t.sum_amount})`);
      }
    }

    if (!mismatch) {
      console.log(`🎉 PERFECT MATCH! All transaction counts and monetary sums exactly match between Source and Target DB.`);
    } else {
      console.warn(`⚠️ Please review mismatches listed above.`);
    }

  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
