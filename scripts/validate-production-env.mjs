import { readFileSync } from 'node:fs';

const source = readFileSync('.env', 'utf8');
const values = new Map();
for (const line of source.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match || match[1].startsWith('#')) continue;
  let value = match[2];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  values.set(match[1], value);
}

const required = ['DATABASE_URL', 'JWT_SECRET', 'PRIVACY_OPERATOR_NAME', 'PRIVACY_CONTACT_EMAIL', 'KAKAO_REST_API_KEY', 'KAKAO_CLIENT_SECRET', 'KAKAO_REDIRECT_URI'];
const missing = required.filter(key => !values.get(key)?.trim());
if (missing.length) {
  console.error(`Missing required production settings: ${missing.join(', ')}`);
  process.exit(1);
}
const secret = values.get('JWT_SECRET').trim();
if (secret.length < 32 || secret === 'money_ledger_jwt_secret_change_me_in_production') {
  console.error('JWT_SECRET must be a unique secret of at least 32 characters.');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.get('PRIVACY_CONTACT_EMAIL').trim())) {
  console.error('PRIVACY_CONTACT_EMAIL must be a valid email address.');
  process.exit(1);
}
try {
  const redirect = new URL(values.get('KAKAO_REDIRECT_URI').trim());
  if (redirect.protocol !== 'https:' || !redirect.hostname || redirect.pathname !== '/api/auth/kakao/callback') throw new Error();
} catch {
  console.error('KAKAO_REDIRECT_URI must be a valid HTTPS production callback URI ending with /api/auth/kakao/callback.');
  process.exit(1);
}
