import type { AuthAdapter } from './types';
import type { UserIdentity } from '../provider/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

function baseUrl(path: string) {
  if (!API_BASE) throw new Error('VITE_API_BASE_URL is not set for REST auth');
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
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
  async signOut() {
    await http<void>(baseUrl('/auth/logout'), { method: 'POST' });
  },
};
