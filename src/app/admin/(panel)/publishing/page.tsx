import { publishingData } from '@/lib/admin/data';
import { LocalTime } from '../../ui';
import { Empty, num, PageHead, Panel, Pill, Stat } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Publishing' };

const STATE: Record<string, { label: string; tone: 'up' | 'down' | 'attention' }> = {
  ok: { label: 'Connected', tone: 'up' },
  'refresh-due': { label: 'Renews soon', tone: 'attention' },
  expired: { label: 'Expired, refreshable', tone: 'attention' },
  'refresh-expired': { label: 'Expired', tone: 'down' },
  missing: { label: 'Not connected', tone: 'down' },
};

export default async function AdminPublishing() {
  const d = await publishingData();
  const li = d.linkedin;
  const st = STATE[li.state] ?? { label: li.state, tone: 'attention' as const };
  return (
    <>
      <PageHead title="Publishing" sub="The LinkedIn connection, the schedule, and every post that went out or failed to." />

      <Panel title="LinkedIn connection">
        <dl className="adm-dl">
          <div>
            <dt>Status</dt>
            <dd>
              <Pill tone={st.tone}>{st.label}</Pill>
            </dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{li.member ?? '-'}</dd>
          </div>
          <div>
            <dt>Access expires</dt>
            <dd>
              <LocalTime value={li.expiresAt} />
            </dd>
          </div>
          <div>
            <dt>Renewal expires</dt>
            <dd>{li.refreshExpiresAt ? <LocalTime value={li.refreshExpiresAt} /> : 'Not renewable'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt>Permissions</dt>
            <dd className="flex flex-wrap gap-1.5">{li.scopes.length ? li.scopes.map((s) => <Pill key={s} tone="quiet">{s}</Pill>) : '-'}</dd>
          </div>
        </dl>
      </Panel>

      <div className="adm-stats">
        <Stat label="Published" value={num(d.byStatus.published ?? 0)} tone="up" />
        <Stat label="Scheduled" value={num(d.byStatus.scheduled ?? 0)} />
        <Stat label="Publishing now" value={num(d.byStatus.publishing ?? 0)} />
        <Stat label="Failed" value={num(d.byStatus.failed ?? 0)} tone={d.byStatus.failed ? 'down' : undefined} />
      </div>

      <Panel title="Failed" sub="Did not reach LinkedIn">
        {d.failed.length === 0 ? (
          <Empty>No failed publishes.</Empty>
        ) : (
          <ul className="adm-list">
            {d.failed.map((p) => (
              <li key={p.id} className="items-start">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{p.title}</span>
                  <span className="adm-error">{p.error ?? 'No message'}</span>
                </span>
                <span className="adm-list-value text-[12.5px] text-muted">
                  {p.attempts} attempt{p.attempts === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="adm-grid-2">
        <Panel title="Scheduled">
          {d.upcoming.length === 0 ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <ul className="adm-list">
              {d.upcoming.map((p) => (
                <li key={p.id}>
                  <span className="min-w-0 truncate font-medium text-ink">{p.title}</span>
                  <span className="adm-list-value text-[12.5px] text-muted">
                    <LocalTime value={p.scheduledFor} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Recently published">
          {d.recent.length === 0 ? (
            <Empty>Nothing published yet.</Empty>
          ) : (
            <ul className="adm-list">
              {d.recent.map((p) => (
                <li key={p.id}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{p.title}</span>
                    <span className="block text-[12.5px] text-muted">
                      <LocalTime value={p.publishedAt} relative />
                      {p.metrics ? ` · ${p.metrics.reactions} reactions, ${p.metrics.comments} comments` : ''}
                    </span>
                  </span>
                  {p.postUrn && (
                    <a className="adm-link-out" href={`https://www.linkedin.com/feed/update/${p.postUrn}`} target="_blank" rel="noreferrer">
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
