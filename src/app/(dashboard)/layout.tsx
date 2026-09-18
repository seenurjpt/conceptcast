import { Nav } from '@/components/Nav';
import { LinkedInBanner } from '@/components/LinkedInBanner';

/** Chrome for the signed-in app. The login screen deliberately has none. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <LinkedInBanner />
      <main className="mx-auto max-w-[1200px] px-5 py-8">{children}</main>
    </>
  );
}
