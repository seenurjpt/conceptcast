/**
 * Daily: refresh the LinkedIn access token proactively at day 50 (spec §7).
 * If the refresh token itself has expired the dashboard shows a re-auth banner.
 */
import { inngest } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { refreshIfDue } from '@/lib/publishers/linkedin';

export const refreshToken = inngest.createFunction(
  {
    id: 'refresh-linkedin-token',
    retries: 2,
    triggers: [{ cron: '15 3 * * *' }],
  },
  async ({ step }) =>
    step.run('refresh-if-due', async () => {
      await dbConnect();
      return refreshIfDue();
    }),
);
