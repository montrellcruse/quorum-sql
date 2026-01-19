import type { 
  DbAdapter, 
  TeamsRepo, 
  FoldersRepo, 
  QueriesRepo, 
  TeamMembersRepo,
  InvitationsRepo,
  Team, 
  Folder, 
  SqlQuery, 
  UUID,
  QueryHistory,
  QueryApproval,
  TeamMember,
  TeamInvitation,
  Role,
  PendingApprovalQuery,
} from './types';
import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from './env';
import { getErrorMessage } from '@/utils/errors';
import { getCsrfToken } from '@/lib/auth/restAuthAdapter';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const initHeaders = init?.headers;
  const headersFromInit: Record<string, string> =
    initHeaders instanceof Headers
      ? Object.fromEntries(initHeaders.entries())
      : (initHeaders as Record<string, string> | undefined) ?? {};
  const headers: Record<string, string> = { ...headersFromInit };
  // Only set Content-Type for requests with a body
  if (init?.body) {
    headers['Content-Type'] = 'application/json';
  }

  // Add CSRF token for state-changing requests
  const method = init?.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const providers = (import.meta.env.VITE_AUTH_PROVIDERS || '').toLowerCase();
  if (providers.includes('supabase')) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore: Supabase not configured or session unavailable
    }
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

const teams: TeamsRepo = {
  async listForUser() {
    return http<(Team & { role?: 'admin' | 'member' })[]>(baseUrl('/teams'));
  },
  async getById(id: UUID) {
    return http<Team | null>(baseUrl(`/teams/${id}`));
  },
  async create(name: string, approvalQuota = 1) {
    return http<Team>(baseUrl('/teams'), {
      method: 'POST',
      body: JSON.stringify({ name, approval_quota: approvalQuota }),
    });
  },
  async update(id: UUID, data: { approval_quota?: number }) {
    await http<void>(baseUrl(`/teams/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  async remove(id: UUID) {
    await http<void>(baseUrl(`/teams/${id}`), { method: 'DELETE' });
  },
  async transferOwnership(id: UUID, newOwnerUserId: UUID) {
    await http<void>(baseUrl(`/teams/${id}/transfer-ownership`), {
      method: 'POST',
      body: JSON.stringify({ new_owner_user_id: newOwnerUserId }),
    });
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
  async getHistory(id: UUID) {
    return http<QueryHistory[]>(baseUrl(`/queries/${id}/history`));
  },
  async getApprovals(id: UUID) {
    return http<{ approvals: QueryApproval[]; approval_quota: number; latest_history_id?: UUID }>(
      baseUrl(`/queries/${id}/approvals`)
    );
  },
  async getPendingForApproval(teamId: UUID, excludeEmail: string) {
    const qs = new URLSearchParams({ teamId, excludeEmail }).toString();
    return http<PendingApprovalQuery[]>(baseUrl(`/approvals?${qs}`));
  },
};

const members: TeamMembersRepo = {
  async list(teamId: UUID) {
    return http<TeamMember[]>(baseUrl(`/teams/${teamId}/members`));
  },
  async remove(teamId: UUID, memberId: UUID) {
    await http<void>(baseUrl(`/teams/${teamId}/members/${memberId}`), { method: 'DELETE' });
  },
  async updateRole(teamId: UUID, memberId: UUID, role: Role) {
    await http<void>(baseUrl(`/teams/${teamId}/members/${memberId}`), { 
      method: 'PATCH', 
      body: JSON.stringify({ role }) 
    });
  },
};

const invitations: InvitationsRepo = {
  async listMine() {
    return http<TeamInvitation[]>(baseUrl('/invites/mine'));
  },
  async listByTeam(teamId: UUID) {
    return http<TeamInvitation[]>(baseUrl(`/teams/${teamId}/invites`));
  },
  async create(teamId: UUID, email: string, role: Role) {
    await http<void>(baseUrl(`/teams/${teamId}/invites`), {
      method: 'POST',
      body: JSON.stringify({ invited_email: email, role }),
    });
  },
  async accept(id: UUID) {
    await http<void>(baseUrl(`/invites/${id}/accept`), { method: 'POST' });
  },
  async decline(id: UUID) {
    await http<void>(baseUrl(`/invites/${id}/decline`), { method: 'POST' });
  },
  async revoke(id: UUID) {
    await http<void>(baseUrl(`/invites/${id}`), { method: 'DELETE' });
  },
};

export const createRestAdapter = (): DbAdapter => ({
  teams,
  folders,
  queries,
  members,
  invitations,
});
