'use client';

import { useEffect, useState } from 'react';
import { getJson } from '@/lib/ui';

interface Status {
  state: 'missing' | 'ok' | 'refresh-due' | 'expired' | 'refresh-expired';
  memberName: string | null;
  expiresAt: string | null;
  configured: boolean;
}

/** Re-auth banner (spec §7): shows only when publishing would fail. */
export function LinkedInBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    getJson<Status>('/api/auth/linkedin/status').then(setStatus).catch(() => setStatus(null));
  }, []);
  if (!status || status.state === 'ok' || status.state === 'refresh-due') return null;

  const message =
    status.state === 'missing'
      ? status.configured
        ? 'LinkedIn is not connected. Approved posts will fail to publish until you connect.'
        : 'LinkedIn credentials are not configured (LINKEDIN_CLIENT_ID / SECRET / REDIRECT_URI). Publishing is disabled.'
      : status.state === 'refresh-expired'
        ? 'The LinkedIn refresh token has expired. Re-authorise to keep publishing.'
        : 'The LinkedIn access token has expired. Re-authorise (or wait for the daily refresh job).';

  return (
    <div className="border-b border-warn/40 bg-warn/10 text-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span>{message}</span>
        {status.configured && (
          <a className="btn" href="/api/auth/linkedin">
            Connect LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}
