// Strip quotes from environment variables if present (workaround for auto-generated .env)
const stripQuotes = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^["']|["']$/g, '');
};

// Fallback to known values if env vars are not loaded
const FALLBACK_URL = 'https://your-project-id.supabase.co';
const FALLBACK_KEY = 'your-anon-key-here';

export const SUPABASE_URL = stripQuotes(import.meta.env.VITE_SUPABASE_URL) || FALLBACK_URL;
export const SUPABASE_PUBLISHABLE_KEY = stripQuotes(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || FALLBACK_KEY;
