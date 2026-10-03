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
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionValue } from './authCookie';
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

export async function requireUserId(): Promise<string> {
  if (!(await hasActiveSession())) throw new HttpError(401, 'Sign in with LinkedIn to continue.');
  return currentUserId();
}
