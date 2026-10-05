'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import SlideCommit from './SlideCommit';

/**
 * The app's slide-to-publish control: React Bits' SlideCommit in the app's
 * colours, filling the width its container gives it.
 *
 * SlideCommit takes concrete hex colours (it picks the arrow colour from the
 * handle's), so the theme's values are mirrored here and swapped when the
 * theme toggles. The handle is the primary blue, the track the theme's strong
 * surface, success and danger the app's up and down colours.
 */

const COLORS = {
  light: { track: '#eef0f3', handle: '#0052ff', success: '#027a49', danger: '#cf202f' },
  dark: { track: '#1f2228', handle: '#4d8bff', success: '#05b169', danger: '#ff6b6b' },
} as const;

function useTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export function PublishSlider({
  label,
  doneLabel,
  errorLabel,
  onConfirm,
  onDone,
  onError,
  disabled = false,
  height = 52,
}: {
  label: ReactNode;
  doneLabel: ReactNode;
  errorLabel: ReactNode;
  onConfirm: () => Promise<unknown>;
  onDone?: () => void;
  onError?: (reason: unknown) => void;
  disabled?: boolean;
  height?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const c = COLORS[useTheme()];

  // Fill the container; measured first so the control never forces its own width.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="w-full min-w-0" style={{ height }}>
      {width !== null && width > 0 && (
        <SlideCommit
          label={label}
          doneLabel={doneLabel}
          errorLabel={errorLabel}
          onConfirm={onConfirm}
          onDone={onDone}
          onError={onError}
          disabled={disabled}
          trackColor={c.track}
          handleColor={c.handle}
          successColor={c.success}
          dangerColor={c.danger}
          labelColor="var(--muted)"
          width={width}
          height={height}
          radius={height / 2}
          holdMs={1600}
        />
      )}
    </div>
  );
}
