import type { Metadata } from 'next';
import { WelcomeLoader } from './WelcomeLoader';

export const metadata: Metadata = {
  title: 'Signing in · conceptcast',
  robots: { index: false, follow: false },
};

/**
 * Where the LinkedIn callback sends a fresh sign-in: the branded loader, then
 * on to `next`. The login gate in middleware keeps it signed-in only, and
 * nothing else links here, so it shows exactly once per sign-in.
 *
 * `next` is only ever a same-site path; anything else falls back to Topics.
 */
function safeNext(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.startsWith('/welcome')) return '/backlog';
  return v;
}

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  return <WelcomeLoader next={safeNext(next)} />;
}
