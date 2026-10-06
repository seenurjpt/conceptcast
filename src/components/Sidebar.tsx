'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import {
  Analytics01Icon,
  ArrowRight01Icon,
  Bookmark02Icon,
  DashboardSquare01Icon,
  FileEditIcon,
  Layers01Icon,
  Mic01Icon,
  PencilEdit02Icon,
  SentIcon,
  Settings01Icon,
  SidebarLeftIcon,
} from '@hugeicons/core-free-icons';
import { LogoMark } from './Logo';
import { openComposer } from './Composer';

type Item = { href: string; label: string; icon: IconSvgElement };

/** Ordered by the actual flow: pick a topic, review the draft, see what shipped. */
export const NAV_GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Create',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: DashboardSquare01Icon },
      { href: '/backlog', label: 'Topics', icon: Layers01Icon },
      { href: '/review', label: 'Drafts', icon: FileEditIcon },
      { href: '/calendar', label: 'Published', icon: SentIcon },
    ],
  },
  {
    title: 'Improve',
    items: [
      { href: '/voice', label: 'Voice', icon: Mic01Icon },
      { href: '/admin/exemplars', label: 'Exemplars', icon: Bookmark02Icon },
      { href: '/analytics', label: 'Analytics', icon: Analytics01Icon },
    ],
  },
];

export const SETTINGS: Item = { href: '/settings', label: 'Settings', icon: Settings01Icon };

const isActive = (path: string, href: string) => path === href || path.startsWith(href + '/');

type Tip = { label: string; top: number; left: number } | null;

/**
 * The nav itself, shared by the desktop rail and the phone drawer. `id`
 * keeps the two active pills from animating into each other.
 */
export function SidebarNav({
  id,
  collapsed = false,
  onTip,
  onCompose,
}: {
  id: string;
  collapsed?: boolean;
  onTip?: (tip: Tip) => void;
  /** Called after the composer opens, so the phone drawer can close behind it. */
  onCompose?: () => void;
}) {
  const path = usePathname();

  // The collapsed rail names each icon in a tooltip. It is fixed to the
  // viewport so the nav's scroll container cannot clip it.
  const tipProps = (label: string) =>
    collapsed && onTip
      ? {
          onPointerEnter: (e: React.PointerEvent<HTMLElement>) => onTip(place(label, e.currentTarget)),
          onPointerLeave: () => onTip(null),
          onFocus: (e: React.FocusEvent<HTMLElement>) => onTip(place(label, e.currentTarget)),
          onBlur: () => onTip(null),
        }
      : {};

  const link = (item: Item) => {
    const active = isActive(path, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? 'page' : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={`side-link ${active ? 'is-active' : ''}`}
          {...tipProps(item.label)}
        >
          {active && (
            <motion.span
              layoutId={`${id}-pill`}
              className="side-pill"
              transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              aria-hidden
            />
          )}
          <span className="side-icon">
            <HugeiconsIcon icon={item.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
          </span>
          <span className="side-label">{item.label}</span>
          {active && (
            <span className="side-chevron" aria-hidden>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="side-body">
      <button
        type="button"
        className="side-cta"
        aria-label={collapsed ? 'Write a post' : undefined}
        aria-haspopup="dialog"
        onClick={() => {
          onTip?.(null);
          openComposer();
          onCompose?.();
        }}
        {...tipProps('Write a post')}
      >
        <span className="side-icon">
          <HugeiconsIcon icon={PencilEdit02Icon} size={18} strokeWidth={1.9} />
        </span>
        <span className="side-label">Write a post</span>
      </button>

      <nav aria-label="Main" className="side-nav scroll-slim">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="side-group">
            <p className="side-group-title" aria-hidden={collapsed}>
              <span>{g.title}</span>
            </p>
            <ul>{g.items.map(link)}</ul>
          </div>
        ))}
      </nav>

      <ul className="side-foot">{link(SETTINGS)}</ul>
    </div>
  );
}

function place(label: string, el: HTMLElement): Tip {
  const r = el.getBoundingClientRect();
  return { label, top: r.top + r.height / 2, left: r.right + 10 };
}

/**
 * The desktop sidebar (lg and up). Collapsing is remembered per browser; the
 * root layout's inline script applies the saved state before paint, so the
 * CSS can size the rail from `data-sidebar` with no flash of the wrong width.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebar === 'collapsed');
  }, []);

  const toggle = useCallback(() => {
    setTip(null);
    setCollapsed((was) => {
      const next = !was;
      document.documentElement.dataset.sidebar = next ? 'collapsed' : 'expanded';
      try {
        localStorage.setItem('sidebar', next ? 'collapsed' : 'expanded');
      } catch {
        // Private mode: the choice lasts for this page only.
      }
      return next;
    });
  }, []);

  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <div className="side-head">
        <Link href="/dashboard" className="side-brand" aria-label="conceptcast home" tabIndex={collapsed ? -1 : undefined}>
          <LogoMark className="h-6 w-6 shrink-0 text-primary" />
          <span className="side-label t-title-sm tracking-[-0.02em]">conceptcast</span>
        </Link>
        <button
          type="button"
          className="side-toggle"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <HugeiconsIcon icon={SidebarLeftIcon} size={20} strokeWidth={1.7} />
        </button>
      </div>

      <SidebarNav id="rail" collapsed={collapsed} onTip={setTip} />

      {collapsed && tip && (
        <span role="tooltip" className="side-tip" style={{ top: tip.top, left: tip.left }}>
          {tip.label}
        </span>
      )}
    </aside>
  );
}
