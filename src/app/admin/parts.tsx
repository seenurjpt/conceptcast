/**
 * Server-rendered building blocks for the admin pages: stat tiles, panels,
 * tables, status pills and number formatting.
 */

export const money = (n: number) =>
  n >= 100 ? `$${n.toFixed(0)}` : n >= 1 ? `$${n.toFixed(2)}` : n > 0 ? `$${n.toFixed(3)}` : '$0';
export const num = (n: number) => n.toLocaleString('en-US');
export const pct = (n: number | null) => (n === null ? '-' : `${Math.round(n * 100)}%`);
export function duration(ms: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} m ${s % 60} s`;
}
/** A short, readable browser and OS from a user agent. */
export function agent(ua: string): string {
  if (!ua) return 'Unknown';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl|node|python/i.test(ua) ? 'Script' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
export const tokens =(n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div className="min-w-0">
        <h1 className="adm-h1">{title}</h1>
        {sub && <p className="adm-sub">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'up' | 'down' | 'attention' }) {
  return (
    <div className="adm-stat">
      <p className="adm-stat-label">{label}</p>
      <p className={`adm-stat-value${tone ? ` is-${tone}` : ''}`}>{value}</p>
      {hint && <p className="adm-stat-hint">{hint}</p>}
    </div>
  );
}

export function Panel({ title, sub, children, className = '' }: { title: string; sub?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`adm-panel ${className}`}>
      <header className="adm-panel-head">
        <h2>{title}</h2>
        {sub && <span className="adm-panel-sub">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

export function Pill({ tone, children }: { tone: 'up' | 'down' | 'attention' | 'primary' | 'quiet'; children: React.ReactNode }) {
  return <span className={`adm-pill is-${tone}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="adm-empty">{children}</p>;
}

/** Horizontal bars for a breakdown: label, bar sized to the largest, value. */
export function Bars({ rows }: { rows: { label: string; value: number; display: string; extra?: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  if (!rows.length) return <Empty>Nothing recorded in this period.</Empty>;
  return (
    <ul className="adm-bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="adm-bars-label" title={r.label}>
            {r.label}
          </span>
          <span className="adm-bars-track" aria-hidden>
            <span className="adm-bars-fill" style={{ width: `${max ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </span>
          <span className="adm-bars-value">
            {r.display}
            {r.extra && <span className="adm-bars-extra"> {r.extra}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
