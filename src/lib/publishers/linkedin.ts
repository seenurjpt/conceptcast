/**
 * LinkedIn personal-profile publishing (spec §7).
 *
 * - OAuth 2.0 authorization-code flow with the self-serve "Share on LinkedIn"
 *   product (`w_member_social`) plus `openid profile` for the member id.
 * - Posts go to the versioned `POST /rest/posts` surface.
 * - A successful create returns 201 with an empty body; the post URN lives in
 *   the `x-restli-id` response header.
 * - `commentary` uses LinkedIn's "little text" format and needs escaping.
 */
import { LinkedInAuth, type LinkedInAuthDoc } from '../db/models';

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';
const SOCIAL_ACTIONS_URL = 'https://api.linkedin.com/rest/socialActions';

export const DEFAULT_SCOPES = ['openid', 'profile', 'w_member_social'];

/** Refresh proactively at day 50 of the 60-day access token (spec §7). */
export const REFRESH_AT_DAYS_BEFORE_EXPIRY = 10;

export function apiVersion(): string {
  const v = process.env.LINKEDIN_API_VERSION ?? '202608';
  if (!/^\d{6}$/.test(v)) throw new Error(`LINKEDIN_API_VERSION must be YYYYMM, got "${v}"`);
  return v;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set.`);
  return v;
}

/* ── escaping ─────────────────────────────────────────────────────────────── */

const RESERVED = ['\\', '(', ')', '<', '>', '@', '|', '{', '}', '[', ']', '~', '*', '_'];
const RESERVED_RE = new RegExp(`[${RESERVED.map((c) => `\\${c}`).join('')}]`, 'g');

/**
 * Escapes the characters LinkedIn's `commentary` field treats as markup:
 * ( ) < > @ | { } [ ] ~ * _ and the backslash itself. Hashtags (`#`) are
 * left alone so they still link. Idempotent only on unescaped input — never
 * call it twice on the same string.
 */
export function escapeCommentary(text: string): string {
  return text.replace(RESERVED_RE, (c) => `\\${c}`);
}

/* ── OAuth ────────────────────────────────────────────────────────────────── */

export function requestedScopes(): string[] {
  const extra = (process.env.LINKEDIN_EXTRA_SCOPES ?? '')
    .split(/[ ,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_SCOPES, ...extra])];
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: requireEnv('LINKEDIN_CLIENT_ID'),
    redirect_uri: requireEnv('LINKEDIN_REDIRECT_URI'),
    state,
    scope: requestedScopes().join(' '),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...body,
      client_id: requireEnv('LINKEDIN_CLIENT_ID'),
      client_secret: requireEnv('LINKEDIN_CLIENT_SECRET'),
    }).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LinkedIn token endpoint ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: requireEnv('LINKEDIN_REDIRECT_URI'),
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export interface LinkedInUserInfo {
  sub: string;
  name: string | null;
  picture: string | null;
  email: string | null;
}

