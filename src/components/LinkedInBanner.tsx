'use client';

import { useSession } from './SessionProvider';

/**
 * Only appears when publishing would actually fail *and* there is something to
 * publish about. A first-run user who has not signed in yet sees the sign-in
 * button in the nav instead — a banner for that is nagging, not informing.
 */
export function LinkedInBanner() {
  const { session, signInHref } = useSession();
  if (!session) return null;
  const { state, configured } = session;

  // Healthy, or signed out entirely (the login gate covers that): say nothing.
  if (state === 'ok' || state === 'refresh-due') return null;
  if (state === 'missing' && configured) return null;

  const message = !configured
    ? 'LinkedIn credentials are not configured, so publishing is off. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and LINKEDIN_REDIRECT_URI, then restart.'
    : state === 'refresh-expired'
      ? 'Your LinkedIn session has fully expired. Sign in again to keep publishing.'
      : 'Your LinkedIn access token has expired. Sign in again, or wait for the daily refresh job.';

  return (
    <div className="border-b border-hairline bg-[color-mix(in_srgb,var(--attention)_10%,var(--canvas))]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        <span className="t-body-sm min-w-0 text-body">{message}</span>
        {configured && (
          <a className="btn btn-sm shrink-0" href={signInHref()}>
            Sign in with LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}
