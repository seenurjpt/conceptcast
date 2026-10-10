import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { systemData } from '@/lib/admin/data';
import { num, PageHead, Panel, Pill } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System' };

export default async function AdminSystem() {
  const d = await systemData();
  const missingRequired = d.env.flatMap((g) => g.vars).filter((v) => v.required && !v.set);
  return (
    <>
      <PageHead title="System" sub="How this deployment is configured. Settings show as set or missing; their values are never shown." />

      <div className="adm-grid-2">
        <Panel title="Runtime">
          <dl className="adm-dl">
            <div>
              <dt>Environment</dt>
              <dd>{d.runtime.environment}</dd>
            </div>
            <div>
              <dt>Pipeline mode</dt>
              <dd>
                <Pill tone={d.pipelineMode === 'inngest' ? 'up' : 'quiet'}>{d.pipelineMode}</Pill>
              </dd>
            </div>
            <div>
              <dt>Node</dt>
              <dd>{d.runtime.node}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>{d.runtime.region ?? '-'}</dd>
            </div>
            <div>
              <dt>Commit</dt>
              <dd className="font-mono">{d.runtime.commit ?? '-'}</dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd>{d.runtime.database ?? '-'}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="AI providers" sub="With a key stored">
          <dl className="adm-dl">
            <div>
              <dt>Providers</dt>
              <dd className="flex flex-wrap gap-1.5">
                {d.providers.length ? d.providers.map((p) => <Pill key={p} tone="up">{p}</Pill>) : <Pill tone="down">None</Pill>}
              </dd>
            </div>
            <div>
              <dt>Accounts</dt>
              <dd>{num(d.users)}</dd>
            </div>
          </dl>
          <a className="adm-traffic" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">
            <span>
              <span className="block font-semibold text-ink">Site traffic</span>
              <span className="block text-[13px] text-muted">Visitors and page views are in Vercel Web Analytics.</span>
            </span>
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={18} strokeWidth={1.9} />
          </a>
        </Panel>
      </div>

      <Panel title="Settings" sub={missingRequired.length ? `${missingRequired.length} required missing` : 'All required settings present'}>
        <div className="adm-env">
          {d.env.map((g) => (
            <div key={g.group}>
              <p className="adm-env-group">{g.group}</p>
              <ul>
                {g.vars.map((v) => (
                  <li key={v.name}>
                    <span className="min-w-0">
                      <code>{v.name}</code>
                      <span className="block text-[12.5px] text-muted">{v.note}</span>
                    </span>
                    {v.set ? <Pill tone="up">set</Pill> : <Pill tone={v.required ? 'down' : 'quiet'}>{v.required ? 'missing' : 'not set'}</Pill>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Database" sub={`${d.collections.length} collections`}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th scope="col">Collection</th>
                <th scope="col" className="num">Documents (estimate)</th>
              </tr>
            </thead>
            <tbody>
              {d.collections.map((c) => (
                <tr key={c.name}>
                  <td className="font-mono text-[13px]">{c.name}</td>
                  <td className="num">{num(c.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
