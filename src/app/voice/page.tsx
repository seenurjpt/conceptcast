'use client';

import { useCallback, useEffect, useState } from 'react';
import { getJson, sendJson, fmtDate } from '@/lib/ui';

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
  const [busy, setBusy] = useState<string | null>(null);

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

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const msg = await fn();
      if (msg) setNotice(msg);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Voice profile</h1>
        <p className="text-sm text-muted">
          One-time bootstrap, highest leverage in the project. Paste 8–15 posts you wrote or admire, extract a style guide, and every
          writer call gets it. {profile?.updatedAt && <>Last updated {fmtDate(profile.updatedAt)}.</>}
        </p>
      </div>
      {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm">{error}</div>}
      {notice && <div className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-sm">{notice}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-2">
          <label className="label" htmlFor="posts">
            Example posts — separate with a line containing only <code>---</code> ({posts.length} detected)
          </label>
          <textarea id="posts" className="input min-h-[420px] font-sans" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'First post…\n---\nSecond post…'} />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              disabled={busy !== null || posts.length < 3}
              onClick={() => run('extract', async () => { await sendJson('/api/voice/extract', 'POST', { posts, saveExamples: true }); return 'Style guide extracted and saved.'; })}
            >
              {busy === 'extract' ? 'Extracting…' : 'Extract style guide (one Sonnet call)'}
            </button>
            <button className="btn" disabled={busy !== null} onClick={() => run('save-posts', async () => { await sendJson('/api/voice', 'PUT', { examplePosts: posts }); return 'Example posts saved.'; })}>
              Save posts only
            </button>
          </div>
          {top.length > 0 && (
            <p className="text-xs text-muted">
              {top.length} of your own published posts with engagement data are currently used as few-shot examples ahead of these.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="panel space-y-2">
            <label className="label" htmlFor="audience">
              Audience description (the writer calibrates how much to assume)
            </label>
            <textarea id="audience" className="input min-h-[70px]" value={audience} onChange={(e) => setAudience(e.target.value)} />
          </div>
          <div className="panel space-y-2">
            <label className="label" htmlFor="guide">
              Style guide (editable)
            </label>
            <textarea id="guide" className="input min-h-[360px] font-sans" value={styleGuide} onChange={(e) => setStyleGuide(e.target.value)} placeholder="Extract from your posts, or write it by hand." />
            <button
              className="btn btn-primary"
              disabled={busy !== null || (styleGuide === profile?.styleGuide && audience === profile?.audienceDescription)}
              onClick={() => run('save', async () => { await sendJson('/api/voice', 'PUT', { styleGuide, audienceDescription: audience }); return 'Saved.'; })}
            >
              Save style guide & audience
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
