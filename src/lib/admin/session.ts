/**
 * The admin session: a signed cookie, separate from the user's LinkedIn
 * session in every way. Different name, different secret, different
 * signing context, shorter life and a strict same-site policy. Being signed
 * in to the app grants nothing here, and an admin cookie grants nothing in
 * the app.
 *
 * Web Crypto (HMAC-SHA256), so edge middleware can verify it.
 *
 * The admin is configured entirely by environment variables:
 *   ADMIN_EMAIL           who may sign in
 *   ADMIN_PASSWORD_HASH   scrypt hash (npm run admin:hash), never the password
 *   ADMIN_SESSION_SECRET  signs this cookie; at least 32 characters
 * With any of them missing the admin panel is switched off: every admin
 * page and route refuses, and the sign-in page says so.
 */

export const ADMIN_COOKIE = 'cc_admin';
export const ADMIN_SESSION_HOURS = 8;
const MAX_AGE_SECONDS = ADMIN_SESSION_HOURS * 60 * 60;
/** Signed into every value so a signature from any other cookie never verifies here. */
const CONTEXT = 'conceptcast-admin-v1';

export function adminSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && adminSecret());
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${CONTEXT}|${payload}`));
  return b64url(new Uint8Array(mac));
}

/** `<issuedAtMs>.<emailB64url>.<signature>` */
export async function createAdminSession(email: string, now = Date.now()): Promise<string> {
  const secret = adminSecret();
  if (!secret) throw new Error('Admin is not configured.');
  const payload = `${now}.${b64url(new TextEncoder().encode(email))}`;
  return `${payload}.${await sign(payload, secret)}`;
}

/** The signed-in admin's email, or null when the value is missing, forged, expired or for another admin. */
export async function verifyAdminSession(value: string | undefined, now = Date.now()): Promise<string | null> {
  const secret = adminSecret();
  if (!value || !secret || !process.env.ADMIN_EMAIL) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [issued, emailPart, mac] = parts;
  if (!/^\d+$/.test(issued)) return null;
  const age = now - Number(issued);
  if (age < 0 || age > MAX_AGE_SECONDS * 1000) return null;

  const expected = await sign(`${issued}.${emailPart}`, secret);
  if (expected.length !== mac.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  if (diff !== 0) return null;

  let email: string;
  try {
    const bin = atob(emailPart.replace(/-/g, '+').replace(/_/g, '/'));
    email = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  } catch {
    return null;
  }
  // Changing ADMIN_EMAIL signs everyone out.
  return email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() ? email : null;
}

export const adminCookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === 'production',
};
