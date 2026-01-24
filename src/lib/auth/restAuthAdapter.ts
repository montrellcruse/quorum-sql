import type { AuthAdapter } from './types';
import type { UserIdentity } from '../provider/types';
import { getApiBaseUrl } from '@/lib/provider/env';
import { getErrorMessage } from '@/utils/errors';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

const CSRF_STORAGE_KEY = 'quorum_csrf_token';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

function resolveMethod(init?: RequestInit) {
  return init?.method?.toUpperCase() || 'GET';
}

function resolveHeaders(init?: RequestInit): Record<string, string> {
  const initHeaders = init?.headers;
  const headersFromInit: Record<string, string> =
    initHeaders instanceof Headers
      ? Object.fromEntries(initHeaders.entries())
      : (initHeaders as Record<string, string> | undefined) ?? {};
  const headers: Record<string, string> = { ...headersFromInit };
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

function applyCsrfHeader(headers: Record<string, string>, method: string) {
  if (!STATE_CHANGING_METHODS.has(method)) return;
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
}

function resolveUrl(input: RequestInfo) {
  if (typeof input === 'string') return input;
  if (input instanceof Request) return input.url;
  return String(input);
}

async function performFetch(
  input: RequestInfo,
  init: RequestInit | undefined,
  headers: Record<string, string>,
  method: string,
  url: string
) {
  try {
    return await fetch(input, {
      credentials: 'include',
      ...init,
      headers,
    });
  } catch (error: unknown) {
    throw new Error(`Network error during ${method} ${url}: ${getErrorMessage(error, 'request failed')}`);
  }
}

async function assertOk(res: Response, method: string, url: string) {
  if (res.ok) return;
  const text = await res.text();
  const detail = text || res.statusText;
  throw new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}${detail ? `: ${detail}` : ''}`);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const method = resolveMethod(init);
  const headers = resolveHeaders(init);
  applyCsrfHeader(headers, method);

  const url = resolveUrl(input);
  const res = await performFetch(input, init, headers, method, url);
  await assertOk(res, method, url);
  return parseJson<T>(res);
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
