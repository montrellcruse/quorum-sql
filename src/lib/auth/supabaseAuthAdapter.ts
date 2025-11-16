import { supabase } from '@/integrations/supabase/client';
import type { AuthAdapter } from './types';

export const supabaseAuthAdapter: AuthAdapter = {
  async getSessionUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email || '',
      full_name: (data.user.user_metadata as any)?.full_name ?? null,
    };
  },
  async signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signInWithOAuth(provider: 'google') {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    if (error) throw error;
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
