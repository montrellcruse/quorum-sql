export type DbProviderType = 'supabase' | 'rest';

export function getDbProviderType(): DbProviderType {
  const raw = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
  return raw === 'rest' ? 'rest' : 'supabase';
}

export function getApiBaseUrlOptional(): string | undefined {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return apiBase ? apiBase.replace(/\/$/, '') : undefined;
}

export function getApiBaseUrl(): string {
  // In development mode with Vite, use relative URLs so requests go through
  // the proxy (configured in vite.config.ts). This solves CSRF cross-origin issues.
  if (import.meta.env.DEV) {
    return '';
  }
  const apiBase = getApiBaseUrlOptional();
  if (!apiBase) throw new Error('VITE_API_BASE_URL is not set');
  return apiBase;
}
