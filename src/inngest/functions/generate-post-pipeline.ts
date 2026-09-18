/**
 * `conceptcast/post.requested` → the 4-stage post pipeline (lib/pipeline/postPipeline).
 *
 * One run per user at a time, 2 retries, idempotent per user+topic+day.
 * Each stage is its own step.run, so a retry resumes after the last
 * successful LLM call instead of paying for it again.
 */
import { NonRetriableError } from 'inngest';
import { inngest, POST_EVENTS, type PostRequestedData } from '../client';
import { dbConnect } from '@/lib/db/connect';
import { generationRuns } from '@/lib/db/collections';
import { complete } from '@/lib/llm/client';
import { runPostPipeline, PipelineError, type StepRunner } from '@/lib/pipeline/postPipeline';
import { mongoPostStore } from '@/lib/pipeline/postStore.mongo';

export const generatePostPipeline = inngest.createFunction(
  {
    id: 'generate-post-pipeline',
    retries: 2,
    concurrency: [{ limit: 1, key: 'event.data.userId' }],
    idempotency: 'event.data.userId + ":" + event.data.topicId + ":" + event.data.dateBucket',
    triggers: [{ event: POST_EVENTS.postRequested }],
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as PostRequestedData;
      await dbConnect();
      const run = await generationRuns.get(data.runId);
      if (run && run.status !== 'failed') {
        await generationRuns.update(data.runId, {
          status: 'failed',
          error: (error as Error).message.slice(0, 2000),
          finishedAt: new Date(),
        });
      }
    },
  },
  async ({ event, step, logger }) => {
    const data = event.data as PostRequestedData;
    await dbConnect();

    const stepRunner: StepRunner = {
      run: (name, fn) => step.run(name, fn) as Promise<ReturnType<typeof fn> extends Promise<infer T> ? T : never>,
    };

    try {
      const outcome = await runPostPipeline(
        { runId: data.runId, userId: data.userId, topicId: data.topicId },
        { step: stepRunner, llm: complete, store: mongoPostStore },
      );
      logger.info(`run ${data.runId}: ${outcome.status}`);
      return outcome;
    } catch (e) {
      if (e instanceof PipelineError && !e.retriable) throw new NonRetriableError(e.message, { cause: e });
      throw e;
    }
  },
);
