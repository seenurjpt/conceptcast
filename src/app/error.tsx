'use client';

import { ErrorScreen } from '@/components/ErrorScreen';

/** Errors outside the signed-in app (landing, login, welcome): the whole screen. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} fullscreen />;
}
