import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate, QueryWithTeam } from '@/integrations/supabase/types';
import type {
  DbAdapter,
  TeamsRepo,
  FoldersRepo,
  QueriesRepo,
  TeamMembersRepo,
  InvitationsRepo,
  Team,
  Folder,
  FolderPath,
  SqlQuery,
  UUID,
  QueryHistory,
  QueryApproval,
  TeamMember,
  TeamInvitation,
  Role,
  PendingApprovalQuery,
} from './types';

type MemberRow = {
  id: string;
  user_id: string;
  role: Role;
  profiles?: { email?: string | null } | null;
};

type InvitationRow = {
  id: string;
  team_id: string;
  invited_email: string;
  role: Role;
  status: string;
  invited_by_user_id: string | null;
  created_at: string;
  teams?: { name?: string | null } | null;
  profiles?: { email?: string | null; full_name?: string | null } | null;
};

const isTeamMemberRow = (row: unknown): row is { role: Role; teams: Team } => {
  if (!row || typeof row !== 'object') return false;
  const record = row as Record<string, unknown>;
  const teams = record.teams;
  const role = record.role;
  if (!teams || typeof teams !== 'object') return false;
  if (typeof role !== 'string') return false;
  const teamRecord = teams as Record<string, unknown>;
  return typeof teamRecord.id === 'string' && typeof teamRecord.name === 'string' && typeof teamRecord.admin_id === 'string';
};

const teams: TeamsRepo = {
  async listForUser() {
    const { data, error } = await supabase
      .from('team_members')
      .select('role, teams:team_id(id, name, approval_quota, admin_id, is_personal)');
    if (error) throw error;
    const mapped = (data || [])
      .filter(isTeamMemberRow)
      .map((row) => ({ ...row.teams, role: row.role })) as (Team & { role?: 'admin' | 'member' })[];
    return mapped;
  },
  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Team;
  },
  async create(name: string, approvalQuota = 1) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Use RPC if available, otherwise manual insert
    const { data, error } = await supabase
      .rpc('create_team_with_admin', { _team_name: name, _approval_quota: approvalQuota })
      .single();
    
    if (error) {
      // Fallback: manual creation if RPC doesn't exist
      const { data: team, error: insertError } = await supabase
        .from('teams')
        .insert({ name, approval_quota: approvalQuota, admin_id: user.id })
        .select()
        .single();
      if (insertError) throw insertError;
      
      // Add creator as admin member
      await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'admin' });
      
      return team as Team;
    }
    
    // RPC returns team_id, team_name - map to id, name
    const result = data as { team_id: string; team_name: string; admin_id: string; approval_quota: number };
    return { id: result.team_id, name: result.team_name, admin_id: result.admin_id, approval_quota: result.approval_quota } as Team;
  },
  async update(id: UUID, updateData: { approval_quota?: number; name?: string }) {
    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
  },
  async remove(id: UUID) {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('is_personal')
      .eq('id', id)
      .single();
    if (teamError) throw teamError;

    if (team?.is_personal) {
      const { count, error: countError } = await supabase
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', id);
      if (countError) throw countError;
      if ((count || 0) <= 1) {
        throw new Error('Cannot delete your personal workspace. Create a new team first.');
      }
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  async transferOwnership(id: UUID, newOwnerUserId: UUID) {
    const { error } = await supabase.rpc('transfer_team_ownership', {
      _team_id: id,
      _new_owner_user_id: newOwnerUserId,
    });
    if (error) throw error;
  },
};

const folders: FoldersRepo = {
  async listByTeam(teamId: UUID) {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('team_id', teamId)
      .order('name');
    if (error) throw error;
    return (data || []) as Folder[];
  },
  async listPaths(teamId: UUID) {
    const { data, error } = await supabase.rpc('get_team_folder_paths', {
      _team_id: teamId,
    });
    if (error) throw error;
    return (data || []) as FolderPath[];
  },
  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as Folder;
  },
  async create(input) {
    const { data, error } = await supabase
      .from('folders')
      .insert([input as TablesInsert<'folders'>])
      .select('*')
      .single();
    if (error) throw error;
    return data as Folder;
  },
};

