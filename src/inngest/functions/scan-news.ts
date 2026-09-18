/**
 * Daily 07:00 IST: expire stale news proposals, then scan the beat feeds and
 * propose today's topics for review. Set NEWS_SCAN_ENABLED=false to keep the
 * function registered but inert.
 */
import { inngest } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { expireNewsProposals, proposeFromNews } from '@/lib/news/propose';

const CRON = process.env.NEWS_SCAN_CRON ?? 'TZ=Asia/Kolkata 0 7 * * *';

export const scanNews = inngest.createFunction(
  {
    id: 'scan-news',
    retries: 1,
    triggers: [{ cron: CRON }, { event: 'conceptcast/news.scan' }],
  },
  async ({ step, logger }) => {
    if (process.env.NEWS_SCAN_ENABLED === 'false') return { skipped: true };
    const expired = await step.run('expire', async () => {
      await dbConnect();
      return expireNewsProposals();
    });
    const scan = await step.run('scan-and-propose', async () => {
      await dbConnect();
      return proposeFromNews((m) => logger.info(m));
    });
    return { expired, ...scan };
  },
);
