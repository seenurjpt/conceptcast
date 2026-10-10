import type { Metadata } from 'next';
import { dbConnect } from '@/lib/db/connect';
import { requireAdminPage } from '@/lib/admin/guard';
import { AdminShell } from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · conceptcast' },
  robots: { index: false, follow: false },
};

/**
 * Every admin page: the cookie is checked again here, server side, on top
 * of the middleware gate, so admin data never renders without it.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdminPage();
  await dbConnect();
  return <AdminShell email={email}>{children}</AdminShell>;
}
