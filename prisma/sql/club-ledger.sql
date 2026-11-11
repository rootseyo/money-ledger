-- Additive and repeatable: the project predates Prisma migration history.
-- Applied by deploy.sh before the application is built/reloaded.
CREATE TABLE IF NOT EXISTS "ledger_members" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_members_workspaceId_userId_key" ON "ledger_members"("workspaceId", "userId");
CREATE INDEX IF NOT EXISTS "ledger_members_workspaceId_archived_idx" ON "ledger_members"("workspaceId", "archived");
CREATE TABLE IF NOT EXISTS "dues_payments" (
  "transactionId" TEXT PRIMARY KEY REFERENCES "card_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "memberId" TEXT NOT NULL REFERENCES "ledger_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "month" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "dues_payments_memberId_month_idx" ON "dues_payments"("memberId", "month");
CREATE TABLE IF NOT EXISTS "transaction_receipts" (
  "id" TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "card_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "transaction_receipts_transactionId_createdAt_idx" ON "transaction_receipts"("transactionId", "createdAt");
