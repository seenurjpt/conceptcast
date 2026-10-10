import { contentData } from '@/lib/admin/data';
import { LocalTime } from '../../ui';
import { Empty, num, PageHead, Panel, Pill, Stat } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Content' };

export default async function AdminContent() {
  const d = await contentData();
  const drafts = d.draftsByStatus;
  const totalDrafts = Object.values(drafts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHead title="Content" sub="Topics, drafts and the voice the writer works from." />

      <div className="adm-stats">
        <Stat label="Topics" value={num(d.topics.filter((t) => !t.archived).length)} hint={`${d.topics.filter((t) => t.shared).length} shared`} />
        <Stat label="Drafts" value={num(totalDrafts)} hint={`${num(drafts.pending ?? 0)} waiting for review`} />
        <Stat label="Voice" value={d.voice.styleGuide ? 'Set up' : 'Not set'} hint={`${d.voice.samples} samples, ${d.voice.examplePosts} example posts`} tone={d.voice.styleGuide ? 'up' : 'attention'} />
        <Stat label="Exemplars" value={num(d.exemplars)} />
      </div>

      <div className="adm-grid-2">
        <Panel title="Drafts by status">
          <dl className="adm-dl">
            {['pending', 'approved', 'published', 'rejected'].map((s) => (
              <div key={s}>
                <dt className="capitalize">{s}</dt>
                <dd>{num(drafts[s] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Drafts by kind">
          <dl className="adm-dl">
            {[
              ['post', 'Researched posts'],
              ['custom', 'Written in the composer'],
              ['announcement', 'Topic announcements'],
            ].map(([k, label]) => (
              <div key={k}>
                <dt>{label}</dt>
                <dd>{num(d.draftsByKind[k] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Topics" sub={`${d.topics.length} in total`}>
        {d.topics.length === 0 ? (
          <Empty>No topics yet.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Topic</th>
                  <th scope="col" className="num">To write</th>
                  <th scope="col" className="num">In flight</th>
                  <th scope="col" className="num">Published</th>
                  <th scope="col" className="num">Removed</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {d.topics.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="font-medium text-ink">{t.title}</span>{' '}
                      {t.shared && <Pill tone="quiet">shared</Pill>} {t.archived && <Pill tone="quiet">archived</Pill>}
                    </td>
                    <td className="num">{num(t.subtopics.backlog ?? 0)}</td>
                    <td className="num">{num(t.subtopics.selected ?? 0)}</td>
                    <td className="num">{num(t.subtopics.published ?? 0)}</td>
                    <td className="num">{num(t.subtopics.retired ?? 0)}</td>
                    <td className="text-muted">
                      <LocalTime value={t.createdAt} relative />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
