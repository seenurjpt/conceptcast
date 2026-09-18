import { z } from 'zod';
import { handler, ok, readJson, HttpError } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { voiceSamples } from '@/lib/db/collections';
import { inngest, POST_EVENTS } from '@/inngest/client';
import { MIN_VOICE_SAMPLES } from '@/inngest/functions/voice-extract';
import { VoiceProfile, type VoiceProfileDoc } from '@/lib/db/models';
import { extractStyleGuide } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Body = z.object({
  /**
   * Legacy path (the /voice page): pasted posts → style guide, inline.
   * Omit it to enqueue the voice_profiles extraction from stored samples.
   */
  posts: z.array(z.string().min(1).max(5_000)).min(3).max(20).optional(),
  saveExamples: z.boolean().default(true),
});

/**
 * POST /api/voice/extract
 *   {}                → enqueues `conceptcast/voice.extract` for the signed-in user (needs >= 10 samples)
 *   { posts: [...] }  → legacy inline style-guide extraction (singleton profile)
 */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req, Body);

  if (body.posts) {
    const styleGuide = await extractStyleGuide(body.posts);
    const set: Record<string, unknown> = { styleGuide, updatedAt: new Date() };
    if (body.saveExamples) set.examplePosts = body.posts;
    const profile = await VoiceProfile.findOneAndUpdate({ key: 'singleton' }, { $set: set }, { upsert: true, new: true }).lean<VoiceProfileDoc>();
    return ok({ profile });
  }

  const userId = await requireUserId();
  const count = await voiceSamples.count(userId);
  if (count < MIN_VOICE_SAMPLES) {
    throw new HttpError(400, `Voice extraction needs at least ${MIN_VOICE_SAMPLES} samples; you have ${count}. Add more via POST /api/voice/samples.`);
  }
  const { ids } = await inngest.send({ name: POST_EVENTS.voiceExtract, data: { userId } });
  return ok({ queued: true, eventId: ids[0] ?? null, samples: count }, 202);
});
