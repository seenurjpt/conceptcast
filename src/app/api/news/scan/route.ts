import { handler, ok } from '@/lib/api';
import { expireNewsProposals, proposeFromNews } from '@/lib/news/propose';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST /api/news/scan — run the daily news scan now; proposals appear in the backlog queue. */
export const POST = handler(async () => {
  const expired = await expireNewsProposals();
  const log: string[] = [];
  const scan = await proposeFromNews((m) => log.push(m));
  return ok({ expired, ...scan, log }, 201);
});
