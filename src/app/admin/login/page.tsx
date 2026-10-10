import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/guard';
import { adminConfigured } from '@/lib/admin/session';
import { AdminLoginForm } from './AdminLoginForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin sign in', robots: { index: false, follow: false } };

/** The admin panel's own front door: email and password, no LinkedIn. */
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await currentAdmin()) redirect('/admin');
  const { next } = await searchParams;
  // Only admin paths, never an outside address.
  const safeNext = next && /^\/admin(\/[\w/-]*)?$/.test(next) ? next : '/admin';
  return <AdminLoginForm next={safeNext} configured={adminConfigured()} />;
}
