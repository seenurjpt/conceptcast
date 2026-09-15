/**
 * Daily: decay yesterday's boosts, then scan feeds for headlines that relate
 * to a backlog concept (spec §3 timeliness signal). Optional — set
 * TIMELINESS_ENABLED=false to keep the function registered but inert.
 */
import { inngest } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { decayTimelinessBoosts, scanTimeliness } from '@/lib/concepts/timeliness';

export const scanTimelinessFn = inngest.createFunction(
  {
    id: 'scan-timeliness',
    retries: 1,
    triggers: [{ cron: '30 4 * * *' }],
  },
  async ({ step, logger }) => {
    if (process.env.TIMELINESS_ENABLED === 'false') return { skipped: true };
    const decayed = await step.run('decay', async () => {
      await dbConnect();
      return decayTimelinessBoosts();
    });
    const scan = await step.run('scan', async () => {
      await dbConnect();
      return scanTimeliness((m) => logger.info(m));
    });
    return { decayed, ...scan };
  },
);
