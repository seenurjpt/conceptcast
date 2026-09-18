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
import { LinkedInAuth } from './db/models';

export async function requireUserId(): Promise<string> {
  const jar = await cookies();
  if (!(await verifySessionValue(jar.get(SESSION_COOKIE)?.value))) {
    throw new HttpError(401, 'Sign in with LinkedIn to continue.');
  }
  return currentUserId();
}

export async function currentUserId(): Promise<string> {
  const auth = await LinkedInAuth.findOne({ key: 'singleton' }).select({ memberUrn: 1 }).lean<{ memberUrn: string } | null>();
  return auth?.memberUrn ?? process.env.CONCEPTCAST_USER_ID ?? 'local';
}
