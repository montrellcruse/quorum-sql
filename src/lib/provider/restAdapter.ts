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
  FolderPath,
  FolderQuery,
} from './types';
import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from './env';
import { getErrorMessage } from '@/utils/errors';
import { getCsrfToken } from '@/lib/auth/restAuthAdapter';

function baseUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

async function applySupabaseAuthHeader(headers: Record<string, string>) {
  const providers = (import.meta.env.VITE_AUTH_PROVIDERS || '').toLowerCase();
  if (!providers.includes('supabase')) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // ignore: Supabase not configured or session unavailable
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
  await applySupabaseAuthHeader(headers);

  const url = resolveUrl(input);
  const res = await performFetch(input, init, headers, method, url);
  await assertOk(res, method, url);
  return parseJson<T>(res);
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
  async update(id: UUID, data: { approval_quota?: number; name?: string }) {
    await http<void>(baseUrl(`/teams/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  async remove(id: UUID) {
    await http<void>(baseUrl(`/teams/${id}`), { method: 'DELETE' });
  },
  async convertPersonal(id: UUID, name?: string | null) {
    await http<void>(baseUrl(`/teams/${id}/convert-personal`), {
      method: 'POST',
      body: JSON.stringify({ name: name ?? null }),
    });
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
  async listChildren(parentId: UUID) {
    return http<Folder[]>(baseUrl(`/folders/${parentId}/children`));
  },
  async listPaths(teamId: UUID) {
    const qs = new URLSearchParams({ teamId }).toString();
    return http<FolderPath[]>(baseUrl(`/folders/paths?${qs}`));
  },
  async create(input) {
    return http<Folder>(baseUrl(`/folders`), { method: 'POST', body: JSON.stringify(input) });
  },
  async update(id: UUID, patch: { name?: string; description?: string | null }) {
    await http<void>(baseUrl(`/folders/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  async remove(id: UUID) {
    await http<void>(baseUrl(`/folders/${id}`), { method: 'DELETE' });
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
  async listByFolder(folderId: UUID) {
    return http<FolderQuery[]>(baseUrl(`/folders/${folderId}/queries`));
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
  async countByRole(teamId: UUID, role: Role) {
    const members = await http<TeamMember[]>(baseUrl(`/teams/${teamId}/members`));
    return members.filter((member) => member.role === role).length;
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
