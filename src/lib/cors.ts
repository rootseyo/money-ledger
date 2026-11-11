import 'server-only';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4010',
  'https://example.com',
];

export function allowedOrigins(): Set<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS)
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured?.length ? [...DEFAULT_ALLOWED_ORIGINS, ...configured] : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedOrigin(origin: string | null): boolean {
  return !origin || allowedOrigins().has(origin) || (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost'));
}

export function corsHeaders(origin: string | null): HeadersInit {
  return {
    ...(origin && isAllowedOrigin(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, X-Visitor-Id, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
