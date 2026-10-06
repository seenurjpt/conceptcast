'use client';

import { useRouter } from 'next/navigation';

/** Back where they came from, or home when there is no history (a fresh tab). */
export function BackButton({ className = 'btn btn-quiet' }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/dashboard'))}
    >
      Go back
    </button>
  );
}
