import { NextResponse } from 'next/server';
import { handler, ok } from '@/lib/api';
import { LinkedInAuth } from '@/lib/db/models';
import { getAuth, authState, refreshIfDue } from '@/lib/publishers/linkedin';
import { SESSION_COOKIE } from '@/lib/authCookie';

export const dynamic = 'force-dynamic';

/** Who is signed in, and can we still publish as them. */
export const GET = handler(async () => {
  const auth = await getAuth();
  const state = authState(auth);
  return ok({
    state,
    signedIn: state === 'ok' || state === 'refresh-due',
    member: auth
      ? {
          urn: auth.memberUrn,
          name: auth.memberName,
          picture: auth.memberPicture,
          email: auth.memberEmail,
        }
      : null,
    expiresAt: auth?.expiresAt ?? null,
    refreshExpiresAt: auth?.refreshExpiresAt ?? null,
    scopes: auth?.scopes ?? [],
    canFetchMetrics: (auth?.scopes ?? []).includes('r_member_social'),
    source: auth ? auth.key : null,
    configured: Boolean(
      process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI,
    ),
  });
});

/** Force a token refresh now. */
export const POST = handler(async () => ok(await refreshIfDue()));

/** Sign out: forget the stored tokens and close the front door. */
export const DELETE = handler(async () => {
  await LinkedInAuth.deleteOne({ key: 'singleton' });
  const res = NextResponse.json({ state: 'missing', signedIn: false });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
