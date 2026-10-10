import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handler, readJson, HttpError } from '@/lib/api';
import { verifyPassword } from '@/lib/admin/password';
import { ADMIN_COOKIE, adminConfigured, adminCookieOptions, createAdminSession } from '@/lib/admin/session';
import { lockoutMinutesLeft, recordAdminEvent } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().trim().max(200),
  password: z.string().max(500),
});

/** A placeholder hash so a wrong email costs the same time as a wrong password. */
const DUMMY_HASH = 'scrypt:32768:8:1:AAAAAAAAAAAAAAAAAAAAAA==:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

/**
 * POST /api/admin/login { email, password }
 *
 * Signs the admin in with the credentials from the environment. Five
 * failures in a row from one source lock it out for fifteen minutes; every
 * attempt is in the audit log. Errors never say which of the two was wrong.
 */
export const POST = handler(async (req: Request) => {
  if (!adminConfigured()) {
    throw new HttpError(503, 'The admin panel is not set up. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET.');
  }
  const { email, password } = await readJson(req, Body);

  const minutes = await lockoutMinutesLeft(req);
  if (minutes > 0) {
    await recordAdminEvent('locked_out', req, email);
    throw new HttpError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  const expectedEmail = process.env.ADMIN_EMAIL!;
  const emailOk = email.toLowerCase() === expectedEmail.toLowerCase();
  // Always run the hash check, so timing does not reveal whether the email matched.
  const passwordOk = await verifyPassword(password, emailOk ? process.env.ADMIN_PASSWORD_HASH! : DUMMY_HASH);

  if (!emailOk || !passwordOk) {
    await recordAdminEvent('login_fail', req, email);
    // A little friction for scripted guessing, on top of the lockout.
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError(401, 'Wrong email or password.');
  }

  await recordAdminEvent('login_ok', req, expectedEmail);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createAdminSession(expectedEmail), adminCookieOptions);
  return res;
});
