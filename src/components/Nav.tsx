'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/review', label: 'Review queue' },
  { href: '/backlog', label: 'Backlog' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/voice', label: 'Voice' },
  { href: '/analytics', label: 'Analytics' },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-border bg-panel">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/review" className="font-semibold tracking-tight">
          conceptcast
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-2.5 py-1 ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:text-foreground'}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
