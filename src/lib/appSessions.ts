/**
 * App sign-in sessions, recorded so the admin panel can count who is signed in.
 *
 * The sign-in cookie itself is stateless (see authCookie.ts), so without this
 * the server has no idea how many browsers hold one. Each session is a row
 * keyed by a hash of the cookie value (the cookie is a bearer token, so the
 * value itself is never stored). Sign-in creates it, using the app refreshes
 * its last-seen time at most every few minutes, and sign-out closes it. Rows
 * expire with the cookie, 30 days after sign-in.
 */
import { createHash } from 'node:crypto';
import mongoose, { Schema, type Model } from 'mongoose';
import { sessionCookieOptions } from './authCookie';

export interface AppSessionDoc {
  /** sha256 of the cookie value, 32 hex characters. */
  _id: string;
  memberUrn: string;
  memberName: string;
  signedInAt: Date;
  lastSeenAt: Date;
  /** When the cookie stops working; the row is deleted then. */
  expiresAt: Date;
  /** Set by sign-out. */
  endedAt: Date | null;
  /** Browser and OS, shortened. */
  agent: string;
}

const AppSessionSchema = new Schema<AppSessionDoc>(
  {
    _id: { type: String, required: true },
    memberUrn: { type: String, default: '' },
    memberName: { type: String, default: '' },
    signedInAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    endedAt: { type: Date, default: null },
    agent: { type: String, default: '' },
  },
  { versionKey: false },
);

function model(): Model<AppSessionDoc> {
  if (process.env.NODE_ENV !== 'production' && mongoose.models.AppSession) mongoose.deleteModel('AppSession');
  return (mongoose.models.AppSession as Model<AppSessionDoc> | undefined) ?? mongoose.model<AppSessionDoc>('AppSession', AppSessionSchema, 'app_sessions');
}

/** How often one session writes its last-seen time. */
const TOUCH_EVERY_MS = 5 * 60_000;
/** Seen within this long counts as "active now". */
export const ACTIVE_NOW_MINUTES = 15;

/** Last write per session in this process, so most page loads skip the database. */
const lastTouch = new Map<string, number>();

const sidOf = (cookieValue: string) => createHash('sha256').update(cookieValue).digest('hex').slice(0, 32);
const issuedAt = (cookieValue: string) => new Date(Number(cookieValue.slice(0, cookieValue.indexOf('.'))) || Date.now());

interface Member {
  urn?: string | null;
  name?: string | null;
}

/**
 * Record a session as in use. Creates the row if it is missing (sessions that
 * began before tracking existed, or after a sign-out on another device closed
 * it while this cookie stayed valid), and reopens it if it was closed.
 * Never throws: tracking must not break the page.
 */
export async function touchAppSession(cookieValue: string, member: () => Promise<Member>, agent: string, now = new Date()): Promise<void> {
  const sid = sidOf(cookieValue);
  const last = lastTouch.get(sid);
  if (last && now.getTime() - last < TOUCH_EVERY_MS) return;
  if (lastTouch.size > 5000) lastTouch.clear();
  lastTouch.set(sid, now.getTime());
  const signedInAt = issuedAt(cookieValue);
  try {
    const who = await member();
    await model().updateOne(
      { _id: sid },
      {
        $set: { lastSeenAt: now, endedAt: null, agent: agent.slice(0, 160), memberUrn: who.urn ?? '', memberName: who.name ?? '' },
        $setOnInsert: { signedInAt, expiresAt: new Date(signedInAt.getTime() + sessionCookieOptions.maxAge * 1000) },
      },
      { upsert: true },
    );
  } catch (e) {
    lastTouch.delete(sid);
    console.warn('[sessions] could not record session', (e as Error).message);
  }
}

/** Sign-in: a fresh session. */
export const startAppSession = (cookieValue: string, member: Member, agent: string) => touchAppSession(cookieValue, async () => member, agent);

/**
 * Sign-out removes the one LinkedIn connection, which signs out every device
 * at once, so every open session is closed.
 */
export async function endAllAppSessions(now = new Date()): Promise<void> {
  lastTouch.clear();
  try {
    await model().updateMany({ endedAt: null }, { $set: { endedAt: now } });
  } catch (e) {
    console.warn('[sessions] could not close sessions', (e as Error).message);
  }
}

export interface AppSessionStats {
  signedIn: number;
  activeNow: number;
  activeToday: number;
  signIns7: number;
  accounts: number;
  sessions: AppSessionDoc[];
}

/** Counts for the admin panel, plus the most recently used sessions. */
export async function appSessionStats(now = new Date(), limit = 50): Promise<AppSessionStats> {
  const open = { endedAt: null, expiresAt: { $gt: now } };
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const [signedIn, activeNow, activeToday, signIns7, members, sessions] = await Promise.all([
    model().countDocuments(open),
    model().countDocuments({ ...open, lastSeenAt: { $gte: ago(ACTIVE_NOW_MINUTES * 60_000) } }),
    model().countDocuments({ lastSeenAt: { $gte: ago(24 * 3_600_000) } }),
    model().countDocuments({ signedInAt: { $gte: ago(7 * 24 * 3_600_000) } }),
    model().distinct('memberUrn', { ...open, memberUrn: { $ne: '' } }),
    model().find({}).sort({ lastSeenAt: -1 }).limit(limit).lean<AppSessionDoc[]>(),
  ]);
  return { signedIn, activeNow, activeToday, signIns7, accounts: members.length, sessions };
}
