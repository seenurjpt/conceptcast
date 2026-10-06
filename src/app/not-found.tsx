import type { Metadata } from 'next';
import Link from 'next/link';
import { StatusScreen } from '@/components/StatusScreen';
import { BackButton } from '@/components/StatusActions';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * Any URL that matches no page. "Dashboard" is safe for everyone: signed
 * out, the login gate catches it and returns them there after sign-in.
 */
export default function NotFound() {
  return (
    <StatusScreen
      fullscreen
      variant="lost"
      code="404"
      title="This page wandered off"
      actions={
        <>
          <Link href="/dashboard" className="btn btn-primary">
            Go to dashboard
          </Link>
          <BackButton />
        </>
      }
      footnote={
        <>
          Looking for something? Press <kbd>Ctrl</kbd> <kbd>K</kbd> in the app to search your topics, drafts and posts.
        </>
      }
    >
      The link may be old or mistyped, or the page has moved. Nothing you wrote is affected.
    </StatusScreen>
  );
}
