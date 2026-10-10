'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  AiChipIcon,
  DashboardSquare01Icon,
  LibraryIcon,
  Logout01Icon,
  Moon02Icon,
  SentIcon,
  ServerStack01Icon,
  Shield01Icon,
  Sun03Icon,
  UserGroupIcon,
  WorkflowSquare01Icon,
} from '@hugeicons/core-free-icons';
import { LogoMark } from '@/components/Logo';

const NAV: { href: string; label: string; icon: IconSvgElement }[] = [
  { href: '/admin', label: 'Overview', icon: DashboardSquare01Icon },
  { href: '/admin/users', label: 'Users', icon: UserGroupIcon },
  { href: '/admin/usage', label: 'AI usage', icon: AiChipIcon },
  { href: '/admin/pipeline', label: 'Pipeline', icon: WorkflowSquare01Icon },
  { href: '/admin/publishing', label: 'Publishing', icon: SentIcon },
  { href: '/admin/content', label: 'Content', icon: LibraryIcon },
  { href: '/admin/system', label: 'System', icon: ServerStack01Icon },
  { href: '/admin/audit', label: 'Audit log', icon: Shield01Icon },
];

const isActive = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));

/**
 * The admin panel's frame: its own sidebar (a tab strip on narrow screens),
 * a top bar marked "Admin" in the panel's violet so it is never mistaken for
 * the app, the signed-in admin's email, a theme switch and sign out.
 */
export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  };

  return (
    <div className="adm">
      <aside className="adm-side" aria-label="Admin">
        <Link href="/admin" className="adm-brand">
          <LogoMark className="h-6 w-6 text-primary" />
          <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
          <span className="adm-badge">Admin</span>
        </Link>
        <nav className="adm-nav scroll-slim" aria-label="Admin sections">
          {NAV.map((n) => {
            const on = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className={`adm-link${on ? ' is-active' : ''}`}>
                <HugeiconsIcon icon={n.icon} size={18} strokeWidth={on ? 1.9 : 1.6} />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <span className="adm-top-title">
            <span className="adm-badge adm-badge-mobile">Admin</span>
            {NAV.find((n) => isActive(path, n.href))?.label ?? 'Admin'}
          </span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="adm-email" title={email}>
              {email}
            </span>
            <ThemeSwitch />
            <button type="button" className="adm-icon-btn" onClick={() => void signOut()} disabled={signingOut} aria-label="Sign out of admin" title="Sign out">
              <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} />
            </button>
          </div>
        </header>
        <main className="adm-content">{children}</main>
      </div>
    </div>
  );
}

function ThemeSwitch() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.dataset.theme === 'dark'), []);
  if (dark === null) return <span className="h-9 w-9" />;
  return (
    <button
      type="button"
      className="adm-icon-btn"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => {
        const next = dark ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem('theme', next);
        } catch {
          // Applies for this visit only.
        }
        setDark(!dark);
      }}
    >
      <HugeiconsIcon icon={dark ? Moon02Icon : Sun03Icon} size={18} strokeWidth={1.8} />
    </button>
  );
}
