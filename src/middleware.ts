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
 * Reachable signed out: the landing page, the login screen, the OAuth dance (including the status
 * endpoint, which the login screen reads to explain a missing config), and the
 * machine endpoints, which carry their own signing key or shared secret.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/linkedin',
  '/api/inngest',
  '/api/cron',
];

/**
 * Exact paths crawlers and link previews fetch without credentials: the
 * landing page itself, robots.txt, the sitemap and the social preview image.
 */
const PUBLIC_EXACT = new Set(['/', '/robots.txt', '/sitemap.xml', '/opengraph-image', '/twitter-image']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // The landing page is static and cached; the only per-visitor decision is
  // made here at the edge, from the cookie alone, so the page never touches the
  // database. A stale cookie lands on /backlog, whose layout checks the
  // LinkedIn account and sends the visitor to /login?stale=1 to clear it.
  if (pathname === '/') {
    if (await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value)) {
      const url = req.nextUrl.clone();
      url.pathname = '/backlog';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
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
  url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, static files (including the landing
  // page's demo video), and the icon/manifest
  // endpoints: browsers request those without credentials, so gating them
  // just means a tab with no favicon.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm)$).*)',
  ],
};
