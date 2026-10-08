'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendJson } from '@/lib/ui';
import { Card, Notice } from '@/components/ui';

/**
 * The two optional inputs for an "I'm starting to learn this" post. Both can
 * be left blank; the post then names the topic, lists no study plan, and
 * promises no posting rhythm.
 */
export function AnnounceForm({
  topicId,
  topicTitle,
  replacesPending,
  onCancel,
}: {
  topicId: string;
  topicTitle: string;
  /** A pending announcement exists and will be replaced. */
  replacesPending: boolean;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [why, setWhy] = useState('');
  const [goal, setGoal] = useState('');
  const [cadence, setCadence] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card title={`Announce that you're learning ${topicTitle}`}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const r = await sendJson<{ draftId: string }>(`/api/topics/${topicId}/announce`, 'POST', {
              why: why.trim() || undefined,
              goal: goal.trim() || undefined,
              cadence: cadence.trim() || undefined,
            });
            router.push(`/review?draft=${r.draftId}`);
          } catch (err) {
            setError((err as Error).message);
            setPending(false);
          }
        }}
      >
        <p className="t-body-sm text-body">
          A short post telling your network you are learning this in public, ending with a question that invites their
          advice. It promises no study plan, so you can learn in any order. It lands in Drafts for you to edit before
          anything is posted.
        </p>
        <div>
          <label className="label" htmlFor="announce-why">
            Why you are starting (optional)
          </label>
          <textarea
            id="announce-why"
            className="input min-h-[80px] w-full"
            value={why}
            maxLength={400}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Our service fell over at 10x traffic and I could not explain why."
          />
          <p className="t-caption mt-1.5 text-muted">The most interesting line of the post, if you have one. Nothing is made up if you leave it blank.</p>
        </div>
        <div>
          <label className="label" htmlFor="announce-goal">
            What you want to be able to do (optional)
          </label>
          <input
            id="announce-goal"
            className="input w-full"
            value={goal}
            maxLength={200}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Design a backend that survives a 10x traffic spike"
          />
          <p className="t-caption mt-1.5 text-muted">A concrete goal makes the post specific. Leave it blank and none is invented.</p>
        </div>
        <div>
          <label className="label" htmlFor="announce-cadence">
            How often you will post (optional)
          </label>
          <input
            id="announce-cadence"
            className="input w-full sm:w-72"
            value={cadence}
            maxLength={80}
            onChange={(e) => setCadence(e.target.value)}
            placeholder="twice a week"
          />
          <p className="t-caption mt-1.5 text-muted">Only mentioned if you fill it in. A missed promise reads worse than none.</p>
        </div>
        {replacesPending && (
          <p className="t-caption text-muted">This replaces the announcement still waiting in Drafts.</p>
        )}
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Writing…' : 'Write the announcement'}
          </button>
          <button className="btn btn-quiet" type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
        <p className="t-caption text-muted">Takes a few seconds and costs about a cent.</p>
      </form>
    </Card>
  );
}
