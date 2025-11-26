import { supabase } from '@/integrations/supabase/client';
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

const teams: TeamsRepo = {
  async listForUser() {
    const { data, error } = await supabase
      .from('team_members')
      .select('role, teams:team_id(id, name, approval_quota, admin_id)');
    if (error) throw error;
    const mapped = (data || [])
      .filter((row: unknown) => (row as { teams: unknown }).teams)
      .map((row: unknown) => ({ ...((row as { teams: Team }).teams), role: (row as { role: Role }).role })) as (Team & { role?: 'admin' | 'member' })[];
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
    
    return data as Team;
  },
  async update(id: UUID, updateData: { approval_quota?: number }) {
    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', id);
    if (error) throw error;
  },
  async transferOwnership(id: UUID, newOwnerUserId: UUID) {
    // Make new owner admin and transfer ownership
    const { error: memberError } = await supabase
      .from('team_members')
      .update({ role: 'admin' })
      .eq('team_id', id)
      .eq('user_id', newOwnerUserId);
    if (memberError) throw memberError;
    
    const { error: teamError } = await supabase
      .from('teams')
      .update({ admin_id: newOwnerUserId })
      .eq('id', id);
    if (teamError) throw teamError;
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
      .insert([input as any])
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
      .insert([input as any])
      .select('*')
      .single();
    if (error) throw error;
    return data as SqlQuery;
  },
  async update(id, patch) {
    const { error } = await supabase
      .from('sql_queries')
      .update(patch)
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
  async submitForApproval(id, sql) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Get query to extract team_id
    const { data: query, error: queryError } = await supabase
      .from('sql_queries')
      .select('team_id')
      .eq('id', id)
      .single();
    if (queryError || !query) throw new Error('Query not found');
    
    const { error } = await supabase.rpc('submit_query_for_approval', {
      _query_id: id,
      _sql_content: sql,
      _modified_by_email: user.email!,
      _change_reason: '',
      _team_id: query.team_id,
      _user_id: user.id,
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
  async reject(id, historyId, reason) {
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
    
    const approval_quota = (query as any)?.teams?.approval_quota || 1;
    
    const { data: history, error: histError } = await supabase
      .from('query_history')
      .select('id')
      .eq('query_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (histError || !history) {
      return { approvals: [], approval_quota };
    }
    
    const { data: approvals, error: apprError } = await supabase
      .from('query_approvals')
      .select('*')
      .eq('query_history_id', history.id);
    if (apprError) throw apprError;
    
    return {
      approvals: (approvals || []) as QueryApproval[],
      approval_quota,
      latest_history_id: history.id,
    };
  },
  async getPendingForApproval(teamId: UUID, excludeEmail: string) {
    const { data: queries, error: queriesError } = await supabase
      .from('sql_queries')
      .select(`
        id,
        title,
        description,
        folder_id,
        last_modified_by_email,
        updated_at,
        folders!inner(name)
      `)
      .eq('team_id', teamId)
      .eq('status', 'pending_approval')
      .neq('last_modified_by_email', excludeEmail)
      .order('updated_at', { ascending: false });
    if (queriesError) throw queriesError;

    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('approval_quota')
      .eq('id', teamId)
      .single();
    if (teamError) throw teamError;

    const results: PendingApprovalQuery[] = await Promise.all(
      (queries || []).map(async (query) => {
        let approvalCount = 0;
        const { data: historyData } = await supabase
          .from('query_history')
          .select('id')
          .eq('query_id', query.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (historyData) {
          const { count } = await supabase
            .from('query_approvals')
            .select('*', { count: 'exact', head: true })
            .eq('query_history_id', historyData.id);
          approvalCount = count || 0;
        }

        return {
          id: query.id,
          title: query.title,
          description: query.description,
          folder_id: query.folder_id,
          last_modified_by_email: query.last_modified_by_email || '',
          updated_at: query.updated_at || '',
          folder_name: (query.folders as { name: string }).name,
          approval_count: approvalCount,
          approval_quota: teamData.approval_quota,
        };
      })
    );

    return results;
  },
};

const members: TeamMembersRepo = {
  async list(teamId: UUID) {
    const { data, error } = await supabase
      .from('team_members')
      .select('id, user_id, role, profiles!inner(email)')
      .eq('team_id', teamId);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      team_id: teamId,
      role: row.role,
      email: row.profiles?.email,
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
    
    return (data || []).map((row: any) => ({
      id: row.id,
      team_id: row.team_id,
      invited_email: row.invited_email,
      role: row.role,
      status: row.status,
      invited_by_user_id: row.invited_by_user_id,
      created_at: row.created_at,
      team_name: row.teams?.name,
      inviter_email: row.profiles?.email,
      inviter_full_name: row.profiles?.full_name,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // Get the invitation
    const { data: invite, error: invError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('id', id)
      .eq('status', 'pending')
      .single();
    if (invError || !invite) throw new Error('Invitation not found');
    
    // Verify email matches
    if (invite.invited_email.toLowerCase() !== user.email?.toLowerCase()) {
      throw new Error('This invitation is for a different email');
    }
    
    // Add to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invite.team_id,
        user_id: user.id,
        role: invite.role,
      });
    if (memberError && !memberError.message.includes('duplicate')) throw memberError;
    
    // Delete invitation
    const { error: delError } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id);
    if (delError) throw delError;
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
