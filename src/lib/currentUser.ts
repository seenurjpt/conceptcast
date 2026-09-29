/**
 * The stable id of the one author this installation serves: the LinkedIn
 * member URN of the connected account, or CONCEPTCAST_USER_ID / 'local'
 * before LinkedIn has been connected.
 *
 * Lives apart from session.ts so pipeline code, Inngest functions and CLI
 * scripts can resolve the user without importing next/headers.
 */
import { LinkedInAuth } from './db/models';

export async function currentUserId(): Promise<string> {
  const auth = await LinkedInAuth.findOne({ key: 'singleton' }).select({ memberUrn: 1 }).lean<{ memberUrn: string } | null>();
  return auth?.memberUrn ?? process.env.CONCEPTCAST_USER_ID ?? 'local';
}
