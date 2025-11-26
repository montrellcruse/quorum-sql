import { useMemo } from 'react';
import { getDbAdapter } from '@/lib/provider';
import type { DbAdapter } from '@/lib/provider/types';

export type DbProvider = 'supabase' | 'rest';

interface DbProviderContext {
  provider: DbProvider;
  apiBase: string | undefined;
  adapter: DbAdapter;
  isRest: boolean;
  isSupabase: boolean;
}

export function useDbProvider(): DbProviderContext {
  const provider = useMemo(
    () => (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase() as DbProvider,
    []
  );
  
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  
  const adapter = useMemo(() => getDbAdapter(), []);
  
  return {
    provider,
    apiBase,
    adapter,
    isRest: provider === 'rest',
    isSupabase: provider === 'supabase',
  };
}

export function getApiBaseUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!apiBase) throw new Error('VITE_API_BASE_URL is not set');
  return apiBase.replace(/\/$/, '');
}

export async function restFetch<T>(
  path: string, 
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
