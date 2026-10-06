import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthorizationUrl } from '@/lib/publishers/linkedin';

export const dynamic = 'force-dynamic';

/** Only internal dashboard paths; never an absolute URL (open-redirect guard). */
// Kept in step with the login screen's SAFE_NEXT: a path missing here was
// silently swapped for the default.
const SAFE_RETURN = /^\/(dashboard|review|backlog|calendar|voice|analytics|settings|admin)(\/|\?|$)/;

/**
 * Starts Sign in with LinkedIn (OpenID Connect + w_member_social).
 * State is pinned in an httpOnly cookie. A plain sign-in lands on the
 * dashboard; a deep link the login gate interrupted (or "Sign in again" from
 * inside the app) carries its path along and returns there.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const requested = req.nextUrl.searchParams.get('returnTo') ?? '/dashboard';
    const returnTo = SAFE_RETURN.test(requested) ? requested : '/dashboard';
    const state = randomBytes(16).toString('hex');
    const res = NextResponse.redirect(getAuthorizationUrl(state));
    const cookie = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 600 };
    res.cookies.set('li_oauth_state', state, cookie);
    res.cookies.set('li_oauth_return', returnTo, cookie);
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
