import { NextResponse, type NextRequest } from 'next/server';
import { dbConnect } from '@/lib/db/connect';
import { exchangeCode, fetchUserInfo, storeTokens } from '@/lib/publishers/linkedin';

export const dynamic = 'force-dynamic';

function back(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/calendar', req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete('li_oauth_state');
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
    return back(req, { linkedin: 'error', message: 'OAuth state mismatch; start again.' });
  }

  try {
    await dbConnect();
    const tokens = await exchangeCode(code);
    const me = await fetchUserInfo(tokens.access_token);
    await storeTokens(tokens, { urn: `urn:li:person:${me.sub}`, name: me.name });
    return back(req, { linkedin: 'connected' });
  } catch (e) {
    return back(req, { linkedin: 'error', message: (e as Error).message.slice(0, 200) });
  }
}