const queries: QueriesRepo = {
  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('sql_queries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data as SqlQuery;
  },
  async search({ teamId, q }) {
    const like = q ? `%${q}%` : undefined;
    let req = supabase
      .from('sql_queries')
      .select('*')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false });
    if (like) {
      req = req.or(`title.ilike.${like},description.ilike.${like},sql_content.ilike.${like}`);
    }
    const { data, error } = await req;
    if (error) throw error;
    return (data || []) as SqlQuery[];
  },
  async create(input) {
    const { data, error } = await supabase
      .from('sql_queries')
      .insert([input as TablesInsert<'sql_queries'>])
      .select('*')
      .single();
    if (error) throw error;
    return data as SqlQuery;
  },
  async update(id, patch) {
    const { error } = await supabase
      .from('sql_queries')
      .update(patch as TablesUpdate<'sql_queries'>)
      .eq('id', id);
    if (error) throw error;
  },
  async remove(id) {
    const { error } = await supabase
      .from('sql_queries')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  async submitForApproval(id, sql, opts) {
    const { data: { user } } = await supabase.auth.getUser();
    const resolvedUserId = opts?.user_id ?? user?.id;
    const resolvedEmail = opts?.modified_by_email ?? user?.email;
    if (!resolvedUserId || !resolvedEmail) throw new Error('Not authenticated');

    let resolvedTeamId = opts?.team_id;
    if (!resolvedTeamId) {
      const { data: query, error: queryError } = await supabase
        .from('sql_queries')
        .select('team_id')
        .eq('id', id)
        .single();
      if (queryError || !query) throw new Error('Query not found');
      resolvedTeamId = query.team_id;
    }

    const { error } = await supabase.rpc('submit_query_for_approval', {
      _query_id: id,
      _sql_content: sql,
      _modified_by_email: resolvedEmail,
      _change_reason: opts?.change_reason || '',
      _team_id: resolvedTeamId,
      _user_id: resolvedUserId,
    });
    if (error) throw error;
  },
  async approve(id, historyId) {
    const { error } = await supabase.rpc('approve_query_with_quota', {
      _query_id: id,
      _query_history_id: historyId,
      _approver_user_id: await supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) throw new Error('Not authenticated');
        return user.id;
      }),
    });
    if (error) throw error;
  },
  async reject(id, historyId, _reason) {
    const { error } = await supabase.rpc('reject_query_with_authorization', {
      _query_id: id,
      _query_history_id: historyId,
      _rejecter_user_id: await supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) throw new Error('Not authenticated');
        return user.id;
      }),
    });
    if (error) throw error;
  },
  async getHistory(id: UUID) {
    const { data, error } = await supabase
      .from('query_history')
      .select('*')
      .eq('query_id', id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as QueryHistory[];
  },
  async getApprovals(id: UUID) {
    const { data: query, error: queryError } = await supabase
      .from('sql_queries')
      .select('team_id, teams!inner(approval_quota)')
      .eq('id', id)
      .single();
    if (queryError) throw queryError;
    
    const approvalQuota = (query as QueryWithTeam)?.teams?.approval_quota || 1;
    
    const { data: history, error: histError } = await supabase
      .from('query_history')
      .select('id')
      .eq('query_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (histError || !history) {
      return { approvals: [], approval_quota: approvalQuota };
    }
    
    const { data: approvals, error: apprError } = await supabase
      .from('query_approvals')
      .select('*')
      .eq('query_history_id', history.id);
    if (apprError) throw apprError;
    
    return {
      approvals: (approvals || []) as QueryApproval[],
      approval_quota: approvalQuota,
      latest_history_id: history.id,
    };
  },
  async getPendingForApproval(teamId: UUID, excludeEmail: string) {
    const { data, error } = await supabase.rpc('get_pending_approvals', {
      _team_id: teamId,
      _exclude_email: excludeEmail,
    });
    if (error) throw error;
    return (data || []) as PendingApprovalQuery[];
  },
};

const members: TeamMembersRepo = {
  async list(teamId: UUID) {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, user_id, role, profiles!inner(email)')
      .eq('team_id', teamId);
    if (error) throw error;
    const rows = (data || []) as MemberRow[];
    return rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      team_id: teamId,
      role: row.role,
      email: row.profiles?.email ?? undefined,
    })) as TeamMember[];
  },
  async remove(teamId: UUID, memberId: UUID) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', teamId);
    if (error) throw error;
  },
  async updateRole(teamId: UUID, memberId: UUID, role: Role) {
    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .eq('team_id', teamId);
    if (error) throw error;
  },
};

const invitations: InvitationsRepo = {
  async listMine() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return [];
    
    const { data, error } = await supabase
      .from('team_invitations')
      .select(`
        id, team_id, invited_email, role, status, invited_by_user_id, created_at,
        teams!inner(name),
        profiles!team_invitations_invited_by_user_id_fkey(email, full_name)
      `)
      .eq('invited_email', user.email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const rows = (data || []) as InvitationRow[];
    return rows.map((row) => ({
      id: row.id,
      team_id: row.team_id,
      invited_email: row.invited_email,
      role: row.role,
      status: row.status,
      invited_by_user_id: row.invited_by_user_id,
      created_at: row.created_at,
      team_name: row.teams?.name ?? undefined,
      inviter_email: row.profiles?.email ?? undefined,
      inviter_full_name: row.profiles?.full_name ?? undefined,
    })) as TeamInvitation[];
  },
  async listByTeam(teamId: UUID) {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as TeamInvitation[];
  },
  async create(teamId: UUID, email: string, role: Role) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        invited_email: email.toLowerCase(),
        role,
        status: 'pending',
        invited_by_user_id: user.id,
      });
    if (error) throw error;
  },
  async accept(id: UUID) {
    const { error } = await supabase.rpc('accept_team_invitation', {
      _invitation_id: id,
    });
    if (error) throw error;
  },
  async decline(id: UUID) {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  async revoke(id: UUID) {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export const createSupabaseAdapter = (): DbAdapter => ({
  teams,
  folders,
  queries,
  members,
  invitations,
});
