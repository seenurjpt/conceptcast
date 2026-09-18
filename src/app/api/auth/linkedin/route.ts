import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthorizationUrl } from '@/lib/publishers/linkedin';

export const dynamic = 'force-dynamic';

/** Only internal dashboard paths; never an absolute URL (open-redirect guard). */
const SAFE_RETURN = /^\/(review|backlog|calendar|voice|analytics)(\/|\?|$)/;

/**
 * Starts Sign in with LinkedIn (OpenID Connect + w_member_social).
 * State is pinned in an httpOnly cookie; the return path rides along so the
 * user lands back where they clicked rather than always on the calendar.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const requested = req.nextUrl.searchParams.get('returnTo') ?? '/review';
    const returnTo = SAFE_RETURN.test(requested) ? requested : '/review';
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
