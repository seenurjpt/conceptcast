import { handler, ok, HttpError } from '@/lib/api';
import { ConceptProposal, PROPOSAL_STATUSES, type ConceptProposalDoc, type ProposalStatus } from '@/lib/db/models';
import { proposeConcepts } from '@/lib/concepts/proposals';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** GET /api/proposals?status=pending */
export const GET = handler(async (req: Request) => {
  const status = new URL(req.url).searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !(PROPOSAL_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `status must be one of ${PROPOSAL_STATUSES.join(', ')} or all.`);
  }
  const filter = status === 'all' ? {} : { status: status as ProposalStatus };
  const proposals = await ConceptProposal.find(filter).sort({ createdAt: -1 }).lean<ConceptProposalDoc[]>();
  return ok({ proposals });
});

/** POST /api/proposals — run the monthly "propose 10 concepts" job now. */
export const POST = handler(async () => {
  const proposals = await proposeConcepts();
  return ok({ proposals }, 201);
});
