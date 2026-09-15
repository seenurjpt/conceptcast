import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { VoiceProfile, type VoiceProfileDoc } from '@/lib/db/models';
import { extractStyleGuide } from '@/lib/voice';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const Body = z.object({
  posts: z.array(z.string().min(1).max(5_000)).min(3).max(20),
  /** Also store the posts as the profile's example posts (default true). */
  saveExamples: z.boolean().default(true),
});

/** POST /api/voice/extract { posts } — one Sonnet call → style guide, saved to the profile. */
export const POST = handler(async (req: Request) => {
  const body = await readJson(req, Body);
  const styleGuide = await extractStyleGuide(body.posts);
  const set: Record<string, unknown> = { styleGuide, updatedAt: new Date() };
  if (body.saveExamples) set.examplePosts = body.posts;
  const profile = await VoiceProfile.findOneAndUpdate(
    { key: 'singleton' },
    { $set: set },
    { upsert: true, new: true },
  ).lean<VoiceProfileDoc>();
  return ok({ profile });
});
