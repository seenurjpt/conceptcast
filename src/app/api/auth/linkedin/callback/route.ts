import { NextResponse, type NextRequest } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { exchangeCode, fetchUserInfo, storeTokens } from '@/lib/publishers/linkedin';
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from '@/lib/authCookie';

export const dynamic = 'force-dynamic';

/** On failure we must land somewhere reachable while signed out. */
function back(req: NextRequest, params: Record<string, string>, to = '/login'): NextResponse {
  const url = new URL(to, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete('li_oauth_state');
  res.cookies.delete('li_oauth_return');
  return res;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const error = params.get('error');
  if (error) return back(req, { linkedin: 'error', message: params.get('error_description') ?? error });

  const code = params.get('code');
  const state = params.get('state');
  const expected = req.cookies.get('li_oauth_state')?.value;
  if (!code || !state || !expected || state !== expected) {
    return back(req, { linkedin: 'error', message: 'Sign-in state mismatch; start again.' });
  }

  try {
    await dbConnect();
    const tokens = await exchangeCode(code);
    const me = await fetchUserInfo(tokens.access_token);
    await storeTokens(tokens, {
      urn: `urn:li:person:${me.sub}`,
      name: me.name,
      picture: me.picture,
      email: me.email,
    });

    const returnTo = req.cookies.get('li_oauth_return')?.value ?? '/review';
    const res = back(req, { linkedin: 'signed-in' }, returnTo);
    res.cookies.set(SESSION_COOKIE, await createSessionValue(), sessionCookieOptions);
    return res;
  } catch (e) {
    return back(req, { linkedin: 'error', message: (e as Error).message.slice(0, 200) });
  }
}
