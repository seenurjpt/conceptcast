'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LockPasswordIcon } from '@hugeicons/core-free-icons';
import { LogoMark } from '@/components/Logo';

export function AdminLoginForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Sign in failed.');
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="adm-login">
      <div className="adm-login-card">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6 text-primary" />
          <span className="t-title-sm tracking-[-0.02em]">conceptcast</span>
          <span className="adm-badge">Admin</span>
        </div>
        <span className="adm-login-icon" aria-hidden>
          <HugeiconsIcon icon={LockPasswordIcon} size={24} strokeWidth={1.7} />
        </span>
        <h1 className="adm-h1 mt-3">Admin sign in</h1>
        <p className="adm-sub">For the people who run this deployment. App users sign in with LinkedIn instead.</p>

        {!configured ? (
          <p className="adm-login-note">
            The admin panel is not set up yet. Run <code>npm run admin:hash</code> and set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and
            ADMIN_SESSION_SECRET in the environment, then reload this page.
          </p>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-5 grid gap-3" noValidate>
            <label className="grid gap-1.5">
              <span className="label mb-0">Email</span>
              <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <label className="grid gap-1.5">
              <span className="label mb-0">Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p className="adm-login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn btn-primary mt-1 w-full" disabled={busy || !email || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-[13px] text-muted">
          <Link href="/" className="hover:text-ink">
            Back to conceptcast
          </Link>
        </p>
      </div>
    </main>
  );
}
