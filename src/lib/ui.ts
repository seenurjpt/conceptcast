/** Client-side helpers for the dashboard screens. */

/** A 401 means the session lapsed; send the user to the front door, keeping their place. */
function handleUnauthorized(): never {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?next=${next}`;
  }
  throw new Error('Signed out. Redirecting to sign in…');
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) handleUnauthorized();
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `${res.status} ${res.statusText}`);
  return json;
}

export async function sendJson<T>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) handleUnauthorized();
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `${res.status} ${res.statusText}`);
  return json;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtDay(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** `datetime-local` wants local time without zone. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The LinkedIn fold: roughly the first 210 characters. */
export const LINKEDIN_FOLD = 210;

/** "3 days ago" / "in 2 hours" — kinder than a timestamp for recency. */
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['week', 604_800_000],
    ['month', 2_629_800_000],
    ['year', 31_557_600_000],
  ];
  if (abs < 60_000) return 'just now';
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const u of units) if (abs >= u[1]) chosen = u;
  return rtf.format(Math.round(diff / chosen[1]), chosen[0]);
}
