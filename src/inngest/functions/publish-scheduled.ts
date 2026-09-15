/**
 * Box 7: every 15 minutes, publish due rows to LinkedIn (spec §7 scheduling)
 * and start the 48h metrics timer for each one that went out.
 */
import { inngest, EVENTS } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { publishDuePublications } from '@/lib/publishing';

export const publishScheduled = inngest.createFunction(
  {
    id: 'publish-scheduled',
    retries: 1,
    concurrency: [{ limit: 1 }],
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }) => {
    const outcomes = await step.run('publish-due', async () => {
      await dbConnect();
      return publishDuePublications(new Date());
    });

    const published = outcomes.filter((o) => o.status === 'published');
    if (published.length > 0) {
      await step.sendEvent(
        'start-metrics-timers',
        published.map((o) => ({ name: EVENTS.published, data: { publicationId: o.publicationId } })),
      );
    }
    return {
      due: outcomes.length,
      published: published.length,
      failed: outcomes.filter((o) => o.status === 'failed').length,
    };
  },
);