/** OpenID Connect userinfo — this is the "sign in" half of the flow. */
export async function fetchUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`LinkedIn userinfo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { sub: string; name?: string; picture?: string; email?: string };
  return {
    sub: json.sub,
    name: json.name ?? null,
    picture: json.picture ?? null,
    email: json.email ?? null,
  };
}

/** Persist a token response as the singleton auth row. */
export async function storeTokens(
  tokens: TokenResponse,
  member: { urn: string; name: string | null; picture?: string | null; email?: string | null },
): Promise<LinkedInAuthDoc> {
  const now = Date.now();
  const existing = await LinkedInAuth.findOne({ key: 'singleton' }).lean<LinkedInAuthDoc>();
  const doc = await LinkedInAuth.findOneAndUpdate(
    { key: 'singleton' },
    {
      $set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? null,
        expiresAt: new Date(now + tokens.expires_in * 1000),
        refreshExpiresAt: tokens.refresh_token_expires_in
          ? new Date(now + tokens.refresh_token_expires_in * 1000)
          : (existing?.refreshExpiresAt ?? null),
        memberUrn: member.urn,
        memberName: member.name,
        memberPicture: member.picture ?? existing?.memberPicture ?? null,
        memberEmail: member.email ?? existing?.memberEmail ?? null,
        scopes: tokens.scope ? tokens.scope.split(/[ ,]+/) : (existing?.scopes ?? requestedScopes()),
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  ).lean<LinkedInAuthDoc>();
  return doc as LinkedInAuthDoc;
}

/* ── auth state ───────────────────────────────────────────────────────────── */

export type AuthState = 'missing' | 'ok' | 'refresh-due' | 'expired' | 'refresh-expired';

/**
 * Current credentials: the singleton row, or an env-var fallback
 * (LINKEDIN_ACCESS_TOKEN + LINKEDIN_MEMBER_URN) for the no-OAuth quick path.
 */
export async function getAuth(): Promise<LinkedInAuthDoc | null> {
  const row = await LinkedInAuth.findOne({ key: 'singleton' }).lean<LinkedInAuthDoc>();
  if (row) return row;
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const urn = process.env.LINKEDIN_MEMBER_URN;
  if (token && urn) {
    return {
      key: 'env',
      accessToken: token,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
      refreshExpiresAt: null,
      memberUrn: urn,
      memberName: null,
      memberPicture: null,
      memberEmail: null,
      scopes: DEFAULT_SCOPES,
      updatedAt: new Date(),
    } as LinkedInAuthDoc;
  }
  return null;
}

export function authState(auth: LinkedInAuthDoc | null, now = new Date()): AuthState {
  if (!auth) return 'missing';
  if (auth.expiresAt.getTime() <= now.getTime()) {
    if (auth.refreshToken && auth.refreshExpiresAt && auth.refreshExpiresAt > now) return 'expired';
    return auth.refreshToken ? 'refresh-expired' : 'expired';
  }
  const dueAt = auth.expiresAt.getTime() - REFRESH_AT_DAYS_BEFORE_EXPIRY * 86_400_000;
  if (now.getTime() >= dueAt) return 'refresh-due';
  return 'ok';
}

/**
 * Daily job body (spec §7 token refresh). Returns what it did. Never throws on
 * "nothing to do"; throws when a refresh that should work fails.
 */
export async function refreshIfDue(): Promise<{ state: AuthState; refreshed: boolean }> {
  const auth = await LinkedInAuth.findOne({ key: 'singleton' }).lean<LinkedInAuthDoc>();
  const state = authState(auth);
  if (!auth || !auth.refreshToken) return { state, refreshed: false };
  if (state !== 'refresh-due' && state !== 'expired') return { state, refreshed: false };
  if (auth.refreshExpiresAt && auth.refreshExpiresAt <= new Date()) {
    return { state: 'refresh-expired', refreshed: false };
  }
  const tokens = await refreshTokens(auth.refreshToken);

  // Re-read the profile on refresh. LinkedIn's CDN URLs are time-limited, so a
  // stored picture eventually 404s and the avatar silently falls back to
  // initials; this also picks up a changed name or photo. A failure here must
  // not lose the new tokens, so fall back to what we already had.
  let member = { urn: auth.memberUrn, name: auth.memberName, picture: auth.memberPicture, email: auth.memberEmail };
  try {
    const me = await fetchUserInfo(tokens.access_token);
    member = { urn: `urn:li:person:${me.sub}`, name: me.name, picture: me.picture, email: me.email };
  } catch (e) {
    console.error(`LinkedIn userinfo failed during refresh, keeping stored profile: ${(e as Error).message}`);
  }

  await storeTokens(tokens, member);
  return { state: 'ok', refreshed: true };
}

/* ── publishing ───────────────────────────────────────────────────────────── */

function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'LinkedIn-Version': apiVersion(),
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

export function buildPostBody(memberUrn: string, text: string): Record<string, unknown> {
  return {
    author: memberUrn,
    commentary: escapeCommentary(text),
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
}

export class LinkedInPublishError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LinkedInPublishError';
  }
}

/**
 * Publishes plain text to the member's own feed. Returns the post URN read
 * from the `x-restli-id` header — the body is empty on success.
 */
export async function publishPost(text: string, auth?: LinkedInAuthDoc | null): Promise<{ postUrn: string }> {
  const a = auth ?? (await getAuth());
  const state = authState(a);
  if (!a || state === 'expired' || state === 'refresh-expired') {
    throw new LinkedInPublishError(`LinkedIn is not connected (${state}). Re-authorise from the dashboard.`, 401, false);
  }
  const res = await fetch(POSTS_URL, {
    method: 'POST',
    headers: restHeaders(a.accessToken),
    body: JSON.stringify(buildPostBody(a.memberUrn, text)),
  });
  if (res.status !== 201 && res.status !== 200) {
    const body = (await res.text()).slice(0, 500);
    const retryable = res.status === 429 || res.status >= 500;
    throw new LinkedInPublishError(`LinkedIn POST /rest/posts ${res.status}: ${body}`, res.status, retryable);
  }
  const postUrn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id');
  if (!postUrn) {
    throw new LinkedInPublishError('LinkedIn returned 201 but no x-restli-id header; post id lost.', 201, false);
  }
  return { postUrn };
}

export interface SocialMetrics {
  reactions: number;
  comments: number;
}

/**
 * Reactions and comments for a post via /rest/socialActions. Needs
 * `r_member_social`; a 403 means the scope was not granted, in which case the
 * dashboard's manual "how did this do?" field is the fallback (spec §8).
 */
export async function fetchSocialMetrics(postUrn: string, auth?: LinkedInAuthDoc | null): Promise<SocialMetrics> {
  const a = auth ?? (await getAuth());
  if (!a) throw new Error('LinkedIn is not connected.');
  const res = await fetch(`${SOCIAL_ACTIONS_URL}/${encodeURIComponent(postUrn)}`, {
    headers: restHeaders(a.accessToken),
  });
  if (!res.ok) {
    throw new LinkedInPublishError(
      `LinkedIn socialActions ${res.status}: ${(await res.text()).slice(0, 300)}`,
      res.status,
      res.status === 429 || res.status >= 500,
    );
  }
  const json = (await res.json()) as {
    likesSummary?: { totalLikes?: number };
    commentsSummary?: { totalFirstLevelComments?: number; aggregatedTotalComments?: number };
  };
  return {
    reactions: json.likesSummary?.totalLikes ?? 0,
    comments: json.commentsSummary?.aggregatedTotalComments ?? json.commentsSummary?.totalFirstLevelComments ?? 0,
  };
}
