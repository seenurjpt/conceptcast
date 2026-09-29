'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getJson } from '@/lib/ui';

/**
 * Nothing generates without a key on the account, so a missing key is the
 * first thing a new user has to fix. Shown on every dashboard page except
 * Settings itself, where the form is the message.
 */
export function ApiKeyBanner() {
  const path = usePathname();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<{ active: string[] }>('/api/user/keys')
      .then((r) => {
        if (!cancelled) setMissing(r.active.length === 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!missing || path.startsWith('/settings')) return null;

  return (
    <div className="border-b border-hairline bg-[color-mix(in_srgb,var(--attention)_10%,var(--canvas))]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        <span className="t-body-sm min-w-0 text-body">
          No AI API key on your account yet. Add an Anthropic, OpenAI or Gemini key to research and write posts.
        </span>
        <Link className="btn btn-sm btn-primary shrink-0" href="/settings">
          Add a key
        </Link>
      </div>
    </div>
  );
}
