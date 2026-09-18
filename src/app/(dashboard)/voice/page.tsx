'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson, fmtRelative } from '@/lib/ui';
import { ActionButton, Card, Notice, PageHeader } from '@/components/ui';
import { VoiceSamplesCard } from '@/components/VoiceSamplesCard';

interface Profile {
  styleGuide: string;
  audienceDescription: string;
  examplePosts: string[];
  updatedAt: string;
}

const SEPARATOR = '\n---\n';

export default function VoicePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [top, setTop] = useState<string[]>([]);
  const [pasted, setPasted] = useState('');
  const [styleGuide, setStyleGuide] = useState('');
  const [audience, setAudience] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getJson<{ profile: Profile; topPerformers: string[] }>('/api/voice');
      setProfile(r.profile);
      setTop(r.topPerformers);
      setStyleGuide(r.profile.styleGuide);
      setAudience(r.profile.audienceDescription);
      setPasted(r.profile.examplePosts.join(SEPARATOR));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const posts = pasted
    .split(/\n-{3,}\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const run = async (fn: () => Promise<string | void>) => {
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const guideDirty = styleGuide !== profile?.styleGuide || audience !== profile?.audienceDescription;

  return (
    <>
      <PageHeader
        title="Voice"
        subtitle="Thirty minutes here is the highest-leverage work in the project. Every draft is written against this profile."
        actions={
          profile?.updatedAt && <span className="t-caption text-muted">Updated {fmtRelative(profile.updatedAt)}</span>
        }
      />

      <div className="space-y-3">
        {error && <Notice kind="error" onDismiss={() => setError(null)}>{error}</Notice>}
        {notice && <Notice kind="ok" onDismiss={() => setNotice(null)}>{notice}</Notice>}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card
          title={`Example posts · ${posts.length} detected`}
          action={<span className="t-caption text-muted">Separate with ---</span>}
        >
          <textarea
            className="input w-full min-h-[420px]"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'Paste 8 to 15 posts you wrote or admire.\n---\nSecond post…\n---\nThird post…'}
            aria-label="Example posts"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              className="btn btn-primary"
              disabled={posts.length < 3}
              pendingLabel="Reading your writing…"
              onClick={() =>
                run(async () => {
                  await sendJson('/api/voice/extract', 'POST', { posts, saveExamples: true });
                  return 'Style guide extracted and saved.';
                })
              }
            >
              Extract style guide
            </ActionButton>
            <ActionButton
              className="btn btn-quiet"
              onClick={() =>
                run(async () => {
                  await sendJson('/api/voice', 'PUT', { examplePosts: posts });
                  return 'Example posts saved.';
                })
              }
            >
              Save posts only
            </ActionButton>
          </div>
          {posts.length > 0 && posts.length < 3 && (
            <p className="t-caption mt-2 text-muted">Three posts minimum. Eight to fifteen gives a much better guide.</p>
          )}
          {top.length > 0 && (
            <p className="t-caption mt-2 text-muted">
              {top.length} of your own published posts with engagement data are used as examples ahead of these.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Audience">
            <textarea
              className="input w-full min-h-[80px]"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              aria-label="Audience description"
            />
            <p className="t-caption mt-2 text-muted">The writer uses this to decide how much to assume.</p>
          </Card>

          <Card title="Style guide">
            <textarea
              className="input w-full min-h-[360px]"
              value={styleGuide}
              onChange={(e) => setStyleGuide(e.target.value)}
              placeholder="Extract it from your posts, or write it by hand."
              aria-label="Style guide"
            />
            <ActionButton
              className="btn btn-primary mt-3"
              disabled={!guideDirty}
              onClick={() =>
                run(async () => {
                  await sendJson('/api/voice', 'PUT', { styleGuide, audienceDescription: audience });
                  return 'Saved.';
                })
              }
            >
              Save changes
            </ActionButton>
          </Card>

          <VoiceSamplesCard
            onMessage={(msg, kind) => {
              if (kind === 'ok') {
                setError(null);
                setNotice(msg);
              } else {
                setNotice(null);
                setError(msg);
              }
            }}
          />
        </div>
      </div>
    </>
  );
}
