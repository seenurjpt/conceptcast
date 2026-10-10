/**
 * Who is the signed-in author? The middleware already gates every route on
 * the signed session cookie; this resolves that session to a stable userId
 * so the post-generation collections can be scoped per user.
 *
 * The app is single-tenant today: the userId is the LinkedIn member URN of
 * the connected account, or CONCEPTCAST_USER_ID / 'local' before LinkedIn
 * has been connected. When real multi-user sessions arrive, only this file
 * needs to change.
 */
import { cookies, headers } from 'next/headers';
import { SESSION_COOKIE, verifySessionValue } from './authCookie';
import { touchAppSession } from './appSessions';
import { HttpError } from './api';
import { currentUserId } from './currentUser';
import { getAuth } from './publishers/linkedin';

export { currentUserId };

/**
 * A session is the signed cookie *and* a connected LinkedIn account. The
 * cookie alone is a 30-day bearer token the edge middleware can check without
 * a database; it is not enough on its own, because signing out (or wiping the
 * database) removes the LinkedIn row while the cookie lives on in the browser.
 * Every server-side check goes through here so a stale cookie never opens the
 * dashboard or the data routes.
 */
export async function hasActiveSession(): Promise<boolean> {
  const jar = await cookies();
  if (!(await verifySessionValue(jar.get(SESSION_COOKIE)?.value))) return false;
  return (await getAuth()) !== null;
}

/** Note that this browser's session is in use, for the admin panel's user counts. Call after hasActiveSession(). */
export async function noteSessionActivity(): Promise<void> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return;
  const agent = (await headers()).get('user-agent') ?? '';
  await touchAppSession(
    value,
    async () => {
      const auth = await getAuth();
      return { urn: auth?.memberUrn, name: auth?.memberName };
    },
    agent,
  );
}

export async function requireUserId(): Promise<string> {
  if (!(await hasActiveSession())) throw new HttpError(401, 'Sign in with LinkedIn to continue.');
  return currentUserId();
}
