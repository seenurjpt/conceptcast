/**
 * The admin audit log, and the sign-in rate limit built on it.
 *
 * Every sign-in attempt, lockout and sign-out is recorded. Raw IP addresses
 * are never stored (the privacy policy says the app keeps none): each event
 * carries a keyed hash of the IP instead, which is enough to count failed
 * attempts from one place and to tell sources apart in the log, and cannot
 * be turned back into the address. Events expire after 90 days.
 */
import { createHmac } from 'node:crypto';
import mongoose, { Schema, type Model } from 'mongoose';
import { adminSecret } from './session';

export const AUDIT_KINDS = ['login_ok', 'login_fail', 'locked_out', 'logout'] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export interface AdminAuditDoc {
  _id: mongoose.Types.ObjectId;
  at: Date;
  kind: AuditKind;
  /** The email typed in (failed attempts may be anything). */
  email: string;
  /** Keyed hash of the IP address, never the address itself. */
  source: string;
  /** Browser and OS, shortened. */
  agent: string;
}

const AdminAuditSchema = new Schema<AdminAuditDoc>({
  at: { type: Date, required: true, default: () => new Date(), index: { expires: 60 * 60 * 24 * 90 } },
  kind: { type: String, required: true, enum: AUDIT_KINDS },
  email: { type: String, required: true, default: '' },
  source: { type: String, required: true, index: true },
  agent: { type: String, required: true, default: '' },
});

function model(): Model<AdminAuditDoc> {
  if (process.env.NODE_ENV !== 'production' && mongoose.models.AdminAudit) mongoose.deleteModel('AdminAudit');
  return (mongoose.models.AdminAudit as Model<AdminAuditDoc> | undefined) ?? mongoose.model<AdminAuditDoc>('AdminAudit', AdminAuditSchema, 'admin_audit');
}

/** Failed attempts allowed from one source before it is locked out. */
export const MAX_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;

/** The request's source as a keyed hash: 16 hex characters, stable for one IP. */
export function sourceOf(req: Request): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown';
  return createHmac('sha256', adminSecret() ?? 'admin-audit').update(ip).digest('hex').slice(0, 16);
}

export function agentOf(req: Request): string {
  return (req.headers.get('user-agent') ?? '').slice(0, 160);
}

export async function recordAdminEvent(kind: AuditKind, req: Request, email = ''): Promise<void> {
  await model().create({ kind, email: email.slice(0, 200), source: sourceOf(req), agent: agentOf(req) });
}

/** Minutes left on a lockout for this source, or 0 when it may try again. */
export async function lockoutMinutesLeft(req: Request, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - LOCKOUT_MINUTES * 60_000);
  const source = sourceOf(req);
  const recent = await model()
    .find({ source, at: { $gte: since }, kind: { $in: ['login_fail', 'login_ok'] } }, { kind: 1, at: 1 })
    .sort({ at: -1 })
    .limit(MAX_FAILURES)
    .lean<Pick<AdminAuditDoc, 'kind' | 'at'>[]>();
  // A success resets the count; only an unbroken run of failures locks.
  const failures = recent.filter((e, i) => e.kind === 'login_fail' && recent.slice(0, i).every((x) => x.kind === 'login_fail'));
  if (failures.length < MAX_FAILURES) return 0;
  const oldest = failures[failures.length - 1].at.getTime();
  return Math.max(1, Math.ceil((oldest + LOCKOUT_MINUTES * 60_000 - now.getTime()) / 60_000));
}

export async function listAdminEvents(limit = 100): Promise<AdminAuditDoc[]> {
  return model().find({}).sort({ at: -1 }).limit(limit).lean<AdminAuditDoc[]>();
}
