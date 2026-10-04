import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { users } from '@/lib/db/collections';
import { MAX_POOL_SIZE } from '@/lib/research/pool';
import { kickResearchPool, poolSizeFor, poolStatus } from '@/lib/research/service';

export const dynamic = 'force-dynamic';
/** A size increase starts background research after the response. */
export const maxDuration = 300;

async function summary(userId: string) {
  const [researchPoolSize, status] = await Promise.all([poolSizeFor(userId), poolStatus()]);
  const count = (s: string) => status.plan.slots.filter((x) => x.state === s).length;
  return {
    researchPoolSize,
    maxResearchPoolSize: MAX_POOL_SIZE,
    pool: { disabled: status.disabled, ready: count('ready'), running: count('running'), queued: count('queued') },
  };
}

/** GET /api/user/prefs → preferences plus how full the research pool is. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok(await summary(userId));
});

const Body = z.object({
  researchPoolSize: z.number().int().min(0).max(MAX_POOL_SIZE).optional(),
});

/** PUT /api/user/prefs { researchPoolSize? } */
export const PUT = handler(async (req: Request) => {
  const started = Date.now();
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  if (body.researchPoolSize !== undefined) await users.setPrefs(userId, { researchPoolSize: body.researchPoolSize });
  kickResearchPool('pool size changed', { requestStartedAt: started });
  return ok(await summary(userId));
});
