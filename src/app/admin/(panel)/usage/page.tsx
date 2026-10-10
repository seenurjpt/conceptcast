import Link from 'next/link';
import { AreaChart } from '@/components/AreaChart';
import { usageData, USAGE_RANGES, type UsageGroup } from '@/lib/admin/data';
import { LocalTime } from '../../ui';
import { Bars, duration, Empty, money, num, PageHead, Panel, Stat, tokens } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI usage' };

function GroupTable({ rows }: { rows: UsageGroup[] }) {
  if (!rows.length) return <Empty>No calls in this period.</Empty>;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col" className="num">Calls</th>
            <th scope="col" className="num">Failed</th>
            <th scope="col" className="num">Spend</th>
            <th scope="col" className="num">Avg time</th>
            <th scope="col" className="num">Tokens in / out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="font-medium text-ink">{r.key}</td>
              <td className="num">{num(r.calls)}</td>
              <td className={`num${r.failures ? ' text-down' : ''}`}>{num(r.failures)}</td>
              <td className="num">{money(r.costUsd)}</td>
              <td className="num">{duration(r.avgLatencyMs)}</td>
              <td className="num">
                {tokens(r.inputTokens)} / {tokens(r.outputTokens)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminUsage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const days = (USAGE_RANGES as readonly number[]).includes(Number(raw)) ? Number(raw) : 30;
  const d = await usageData(days);
  const t = d.totals;
  return (
    <>
      <PageHead title="AI usage" sub="Every model call the app made: what it cost, how long it took, and what failed.">
        <nav className="adm-range" aria-label="Period">
          {USAGE_RANGES.map((r) => (
            <Link key={r} href={`/admin/usage?days=${r}`} aria-current={r === days ? 'true' : undefined} className={r === days ? 'is-active' : ''}>
              {r} days
            </Link>
          ))}
        </nav>
      </PageHead>

      <div className="adm-stats">
        <Stat label="Spend" value={money(t.costUsd)} hint={`Last ${days} days`} />
        <Stat label="Calls" value={num(t.calls)} hint={t.failures ? `${num(t.failures)} failed` : 'None failed'} tone={t.failures ? 'attention' : undefined} />
        <Stat label="Average call time" value={duration(t.avgLatencyMs)} hint="Successful calls" />
        <Stat label="Tokens" value={`${tokens(t.inputTokens)} / ${tokens(t.outputTokens)}`} hint="In / out" />
      </div>

      <Panel title="Spend per day" sub={`Last ${days} days`}>
        <AreaChart data={d.spendDaily} unit={['dollar', 'dollars']} caption={`AI spend per day, last ${days} days`} />
      </Panel>

      <div className="adm-grid-2">
        <Panel title="Spend by pipeline stage">
          <Bars rows={d.byStage.map((g) => ({ label: g.key, value: g.costUsd, display: money(g.costUsd), extra: `${num(g.calls)} calls` }))} />
        </Panel>
        <Panel title="Spend by provider">
          <Bars rows={d.byProvider.map((g) => ({ label: g.key, value: g.costUsd, display: money(g.costUsd), extra: `${num(g.calls)} calls` }))} />
        </Panel>
      </div>

      <Panel title="By stage" sub="Retries count with their stage">
        <GroupTable rows={d.byStage} />
      </Panel>
      <Panel title="By model">
        <GroupTable rows={d.byModel} />
      </Panel>

      <div className="adm-grid-2">
        <Panel title="Slowest calls" sub="Research near 4 minutes risks the 5 minute limit">
          {d.slowest.length === 0 ? (
            <Empty>No calls in this period.</Empty>
          ) : (
            <ul className="adm-list">
              {d.slowest.map((c, i) => (
                <li key={i}>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{c.stage}</span>
                    <span className="block text-[12.5px] text-muted">
                      {c.provider} · {c.model} · <LocalTime value={c.at} relative />
                    </span>
                  </span>
                  <span className={`adm-list-value${c.latencyMs > 240_000 ? ' text-down' : c.latencyMs > 120_000 ? ' text-attention' : ''}`}>{duration(c.latencyMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recent failures" sub={d.failures.length ? `${d.failures.length} shown` : undefined}>
          {d.failures.length === 0 ? (
            <Empty>No failed calls in this period.</Empty>
          ) : (
            <ul className="adm-list">
              {d.failures.map((c, i) => (
                <li key={i} className="items-start">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">
                      {c.stage} <span className="font-normal text-muted">· {c.provider}</span>
                    </span>
                    <span className="adm-error">{c.error ?? 'No message'}</span>
                  </span>
                  <span className="adm-list-value text-[12.5px] text-muted">
                    <LocalTime value={c.at} relative />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
