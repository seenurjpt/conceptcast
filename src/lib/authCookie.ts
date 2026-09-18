/**
 * A signed cookie marking "someone completed LinkedIn sign-in in this browser".
 *
 * Scope, deliberately: conceptcast is single-tenant (spec §4 — one LinkedIn
 * token in one row, no credentials collection). This cookie gates the *UI* so
 * the app has a front door and does not show drafts to a fresh browser. It is
 * NOT an access-control boundary: the LinkedIn tokens belong to the one
 * installation, so anyone who can reach this deployment and click sign-in ends
 * up inside. If this ever serves more than one person, replace this with real
 * per-user sessions and scope every query by user.
 *
 * Uses Web Crypto (HMAC-SHA256) so it verifies in edge middleware, where the
 * Mongo driver cannot run.
 */

export const SESSION_COOKIE = 'cc_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  return (
    process.env.SESSION_SECRET ??
    process.env.LINKEDIN_CLIENT_SECRET ??
    process.env.CRON_SECRET ??
    // Dev fallback: a fixed value keeps you signed in across restarts. Set
    // SESSION_SECRET in production so the cookie cannot be forged.
    'conceptcast-dev-secret'
  );
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64url(new Uint8Array(mac));
}

/** `<issuedAtMs>.<signature>` */
export async function createSessionValue(now = Date.now()): Promise<string> {
  const issued = String(now);
  return `${issued}.${await sign(issued)}`;
}

export async function verifySessionValue(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return false;
  const issued = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^\d+$/.test(issued)) return false;
  if (now - Number(issued) > MAX_AGE_SECONDS * 1000) return false;

  const expected = await sign(issued);
  // Constant-time compare so a wrong signature leaks no timing information.
  if (expected.length !== mac.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === 'production',
};
