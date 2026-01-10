import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Lazy-initialize the Supabase client to allow the app to load even without config
// This enables the setup wizard to work before .env is configured
let _supabase: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
  if (_supabase) {
    return _supabase;
  }

  // Check if Supabase is configured
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    // Return a mock client that will fail gracefully
    // This allows the app to load for setup/non-Supabase modes
    console.warn('Supabase not configured. Some features may be unavailable.');

    // Create a minimal mock that won't crash but will fail on actual use
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
        signInWithOAuth: async () => ({ data: { url: null, provider: 'google' }, error: new Error('Supabase not configured') }),
      },
      from: () => ({
        select: () => ({ data: null, error: new Error('Supabase not configured') }),
        insert: () => ({ data: null, error: new Error('Supabase not configured') }),
        update: () => ({ data: null, error: new Error('Supabase not configured') }),
        delete: () => ({ data: null, error: new Error('Supabase not configured') }),
      }),
    } as unknown as SupabaseClient<Database>;
  }

  _supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });

  return _supabase;
}

// Export a proxy that lazily initializes the client
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, prop) {
    const client = getSupabaseClient();
    const value = client[prop as keyof SupabaseClient<Database>];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

// Helper to check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
