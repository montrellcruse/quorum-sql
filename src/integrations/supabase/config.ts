// Strip quotes from environment variables if present (workaround for auto-generated .env)
const stripQuotes = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^["']|["']$/g, '');
};

// Lovable Cloud configuration
// Note: In Lovable's preview environment, Vite doesn't load .env files automatically
// These fallback values match your Lovable Cloud backend configuration
const FALLBACK_URL = 'https://yusevelhxsnsxobpnwdn.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1c2V2ZWxoeHNuc3hvYnBud2RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNjg5NjQsImV4cCI6MjA3NjY0NDk2NH0.sffHH5LgbD1z67aBA9-T8h3iwapJBUg4eP_Ft_2Sxi4';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const SUPABASE_URL = rawUrl ? stripQuotes(rawUrl) : FALLBACK_URL;
export const SUPABASE_PUBLISHABLE_KEY = rawKey ? stripQuotes(rawKey) : FALLBACK_KEY;
