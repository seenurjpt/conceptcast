/**
 * Server-side admin checks, on top of the middleware gate: every admin page
 * and route verifies the cookie again itself, so a mistake in the
 * middleware matcher can never expose admin data.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { HttpError } from '../api';
import { ADMIN_COOKIE, verifyAdminSession } from './session';

/** The signed-in admin's email, or null. */
export async function currentAdmin(): Promise<string | null> {
  const jar = await cookies();
  return verifyAdminSession(jar.get(ADMIN_COOKIE)?.value);
}

/** For admin pages: the admin's email, or a redirect to the admin sign-in. */
export async function requireAdminPage(): Promise<string> {
  const email = await currentAdmin();
  if (!email) redirect('/admin/login');
  return email;
}

/** For admin API routes: the admin's email, or a 401. */
export async function requireAdminApi(): Promise<string> {
  const email = await currentAdmin();
  if (!email) throw new HttpError(401, 'Admin sign-in required.');
  return email;
}
