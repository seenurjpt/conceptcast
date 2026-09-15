import { handler, ok, requireCronSecret } from '@/lib/api';
import { publishDuePublications } from '@/lib/publishing';
import { refreshIfDue } from '@/lib/publishers/linkedin';
import { inngest, EVENTS } from '@/inngest/client';

export const dynamic = 'force-dynamic';

/**
 * Fallback scheduler for hosts without Inngest: hit every 15 minutes with
 * `Authorization: Bearer $CRON_SECRET`. Publishes due rows and refreshes the
 * LinkedIn token when due.
 */
export const GET = handler(async (req: Request) => {
  requireCronSecret(req);
  const token = await refreshIfDue().catch((e: Error) => ({ state: 'error', refreshed: false, error: e.message }));
  const outcomes = await publishDuePublications(new Date());
  for (const o of outcomes) {
    if (o.status !== 'published') continue;
    try {
      await inngest.send({ name: EVENTS.published, data: { publicationId: o.publicationId } });
    } catch {
      /* no Inngest here — metrics are entered by hand or via the publications endpoint */
    }
  }
  return ok({ token, outcomes });
});

export const POST = GET;
