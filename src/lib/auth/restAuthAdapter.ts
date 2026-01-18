import type { AuthAdapter } from './types';
import type { UserIdentity } from '../provider/types';
import { getApiBaseUrl } from '@/lib/provider/env';
import { getErrorMessage } from '@/utils/errors';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

const CSRF_STORAGE_KEY = 'quorum_csrf_token';

export function setCsrfToken(token: string | null) {
  if (token) {
    localStorage.setItem(CSRF_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

export function getCsrfToken(): string | null {
  // Try localStorage first (persists across page reloads for cross-origin setups)
  const stored = localStorage.getItem(CSRF_STORAGE_KEY);
  if (stored) return stored;
  // Fallback to cookie (for same-origin setups)
  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() || 'GET';
  const initHeaders = init?.headers;
  const headersFromInit: Record<string, string> =
    initHeaders instanceof Headers
      ? Object.fromEntries(initHeaders.entries())
      : (initHeaders as Record<string, string> | undefined) ?? {};
  const headers: Record<string, string> = {
    ...headersFromInit,
  };
  // Only set Content-Type for requests with a body
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  let res: Response;
  try {
    res = await fetch(input, {
      credentials: 'include',
      headers,
      ...init,
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

export const restAuthAdapter: AuthAdapter = {
  async getSessionUser(): Promise<UserIdentity | null> {
    return http<UserIdentity | null>(baseUrl('/auth/me'));
  },
  async signInWithPassword(email: string, password: string) {
    const result = await http<{ ok: boolean; csrfToken?: string }>(baseUrl('/auth/login'), { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result?.csrfToken) setCsrfToken(result.csrfToken);
  },
  async signUp(email: string, password: string, fullName?: string) {
    const result = await http<{ ok: boolean; csrfToken?: string }>(baseUrl('/auth/register'), {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName })
    });
    if (result?.csrfToken) setCsrfToken(result.csrfToken);
  },
  async signOut() {
    await http<void>(baseUrl('/auth/logout'), { method: 'POST' });
    setCsrfToken(null); // Clear stored CSRF token
  },
};
