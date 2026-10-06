'use client';

import { ErrorScreen } from '@/components/ErrorScreen';

/** Errors in an app page: shown in the content area, the sidebar and top bar still working. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
