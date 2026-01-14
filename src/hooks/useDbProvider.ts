import { useMemo } from 'react';
import { getDbAdapter } from '@/lib/provider';
import { getApiBaseUrl as getApiBaseUrlFromEnv, getApiBaseUrlOptional, getDbProviderType } from '@/lib/provider/env';
import { getErrorMessage } from '@/utils/errors';
import type { DbAdapter } from '@/lib/provider/types';

/** Supported database provider types */
export type DbProvider = 'supabase' | 'rest';

/** Context returned by useDbProvider hook */
interface DbProviderContext {
  /** Current provider type ('supabase' or 'rest') */
  provider: DbProvider;
  /** Base URL for REST API (undefined for Supabase) */
  apiBase: string | undefined;
  /** Database adapter with repository methods */
  adapter: DbAdapter;
  /** Whether using REST provider */
  isRest: boolean;
  /** Whether using Supabase provider */
  isSupabase: boolean;
}

/**
 * Hook providing database adapter and provider information.
 * Automatically selects between Supabase and REST based on VITE_DB_PROVIDER env var.
 * @returns Provider context with adapter and configuration
 */
export function useDbProvider(): DbProviderContext {
  const provider = useMemo(
    () => getDbProviderType(),
    []
  );
  
  const apiBase = getApiBaseUrlOptional();
  
  const adapter = useMemo(() => getDbAdapter(), []);
  
  return {
    provider,
    apiBase,
    adapter,
    isRest: provider === 'rest',
    isSupabase: provider === 'supabase',
  };
}

/**
 * Gets the REST API base URL from environment.
 * @throws Error if VITE_API_BASE_URL is not set
 * @returns Base URL without trailing slash
 */
export function getApiBaseUrl(): string {
  return getApiBaseUrlFromEnv();
}

/**
 * Performs a fetch request to the REST API with credentials.
 * Automatically sets Content-Type to application/json.
 * @param path - API endpoint path (will be appended to base URL)
 * @param options - Optional fetch options
 * @returns Parsed JSON response
 * @throws Error on non-OK response
 */
export async function restFetch<T>(
  path: string, 
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrlFromEnv();
  const url = `${baseUrl}${path}`;
  const method = options?.method?.toUpperCase() || 'GET';
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      ...options,
    });
  } catch (error: unknown) {
    throw new Error(`Network error during ${method} ${url}: ${getErrorMessage(error, 'request failed')}`);
  }

  if (!res.ok) {
    const text = await res.text();
    const detail = text || res.statusText;
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}${detail ? `: ${detail}` : ''}`);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}
