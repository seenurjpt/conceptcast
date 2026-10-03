import { redirect } from 'next/navigation';
import { dbConnect } from '@/lib/db/connect';
import { hasActiveSession } from '@/lib/session';
import { Nav } from '@/components/Nav';
import { LinkedInBanner } from '@/components/LinkedInBanner';
import { ApiKeyBanner } from '@/components/ApiKeyBanner';
import { SessionProvider } from '@/components/SessionProvider';

export const dynamic = 'force-dynamic';

/**
 * Chrome for the signed-in app. The login screen deliberately has none.
 *
 * The middleware already turned away anyone without a cookie; this catches a
 * cookie whose LinkedIn account is gone and sends them to sign in again, with
 * a flag so the login screen clears the stale cookie.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await dbConnect();
  if (!(await hasActiveSession())) redirect('/login?stale=1');
  return (
    <SessionProvider>
      <Nav />
      <LinkedInBanner />
      <ApiKeyBanner />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5 sm:py-8">{children}</main>
    </SessionProvider>
  );
}
