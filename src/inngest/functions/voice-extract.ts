/**
 * `conceptcast/voice.extract` → one standard-tier call over every voice
 * sample the user has, producing a new voice_profiles version and flipping
 * isActive in a transaction. Needs at least 10 samples.
 */
import { NonRetriableError } from 'inngest';
import { inngest, POST_EVENTS, type VoiceExtractData } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { oid, voiceProfiles, voiceSamples } from '@/lib/db/collections';
import { complete } from '@/lib/llm/client';
import { voiceExtractPrompt, VoiceExtractOutput } from '@/lib/prompts/voiceExtract';

export const MIN_VOICE_SAMPLES = 10;

export const voiceExtract = inngest.createFunction(
  {
    id: 'voice-extract',
    retries: 1,
    concurrency: [{ limit: 1, key: 'event.data.userId' }],
    triggers: [{ event: POST_EVENTS.voiceExtract }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as VoiceExtractData;

    const samples = await step.run('load-samples', async () => {
      await dbConnect();
      const list = await voiceSamples.list(userId);
      if (list.length < MIN_VOICE_SAMPLES) {
        throw new NonRetriableError(`Voice extraction needs at least ${MIN_VOICE_SAMPLES} samples; user ${userId} has ${list.length}.`);
      }
      return list.map((s) => ({ id: String(s._id), text: s.text, source: s.source }));
    });

    const profile = await step.run('extract', async () => {
      await dbConnect();
      return complete({
        userId,
        tier: 'standard',
        stage: 'voice-extract',
        schema: VoiceExtractOutput,
        ...voiceExtractPrompt(samples),
      });
    });

    return step.run('save', async () => {
      await dbConnect();
      const doc = await voiceProfiles.createVersion(
        userId,
        profile,
        samples.map((s) => oid(s.id)),
      );
      return { profileId: String(doc._id), version: doc.version, samples: samples.length };
    });
  },
);
