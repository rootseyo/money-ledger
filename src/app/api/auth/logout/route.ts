import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  for (const name of ['admin_token', 'admin_screen_lock', 'money_kakao_state', 'money_kakao_pending', 'money_kakao_account_intent', 'money_kakao_delete_proof']) response.cookies.set(name, '', { path: '/', maxAge: 0 });
  return response;
}
