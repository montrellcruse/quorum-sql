// Strip quotes from environment variables if present (workaround for auto-generated .env)
const stripQuotes = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^["']|["']$/g, '');
};

// Fallback to known values if env vars are not loaded
const FALLBACK_URL = 'https://yusevelhxsnsxobpnwdn.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c2V2ZWxoeHNuc3hvYnBud2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjg5NjQsImV4cCI6MjA3NjY0NDk2NH0.sffHH5LgbD1z67aBA9-T8h3iwapJBUg4eP_Ft_2Sxi4';

export const SUPABASE_URL = stripQuotes(import.meta.env.VITE_SUPABASE_URL) || FALLBACK_URL;
export const SUPABASE_PUBLISHABLE_KEY = stripQuotes(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || FALLBACK_KEY;
