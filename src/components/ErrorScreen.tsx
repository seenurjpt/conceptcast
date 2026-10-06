'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StatusScreen } from './StatusScreen';

/**
 * What a runtime error shows, wherever it happens. Inside the app it sits
 * under the sidebar and top bar, so the rest of the app is still a click
 * away; outside it (or when the app shell itself failed) it takes the
 * whole screen.
 *
 * The reference is Next's error digest: the same id is in the server log,
 * so a report can be matched to the real stack. Details are only shown
 * while developing; in production the message may hold internals.
 */
export function ErrorScreen({
  error,
  reset,
  fullscreen = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  fullscreen?: boolean;
}) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const dev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = () => {
    setRetrying(true);
    // A beat so the button visibly responds, then render the segment again.
    window.setTimeout(() => {
      reset();
      setRetrying(false);
    }, 250);
  };

  const ref = error.digest;
  const copyRef = async () => {
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The reference is still selectable on screen.
    }
  };

  return (
    <StatusScreen
      fullscreen={fullscreen}
      variant="broken"
      code="Something went wrong"
      title="That did not load"
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={retry} disabled={retrying}>
            {retrying ? 'Trying again…' : 'Try again'}
          </button>
          <Link href="/dashboard" className="btn btn-quiet">
            Go to dashboard
          </Link>
        </>
      }
      footnote={
        ref || dev ? (
          <>
            {ref && (
              <p>
                Reference{' '}
                <button type="button" className="status-ref" onClick={() => void copyRef()} title="Copy reference">
                  {ref}
                </button>
                {copied && <span className="ml-2 text-up">Copied</span>}
              </p>
            )}
            {dev && (
              <details className="status-details">
                <summary>Error details (only shown while developing)</summary>
                <pre>{`${error.name}: ${error.message}${error.stack ? `\n\n${error.stack}` : ''}`}</pre>
              </details>
            )}
          </>
        ) : undefined
      }
    >
      An unexpected error stopped this page. Your drafts and posts are saved; trying again usually fixes it. If it keeps
      happening, reload the page or come back in a minute.
    </StatusScreen>
  );
}
