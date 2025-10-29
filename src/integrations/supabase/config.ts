// Strip quotes from environment variables if present (workaround for auto-generated .env)
const stripQuotes = (value: string | undefined): string => {
  if (!value) return '';
  return value.replace(/^["']|["']$/g, '');
};

// Debug logging
console.log('Raw VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Raw VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fallback to hardcoded values if env vars are not loaded (Lovable Cloud managed)
const FALLBACK_URL = 'https://your-project-id.supabase.co';
const FALLBACK_KEY = 'your-anon-key-here';

export const SUPABASE_URL = rawUrl ? stripQuotes(rawUrl) : FALLBACK_URL;
export const SUPABASE_PUBLISHABLE_KEY = rawKey ? stripQuotes(rawKey) : FALLBACK_KEY;

console.log('Final SUPABASE_URL:', SUPABASE_URL);
console.log('Final SUPABASE_PUBLISHABLE_KEY:', SUPABASE_PUBLISHABLE_KEY ? '***' + SUPABASE_PUBLISHABLE_KEY.slice(-10) : 'NOT SET');
