import { pipelineData } from '@/lib/admin/data';
import { LocalTime } from '../../ui';
import { duration, Empty, num, PageHead, Panel, Pill, Stat } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pipeline' };

const STATUS_LABEL: Record<string, string> = { backlog: 'To write', selected: 'In flight', published: 'Published', retired: 'Removed' };

export default async function AdminPipeline() {
  const d = await pipelineData();
  const r = d.researcher;
  return (
    <>
      <PageHead title="Pipeline" sub="Subtopics on their way to becoming posts: research, writing, and anything stuck between." />

      <div className="adm-stats">
        {['backlog', 'selected', 'published', 'retired'].map((s) => (
          <Stat key={s} label={STATUS_LABEL[s]} value={num(d.byStatus[s] ?? 0)} />
        ))}
        <Stat label="Researched, ready to write" value={num(d.research.ready)} tone="up" />
      </div>

      <div className="adm-stats">
        <Stat label="Research runs, 30 days" value={num(r.runs)} hint={r.failures ? `${r.failures} failed` : 'None failed'} tone={r.failures ? 'attention' : undefined} />
        <Stat label="Median research time" value={duration(r.medianMs)} />
        <Stat label="Slowest 10%" value={duration(r.p90Ms)} hint={`Longest ${duration(r.maxMs)}`} tone={r.p90Ms > 240_000 ? 'down' : r.p90Ms > 180_000 ? 'attention' : undefined} />
        <Stat label="Runs over 4 minutes" value={num(r.overFourMinutes)} hint="Close to the 5 minute limit" tone={r.overFourMinutes ? 'attention' : undefined} />
      </div>

      <div className="adm-grid-2">
        <Panel title="Research running now">
          {d.research.running.length === 0 ? (
            <Empty>Nothing researching right now.</Empty>
          ) : (
            <ul className="adm-list">
              {d.research.running.map((c) => (
                <li key={String(c._id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{c.title}</span>
                    <span className="block text-[12.5px] text-muted">
                      {c.topic ?? 'No topic'} · started <LocalTime value={c.researchState.startedAt} relative />
                    </span>
                  </span>
                  <Pill tone="primary">{c.researchState.source === 'pool' ? 'background' : 'on request'}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Being written now">
          {d.writing.length === 0 ? (
            <Empty>No Write in progress.</Empty>
          ) : (
            <ul className="adm-list">
              {d.writing.map((c) => (
                <li key={String(c._id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{c.title}</span>
                    <span className="block text-[12.5px] text-muted">{c.topic ?? 'No topic'}</span>
                  </span>
                  <span className="adm-list-value text-[12.5px] text-muted">
                    lease ends <LocalTime value={c.writeLockedUntil} relative />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Research that failed" sub="Retryable with Write a post on the topic page">
        {d.research.failed.length + d.research.abandoned.length === 0 ? (
          <Empty>No failed or abandoned research.</Empty>
        ) : (
          <ul className="adm-list">
            {d.research.abandoned.map((c) => (
              <li key={String(c._id)} className="items-start">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.title}</span>
                  <span className="adm-error">The run stopped without finishing (its lease expired). It will be retried.</span>
                </span>
                <Pill tone="attention">abandoned</Pill>
              </li>
            ))}
            {d.research.failed.map((c) => (
              <li key={String(c._id)} className="items-start">
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.title}</span>
                  <span className="adm-error">{c.researchState.error ?? 'No message'}</span>
                </span>
                <Pill tone="down">failed</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Stuck subtopics" sub="In flight for over 20 minutes with no live draft">
        {d.stuck.length === 0 ? (
          <Empty>Nothing stuck.</Empty>
        ) : (
          <ul className="adm-list">
            {d.stuck.map((c) => (
              <li key={String(c._id)}>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{c.title}</span>
                  <span className="block text-[12.5px] text-muted">
                    {c.topic ?? 'No topic'} · claimed <LocalTime value={c.coveredAt} relative />
                  </span>
                </span>
                <Pill tone="down">stuck</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
