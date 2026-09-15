import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { VoiceProfile, type VoiceProfileDoc } from '@/lib/db/models';
import { getVoiceProfile, topPerformingPosts } from '@/lib/voice';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const [profile, top] = await Promise.all([getVoiceProfile(), topPerformingPosts(3)]);
  return ok({ profile, topPerformers: top });
});

const Put = z.object({
  styleGuide: z.string().max(20_000).optional(),
  audienceDescription: z.string().min(5).max(2_000).optional(),
  examplePosts: z.array(z.string().min(1).max(5_000)).max(20).optional(),
});

/** PUT /api/voice — save style guide, audience, and pasted example posts. */
export const PUT = handler(async (req: Request) => {
  const body = await readJson(req, Put);
  const profile = await VoiceProfile.findOneAndUpdate(
    { key: 'singleton' },
    { $set: { ...body, updatedAt: new Date() } },
    { upsert: true, new: true },
  ).lean<VoiceProfileDoc>();
  return ok({ profile });
});
