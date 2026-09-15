import { handler, ok } from '@/lib/api';
import { LinkedInAuth } from '@/lib/db/models';
import { getAuth, authState, refreshIfDue } from '@/lib/publishers/linkedin';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const auth = await getAuth();
  return ok({
    state: authState(auth),
    memberUrn: auth?.memberUrn ?? null,
    memberName: auth?.memberName ?? null,
    expiresAt: auth?.expiresAt ?? null,
    refreshExpiresAt: auth?.refreshExpiresAt ?? null,
    scopes: auth?.scopes ?? [],
    source: auth ? auth.key : null,
    configured: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI),
  });
});

/** Force a token refresh now. */
export const POST = handler(async () => ok(await refreshIfDue()));

/** Disconnect (forget the stored tokens). */
export const DELETE = handler(async () => {
  await LinkedInAuth.deleteOne({ key: 'singleton' });
  return ok({ state: 'missing' });
});
