import { z } from 'zod';
import { handler, ok, readJson } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { listTopics, createTopic, suggestAndAddSubtopics } from '@/lib/topics/service';

export const dynamic = 'force-dynamic';
/** Creating with suggestions makes one model call; give it room. */
export const maxDuration = 90;

/** GET /api/topics → your topics plus the shared ones, each with subtopic counts. */
export const GET = handler(async () => {
  const userId = await requireUserId();
  return ok({ topics: await listTopics(userId) });
});

const Body = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  /** Ask the model for a starter list of subtopics right away. */
  suggest: z.boolean().default(true),
});

/** POST /api/topics { title, description?, suggest? } → { topic, subtopics } */
export const POST = handler(async (req: Request) => {
  const userId = await requireUserId();
  const body = await readJson(req, Body);
  const topic = await createTopic(userId, body);

  if (!body.suggest) return ok({ topic, subtopics: [], suggested: 0 }, 201);

  // A failed suggestion must not lose the topic the user just typed: keep
  // the topic, report the failure, and let them retry from the topic page.
  try {
    const { added } = await suggestAndAddSubtopics(topic);
    return ok({ topic, subtopics: added, suggested: added.length }, 201);
  } catch (e) {
    return ok({ topic, subtopics: [], suggested: 0, suggestError: (e as Error).message }, 201);
  }
});
