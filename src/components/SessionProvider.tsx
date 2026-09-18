'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getJson, sendJson } from '@/lib/ui';

export type AuthState = 'missing' | 'ok' | 'refresh-due' | 'expired' | 'refresh-expired';

export interface Member {
  urn: string;
  name: string | null;
  picture: string | null;
  email: string | null;
}

export interface Session {
  state: AuthState;
  signedIn: boolean;
  member: Member | null;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  scopes: string[];
  canFetchMetrics: boolean;
  source: string | null;
  configured: boolean;
}

interface SessionContext {
  session: Session | null;
  loading: boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  signInHref: (returnTo?: string) => string;
}

const Ctx = createContext<SessionContext>({
  session: null,
  loading: true,
  reload: async () => {},
  signOut: async () => {},
  signInHref: () => '/api/auth/linkedin',
});

export function useSession(): SessionContext {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setSession(await getJson<Session>('/api/auth/linkedin/status'));
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    await sendJson('/api/auth/linkedin/status', 'DELETE');
    await reload();
  }, [reload]);

  const signInHref = useCallback((returnTo?: string) => {
    const path = returnTo ?? (typeof window === 'undefined' ? '/review' : window.location.pathname);
    return `/api/auth/linkedin?returnTo=${encodeURIComponent(path)}`;
  }, []);

  const value = useMemo(
    () => ({ session, loading, reload, signOut, signInHref }),
    [session, loading, reload, signOut, signInHref],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
