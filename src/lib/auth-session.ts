import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, signUserToken, type UserPayload } from './auth';
export function setSession(response: NextResponse, user: UserPayload) {
  response.cookies.set(SESSION_COOKIE_NAME, signUserToken({ id: user.id, email: user.email, name: user.name, role: user.role }), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 86400,
  });
  response.cookies.set('admin_screen_lock', '', { path: '/', maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
