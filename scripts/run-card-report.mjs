import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseEnvValue(contents, key) {
  const line = contents.split(/\r?\n/).find((item) => item.trim().startsWith(`${key}=`));
  if (!line) return '';
  const raw = line.slice(line.indexOf('=') + 1).trim();
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

const projectDir = resolve(import.meta.dirname, '..');
let secret = '';
try {
  const env = await readFile(resolve(projectDir, '.env'), 'utf8');
  secret = parseEnvValue(env, 'CRON_SECRET');
} catch (e) {
  console.warn('Warning: .env file not found or could not be read.');
}

const reportUrl =
  process.env.CARD_REPORT_URL || 'http://127.0.0.1:4010/api/cron/card-transactions/report';

const headers = { 'Content-Type': 'application/json' };
if (secret) {
  headers['authorization'] = `Bearer ${secret}`;
}

// CLI args parsing (e.g., node run-card-report.mjs --date 2026-09-29 --force)
const args = process.argv.slice(2);
const body = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) {
    body.targetDate = args[i + 1];
    i++;
  } else if (args[i] === '--force') {
    body.forceAll = true;
  }
}

console.log(`Triggering daily card report at ${reportUrl}...`, body);

try {
  const response = await fetch(reportUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Card report failed (${response.status}): ${text}`);
  }

  console.log('✅ Daily card report successfully executed:');
  console.log(text);
} catch (err) {
  console.error('❌ Error executing card report:', err.message);
  process.exit(1);
}
