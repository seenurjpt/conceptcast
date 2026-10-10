import { usersData } from '@/lib/admin/data';
import { ACTIVE_NOW_MINUTES, type AppSessionDoc } from '@/lib/appSessions';
import { LocalTime } from '../../ui';
import { agent, Empty, num, PageHead, Panel, Pill, Stat } from '../../parts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Users' };

function status(s: AppSessionDoc, now: number) {
  if (s.endedAt) return <Pill tone="quiet">Signed out</Pill>;
  if (now - new Date(s.lastSeenAt).getTime() < ACTIVE_NOW_MINUTES * 60_000) return <Pill tone="up">Active now</Pill>;
  return <Pill tone="primary">Signed in</Pill>;
}

export default async function AdminUsers() {
  const d = await usersData();
  const now = Date.now();
  return (
    <>
      <PageHead
        title="Users"
        sub={`Who is signed in to the app. Each browser that signs in with LinkedIn is one session; "active now" means it was used in the last ${ACTIVE_NOW_MINUTES} minutes. Sessions end on sign-out and expire 30 days after sign-in.`}
      />

      <div className="adm-stats">
        <Stat label="Signed in now" value={num(d.signedIn)} hint={`${num(d.accounts)} LinkedIn account${d.accounts === 1 ? '' : 's'}`} />
        <Stat label="Active now" value={num(d.activeNow)} hint={`Used in the last ${ACTIVE_NOW_MINUTES} minutes`} tone={d.activeNow ? 'up' : undefined} />
        <Stat label="Active today" value={num(d.activeToday)} hint="Last 24 hours" />
        <Stat label="Sign-ins" value={num(d.signIns7)} hint="Last 7 days" />
      </div>

      <Panel title="Sessions" sub="Most recently used first">
        {d.sessions.length === 0 ? (
          <Empty>No sessions yet. They appear here once someone signs in or opens the app.</Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last seen</th>
                  <th scope="col">Signed in</th>
                  <th scope="col">Browser</th>
                </tr>
              </thead>
              <tbody>
                {d.sessions.map((s) => (
                  <tr key={s._id}>
                    <td className="max-w-[220px] truncate font-medium">{s.memberName || 'Unknown'}</td>
                    <td>{status(s, now)}</td>
                    <td className="whitespace-nowrap text-muted">
                      <LocalTime value={s.lastSeenAt} relative />
                    </td>
                    <td className="whitespace-nowrap text-muted">
                      <LocalTime value={s.signedInAt} />
                    </td>
                    <td className="text-muted">{agent(s.agent)}</td>
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
