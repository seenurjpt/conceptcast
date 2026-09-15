/**
 * Monthly housekeeping: propose 10 new concepts for review (spec §14.5) and
 * refresh the voice profile from the author's top performers (spec §6 step 4).
 */
import { inngest } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { proposeConcepts } from '@/lib/concepts/proposals';
import { refreshVoiceFromTopPerformers } from '@/lib/voice';

export const growBacklog = inngest.createFunction(
  {
    id: 'grow-backlog',
    retries: 1,
    triggers: [{ cron: '0 7 1 * *' }],
  },
  async ({ step }) => {
    const proposed = await step.run('propose-concepts', async () => {
      await dbConnect();
      const docs = await proposeConcepts();
      return docs.map((d) => d.slug);
    });
    const voiceRefreshed = await step.run('refresh-voice', async () => {
      await dbConnect();
      return refreshVoiceFromTopPerformers();
    });
    return { proposed, voiceRefreshed };
  },
);
