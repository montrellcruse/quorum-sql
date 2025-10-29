// Strip quotes from environment variables if present (workaround for auto-generated .env)
const stripQuotes = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^["']|["']$/g, '');
};

// Lovable Cloud configuration
// Note: In Lovable's preview environment, Vite doesn't load .env files automatically
// These fallback values match your Lovable Cloud backend configuration
const FALLBACK_URL = 'https://your-project-id.supabase.co';
const FALLBACK_KEY = 'your-anon-key-here';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_URL = rawUrl ? stripQuotes(rawUrl) : FALLBACK_URL;
export const SUPABASE_PUBLISHABLE_KEY = rawKey ? stripQuotes(rawKey) : FALLBACK_KEY;
