/**
 * Box 8: 48h after a publish, fetch engagement into `publications.metrics`
 * and nudge the selector's weights (spec §8). Uses a durable sleep so the
 * timer survives deploys.
 */
import { inngest, EVENTS, type PublishedData } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { fetchAndRecordMetrics } from '@/lib/publishing';

const METRICS_DELAY = process.env.METRICS_DELAY ?? '48h';

export const fetchMetrics = inngest.createFunction(
  {
    id: 'fetch-metrics',
    retries: 3,
    triggers: [{ event: EVENTS.published }],
  },
  async ({ event, step }) => {
    const { publicationId } = event.data as PublishedData;
    await step.sleep('wait-48h', METRICS_DELAY);
    return step.run('fetch-and-record', async () => {
      await dbConnect();
      return fetchAndRecordMetrics(publicationId);
    });
  },
);
