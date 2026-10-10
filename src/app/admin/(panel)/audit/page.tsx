import { auditData } from '@/lib/admin/data';
import { LOCKOUT_MINUTES, MAX_FAILURES } from '@/lib/admin/audit';
import { LocalTime } from '../../ui';
import { agent, Empty, PageHead, Panel, Pill } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log' };

const KIND = {
  login_ok: { label: 'Signed in', tone: 'up' },
  login_fail: { label: 'Failed sign in', tone: 'attention' },
  locked_out: { label: 'Locked out', tone: 'down' },
  logout: { label: 'Signed out', tone: 'quiet' },
} as const;

export default async function AdminAudit() {
  const events = await auditData();
  return (
    <>
      <PageHead
        title="Audit log"
        sub={`Admin sign-ins and sign-outs, kept 90 days. ${MAX_FAILURES} failures in a row from one source lock it out for ${LOCKOUT_MINUTES} minutes. Sources are shown as a hash; IP addresses are never stored.`}
      />
      <Panel title="Recent events" sub={`${events.length} shown`}>
        {events.length === 0 ? (
          <Empty>No admin activity yet.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Event</th>
                  <th scope="col">Email entered</th>
                  <th scope="col">Source</th>
                  <th scope="col">Browser</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={String(e._id)}>
                    <td className="whitespace-nowrap text-muted">
                      <LocalTime value={e.at} />
                    </td>
                    <td>
                      <Pill tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Pill>
                    </td>
                    <td className="max-w-[220px] truncate">{e.email || '-'}</td>
                    <td className="font-mono text-[12.5px] text-muted">{e.source.slice(0, 8)}</td>
                    <td className="text-muted">{agent(e.agent)}</td>
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
