import type { DbAdapter, TeamsRepo, FoldersRepo, QueriesRepo, Team, Folder, SqlQuery, UUID } from './types';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

function baseUrl(path: string) {
  if (!API_BASE) throw new Error('VITE_API_BASE_URL is not set for REST provider');
  return `${API_BASE.replace(/\/$/, '')}${path}`;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as any || {}) };
  const providers = (import.meta.env.VITE_AUTH_PROVIDERS || '').toLowerCase();
  if (providers.includes('supabase')) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
  }
  const res = await fetch(input, {
    credentials: 'include',
    headers,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const teams: TeamsRepo = {
  async listForUser() {
    return http<(Team & { role?: 'admin' | 'member' })[]>(baseUrl('/teams'));
  },
  async getById(id: UUID) {
    return http<Team | null>(baseUrl(`/teams/${id}`));
  },
};

const folders: FoldersRepo = {
  async listByTeam(teamId: UUID) {
    return http<Folder[]>(baseUrl(`/teams/${teamId}/folders`));
  },
  async getById(id: UUID) {
    return http<Folder | null>(baseUrl(`/folders/${id}`));
  },
  async create(input) {
    return http<Folder>(baseUrl(`/folders`), { method: 'POST', body: JSON.stringify(input) });
  },
};

const queries: QueriesRepo = {
  async getById(id: UUID) {
    return http<SqlQuery | null>(baseUrl(`/queries/${id}`));
  },
  async search({ teamId, q }) {
    const qs = new URLSearchParams({ teamId, ...(q ? { q } : {}) }).toString();
    return http<SqlQuery[]>(baseUrl(`/queries?${qs}`));
  },
  async create(input) {
    return http<SqlQuery>(baseUrl('/queries'), { method: 'POST', body: JSON.stringify(input) });
  },
  async update(id, patch) {
    await http<void>(baseUrl(`/queries/${id}`), { method: 'PATCH', body: JSON.stringify(patch) });
  },
  async remove(id) {
    await http<void>(baseUrl(`/queries/${id}`), { method: 'DELETE' });
  },
  async submitForApproval(id, sql, opts) {
    await http<void>(baseUrl(`/queries/${id}/submit`), {
      method: 'POST',
      body: JSON.stringify({ sql, ...(opts || {}) }),
    });
  },
  async approve(id, historyId) {
    await http<void>(baseUrl(`/queries/${id}/approve`), { method: 'POST', body: JSON.stringify({ historyId }) });
  },
  async reject(id, historyId, reason) {
    await http<void>(baseUrl(`/queries/${id}/reject`), { method: 'POST', body: JSON.stringify({ historyId, reason }) });
  },
};

export const createRestAdapter = (): DbAdapter => ({
  teams,
  folders,
  queries,
});
