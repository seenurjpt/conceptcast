import { NextResponse } from 'next/server';
import { handler } from '@/lib/api';
import { currentAdmin } from '@/lib/admin/guard';
import { ADMIN_COOKIE } from '@/lib/admin/session';
import { recordAdminEvent } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

/** POST /api/admin/logout: ends the admin session (the user's app session is untouched). */
export const POST = handler(async (req: Request) => {
  const email = await currentAdmin();
  if (email) await recordAdminEvent('logout', req, email);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
});
