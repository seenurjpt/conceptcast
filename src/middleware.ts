import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionValue } from '@/lib/authCookie';

/**
 * Front door. Without a valid session cookie every dashboard page and every
 * data route redirects to /login, so a fresh browser never sees a draft.
 *
 * See src/lib/authCookie.ts for what this does and does not guarantee: it is a
 * UI gate for a single-tenant app, not multi-user access control.
 */

/**
 * Reachable signed out: the login screen, the OAuth dance (including the status
 * endpoint, which the login screen reads to explain a missing config), and the
 * machine endpoints, which carry their own signing key or shared secret.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/linkedin',
  '/api/inngest',
  '/api/cron',
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  if (await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API calls get a 401 they can act on rather than a redirect to HTML.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in with LinkedIn to continue.' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, static files, and the icon/manifest
  // endpoints — browsers request those without credentials, so gating them
  // just means a tab with no favicon.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
