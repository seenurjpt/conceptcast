import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/publishers/linkedin';

export const dynamic = 'force-dynamic';

/** Starts the LinkedIn OAuth flow. State is pinned in an httpOnly cookie. */
export async function GET(): Promise<NextResponse> {
  try {
    const state = randomBytes(16).toString('hex');
    const res = NextResponse.redirect(getAuthorizationUrl(state));
    res.cookies.set('li_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
