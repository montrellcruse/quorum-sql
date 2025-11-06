import { createSupabaseAdapter } from './supabaseAdapter';
import { createRestAdapter } from './restAdapter';
import type { DbAdapter } from './types';

export function getDbAdapter(): DbAdapter {
  const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
  if (provider === 'rest') return createRestAdapter();
  return createSupabaseAdapter();
}
