import type { AuthAdapter } from './types';
import type { UserIdentity } from '../provider/types';
import { getApiBaseUrl } from '@/lib/provider/env';
import { getErrorMessage } from '@/utils/errors';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  };
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
    await http<void>(baseUrl('/auth/login'), { method: 'POST', body: JSON.stringify({ email, password }) });
  },
  async signUp(email: string, password: string, fullName?: string) {
    await http<void>(baseUrl('/auth/register'), {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName })
    });
  },
  async signOut() {
    await http<void>(baseUrl('/auth/logout'), { method: 'POST' });
  },
};
