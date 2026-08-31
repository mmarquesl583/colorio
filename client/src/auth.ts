import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function accountName(session: Session | null): string | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { display_name?: string } | undefined;
  return meta?.display_name?.trim() || session.user.email?.split('@')[0] || null;
}

export function accountAvatar(session: Session | null): string | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { avatar_icon?: string } | undefined;
  return meta?.avatar_icon || null;
}

export function setAccountAvatar(icon: string | null) {
  return supabase.auth.updateUser({ data: { avatar_icon: icon } });
}
