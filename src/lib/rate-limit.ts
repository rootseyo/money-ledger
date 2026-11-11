import { createHash } from 'node:crypto';
import { prisma } from './db';

interface RateLimitOptions { limit: number; windowMs: number }
interface RateLimitResult { allowed: boolean; remaining: number; retryAfterSeconds: number }
let cleanupCounter = 0;

/**
 * Shared, atomic fixed-window limits stored in PostgreSQL so separate app
 * processes enforce the same login/signup budget. The caller key is hashed;
 * raw IP addresses and email addresses are not copied into the settings table.
 */
export async function checkRateLimit(key: string, { limit, windowMs }: RateLimitOptions, now = Date.now()): Promise<RateLimitResult> {
  const digest = createHash('sha256').update(key).digest('hex');
  const settingKey = `rate-limit:${digest}`;
  const initial = JSON.stringify({ count: 1, resetAt: now + windowMs });
  const rows = await prisma.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "system_settings" ("key", "value", "category", "createdAt", "updatedAt")
    VALUES (${settingKey}, ${initial}, 'RATE_LIMIT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "value" = CASE
        WHEN ("system_settings"."value"::jsonb ->> 'resetAt')::bigint <= ${now}
          THEN ${initial}
        ELSE jsonb_build_object(
          'count', (("system_settings"."value"::jsonb ->> 'count')::integer + 1),
          'resetAt', ("system_settings"."value"::jsonb ->> 'resetAt')::bigint
        )::text
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `;

  const bucket = JSON.parse(rows[0]?.value ?? initial) as { count: number; resetAt: number };
  cleanupCounter += 1;
  if (cleanupCounter % 500 === 0) {
    await prisma.$executeRaw`
      DELETE FROM "system_settings"
      WHERE "category" = 'RATE_LIMIT' AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '1 day'
    `;
  }

  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
