'use client';

import { useEffect, useState } from 'react';

/**
 * Small pieces shared by the admin pages. Client components only where the
 * browser is needed: times are shown in the viewer's own time zone, not the
 * server's.
 */

export function LocalTime({ value, relative = false }: { value: string | Date | null | undefined; relative?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return setText('-');
    const d = new Date(value);
    if (!relative) {
      setText(d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
      return;
    }
    const s = Math.round((Date.now() - d.getTime()) / 1000);
    const abs = Math.abs(s);
    const unit = abs < 60 ? [s, 'second'] : abs < 3600 ? [Math.round(s / 60), 'minute'] : abs < 86400 ? [Math.round(s / 3600), 'hour'] : [Math.round(s / 86400), 'day'];
    setText(new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-(unit[0] as number), unit[1] as Intl.RelativeTimeFormatUnit));
  }, [value, relative]);
  const iso = value ? new Date(value).toISOString() : undefined;
  return (
    <time dateTime={iso} title={iso} suppressHydrationWarning>
      {text ?? ''}
    </time>
  );
}
