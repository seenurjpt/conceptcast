import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { voiceSamples, voiceProfiles } from '@/lib/db/collections';
import { VOICE_SOURCES } from '@/lib/schemas/post';
import { MIN_VOICE_SAMPLES } from '@/inngest/functions/voice-extract';

export const dynamic = 'force-dynamic';

const Body = z.object({
  text: z.string().trim().min(20).max(20_000),
  source: z.enum(VOICE_SOURCES).default('other'),
});

/** POST /api/voice/samples { text, source } → the stored sample + how many the user has. */
export const POST = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  const sample = await voiceSamples.insert({ userId, text: body.text, source: body.source });
  const count = await voiceSamples.count(userId);
  return ok({ sample, count, minForExtract: MIN_VOICE_SAMPLES }, 201);
});

/** GET /api/voice/samples → all samples plus the active profile summary. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  const [samples, active] = await Promise.all([voiceSamples.list(userId), voiceProfiles.active(userId)]);
  return ok({ samples, count: samples.length, minForExtract: MIN_VOICE_SAMPLES, activeProfile: active });
});
