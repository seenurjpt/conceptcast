/** Client-side helpers for the dashboard screens. */

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
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

export const TRACK_COLOURS: Record<string, string> = {
  'model-internals': 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  retrieval: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  agents: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  production: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  evals: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  adaptation: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
  security: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export function trackClass(track: string): string {
  return TRACK_COLOURS[track] ?? 'bg-stone-500/15';
}

/** The LinkedIn fold: roughly the first 210 characters. */
export const LINKEDIN_FOLD = 210;
