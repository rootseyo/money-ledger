import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyUserToken } from './lib/auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The public introduction is served at the canonical home URL without
  // exposing the authenticated ledger or changing existing bookmarked URLs.
  if (pathname === '/') {
    const user = verifyUserToken(request);
    const response = user
      ? NextResponse.next()
      : NextResponse.rewrite(new URL(`/login${request.nextUrl.search}`, request.url));
    response.headers.set('Cache-Control', 'private, no-store');
    if (user) response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }

  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return response;
  }
  if (
    pathname.startsWith('/_next/') ||
    ['/favicon.ico', '/icon.svg', '/icon.png', '/apple-icon.png', '/og-ledger.png', '/robots.txt', '/sitemap.xml', '/login', '/signup', '/terms', '/privacy'].includes(pathname)
  ) return NextResponse.next();

  const user = verifyUserToken(request);
  const response = user ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
