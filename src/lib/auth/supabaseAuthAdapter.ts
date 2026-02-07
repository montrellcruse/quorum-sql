import { supabase } from '@/integrations/supabase/client';
import type { UserIdentity } from '@/lib/provider/types';
import type { AuthAdapter, PasswordAuthResult } from './types';

const GOOGLE_WORKSPACE_DOMAIN = import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || '';

function toUserIdentity(): Promise<UserIdentity | null> {
  return supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) throw error;
    const user = session?.user;
    if (!user || !user.email) return null;

    const fullName = user.user_metadata?.full_name;
    return {
      id: user.id,
      email: user.email,
      full_name: typeof fullName === 'string' ? fullName : null,
    };
  });
}

async function signInWithPassword(email: string, password: string): Promise<PasswordAuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { hasSession: Boolean(data.session) };
}

async function signUp(email: string, password: string, fullName?: string): Promise<PasswordAuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/auth`,
    },
  });
  if (error) throw error;
  return { hasSession: Boolean(data.session) };
}

async function signInWithOAuth(provider: 'google') {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        ...(GOOGLE_WORKSPACE_DOMAIN && { hd: GOOGLE_WORKSPACE_DOMAIN }),
      },
    },
  });
  if (error) throw error;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const supabaseAuthAdapter: AuthAdapter = {
  requiresManualPostAuthRedirect: false,
  getSessionUser: toUserIdentity,
  signInWithPassword,
  signUp,
  signInWithOAuth,
  signOut,
};
