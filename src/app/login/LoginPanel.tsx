'use client';

import { useEffect, useState } from 'react';
import { getJson } from '@/lib/ui';

interface Status {
  configured: boolean;
  member: { name: string | null } | null;
}

const SAFE_NEXT = /^\/(review|backlog|calendar|voice|analytics)(\/|\?|$)/;

export function LoginPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState('/review');
  const [going, setGoing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('next');
    if (requested && SAFE_NEXT.test(requested)) setNext(requested);
    if (params.get('linkedin') === 'error') {
      setError(params.get('message') ?? 'Sign-in failed. Try again.');
    }
    // The status endpoint is public so this screen can explain a missing config.
    getJson<Status>('/api/auth/linkedin/status')
      .then(setStatus)
      .catch(() => setStatus({ configured: false, member: null }));
  }, []);

  const href = `/api/auth/linkedin?returnTo=${encodeURIComponent(next)}`;

  return (
    <div>
      <h2 className="text-[28px] leading-tight tracking-[-0.5px]">Sign in</h2>
      <p className="mt-1.5 text-[14px] leading-snug text-body">
        conceptcast publishes to your own feed, so it signs you in with the account it will post as.
      </p>

      {error && (
        <div className="notice notice-error mt-4" role="alert">
          {error}
        </div>
      )}

      <div className="mt-5">
        {status === null ? (
          <div className="h-11 animate-pulse rounded-[100px] bg-surface-strong" />
        ) : status.configured ? (
          <a
            href={href}
            onClick={() => setGoing(true)}
            className="btn btn-primary h-11 w-full text-[15px]"
            aria-busy={going}
          >
            {going ? (
              'Redirecting to LinkedIn…'
            ) : (
              <>
                <LinkedInMark />
                Continue with LinkedIn
              </>
            )}
          </a>
        ) : (
          <div className="notice notice-attention text-[13px] leading-snug">
            <div>
              <p className="font-semibold">LinkedIn is not configured yet.</p>
              <p className="mt-1">
                Set the three LINKEDIN_ variables in your environment file and restart. See the README.
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] leading-snug text-muted">
        Grants permission to post to your feed and read your name and photo. Nothing is posted without your approval
        on each draft.
      </p>
    </div>
  );
}

function LinkedInMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}
