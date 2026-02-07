import type { AuthAdapter } from './types';
import type { UserIdentity } from '../provider/types';
import { getApiBaseUrl } from '@/lib/provider/env';
import { http, setCsrfToken } from '@/lib/http';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

export { getCsrfToken, setCsrfToken } from '@/lib/http';

export const restAuthAdapter: AuthAdapter = {
  requiresManualPostAuthRedirect: true,
  async getSessionUser(): Promise<UserIdentity | null> {
    return http<UserIdentity | null>(baseUrl('/auth/me'));
  },
  async signInWithPassword(email: string, password: string) {
    const result = await http<{ ok: boolean; csrfToken?: string }>(baseUrl('/auth/login'), { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result?.csrfToken) setCsrfToken(result.csrfToken);
    return { hasSession: true };
  },
  async signUp(email: string, password: string, fullName?: string) {
    const result = await http<{ ok: boolean; csrfToken?: string }>(baseUrl('/auth/register'), {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName })
    });
    if (result?.csrfToken) setCsrfToken(result.csrfToken);
    return { hasSession: true };
  },
  async signOut() {
    await http<void>(baseUrl('/auth/logout'), { method: 'POST' });
    setCsrfToken(null); // Clear stored CSRF token
  },
};
