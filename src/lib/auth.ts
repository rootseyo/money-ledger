import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const SESSION_COOKIE_NAME = 'money_token';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required. Refusing to use an insecure default secret.');
    }
    return 'dev-money-ledger-fallback-secret-key-32chars';
  }
  return secret;
}

export function signUserToken(payload: UserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyUserToken(request: NextRequest): UserPayload | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : request.cookies.get(SESSION_COOKIE_NAME)?.value ||
      request.cookies.get('admin_token')?.value;

  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.id !== 'string' || typeof payload.role !== 'string') return null;
    return payload as UserPayload;
  } catch {
    return null;
  }
}

// Backwards compatibility alias for existing code
export const verifyAdminToken = verifyUserToken;
export const signAdminToken = signUserToken;
export type AdminPayload = UserPayload;
