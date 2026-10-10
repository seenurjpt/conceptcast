import Link from 'next/link';
import { AreaChart } from '@/components/AreaChart';
import { overviewData, usersData } from '@/lib/admin/data';
import { Empty, money, num, PageHead, Panel, pct, Stat } from '../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Overview' };

export default async function AdminOverview() {
  const [d, u] = await Promise.all([overviewData(), usersData()]);
  const k = d.kpis;
  return (
    <>
      <PageHead title="Overview" sub="How conceptcast is doing: output, quality, spend and anything that needs a look." />

      <div className="adm-stats is-six">
        <Stat label="Signed in now" value={num(u.signedIn)} hint={u.activeNow ? `${num(u.activeNow)} active now` : 'None active now'} tone={u.activeNow ? 'up' : undefined} />
        <Stat label="Drafts, last 30 days" value={num(k.drafts30)} hint={`${num(k.draftsTotal)} all time`} />
        <Stat label="Critic pass rate" value={pct(k.passRate)} hint="Final drafts, last 30 days" tone={k.passRate !== null && k.passRate < 0.5 ? 'attention' : undefined} />
        <Stat label="Published" value={num(k.published)} hint={k.scheduled ? `${k.scheduled} scheduled` : 'None scheduled'} />
        <Stat label="AI spend this month" value={money(k.spendMonth)} hint={`${num(k.callsMonth)} calls`} />
        <Stat
          label="AI call failures"
          value={pct(k.failureRate30)}
          hint="Last 30 days"
          tone={k.failureRate30 !== null && k.failureRate30 > 0.1 ? 'down' : undefined}
        />
      </div>

      <Panel title="Needs attention" sub={d.attention.length ? `${d.attention.length} item${d.attention.length === 1 ? '' : 's'}` : undefined}>
        {d.attention.length === 0 ? (
          <Empty>All clear: nothing failing, stuck or expiring.</Empty>
        ) : (
          <ul className="adm-attention">
            {d.attention.map((a) => (
              <li key={a.title}>
                <Link href={a.href} className={`adm-attention-item is-${a.tone}`}>
                  <span className="adm-attention-dot" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{a.title}</span>
                    <span className="block text-[13px] text-muted">{a.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="adm-grid-2">
        <Panel title="AI spend per day" sub="Last 30 days">
          <AreaChart data={d.spendDaily} unit={['dollar', 'dollars']} caption="AI spend per day, last 30 days" />
        </Panel>
        <Panel title="Drafts written per day" sub="Last 30 days">
          <AreaChart data={d.draftsDaily} unit={['draft', 'drafts']} caption="Drafts written per day, last 30 days" />
        </Panel>
      </div>
    </>
  );
}
