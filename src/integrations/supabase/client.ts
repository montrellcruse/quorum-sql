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
    if (import.meta.env.DEV) {
      console.warn('Supabase not configured. Some features may be unavailable.');
    }

    // Create a minimal mock that won't crash but will fail on actual use
    // The mock channel returns a chainable object that reports CHANNEL_ERROR
    const mockChannel = {
      on: () => mockChannel,
      subscribe: (callback?: (status: string, err?: Error) => void) => {
        // Report error status so UI can handle gracefully
        if (callback) {
          setTimeout(() => callback('CHANNEL_ERROR', new Error('Supabase not configured')), 0);
        }
        return mockChannel;
      },
      unsubscribe: async () => ({ error: null }),
    };

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
      channel: () => mockChannel,
      removeChannel: () => Promise.resolve({ error: null }),
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

// Helper to check if the app is properly configured (Supabase or REST mode)
export function isSupabaseConfigured(): boolean {
  // REST mode doesn't require Supabase credentials
  const dbProvider = import.meta.env.VITE_DB_PROVIDER;
  if (dbProvider === 'rest') {
    return true;
  }
  // Supabase mode requires URL and key
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
