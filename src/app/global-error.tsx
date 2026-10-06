'use client';

import './globals.css';
import { ErrorScreen } from '@/components/ErrorScreen';

/**
 * The last resort: the root layout itself failed, so this replaces it and
 * brings its own <html> and <body>. The theme script runs here too, so the
 * screen still matches the light or dark choice.
 */
const THEME =
  "try{var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong · conceptcast</title>
        <script dangerouslySetInnerHTML={{ __html: THEME }} />
      </head>
      <body className="font-sans">
        <ErrorScreen error={error} reset={reset} fullscreen />
      </body>
    </html>
  );
}
