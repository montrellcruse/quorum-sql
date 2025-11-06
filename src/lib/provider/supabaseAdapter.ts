import { supabase } from '@/integrations/supabase/client';
import type {
  DbAdapter,
  TeamsRepo,
  FoldersRepo,
  QueriesRepo,
  Team,
  Folder,
  SqlQuery,
  UUID,
} from './types';

const teams: TeamsRepo = {
  async listForUser() {
    const { data, error } = await supabase
      .from('team_members')
      .select('role, teams:team_id(id, name, approval_quota, admin_id)');
    if (error) throw error;
    const mapped = (data || [])
      .filter((row: any) => row.teams)
      .map((row: any) => ({ ...(row.teams as Team), role: row.role })) as (Team & { role?: 'admin' | 'member' })[];
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
      .insert(input)
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
      .insert(input)
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
    const { error } = await supabase.rpc('submit_query_for_approval', {
      _query_id: id,
      _sql_content: sql,
    });
    if (error) throw error;
  },
  async approve(id, historyId) {
    const { error } = await supabase.rpc('approve_query_with_quota', {
      _query_id: id,
      _query_history_id: historyId,
    });
    if (error) throw error;
  },
  async reject(id, historyId, reason) {
    const { error } = await supabase.rpc('reject_query_with_authorization', {
      _query_id: id,
      _query_history_id: historyId,
      _reason: reason ?? null,
    });
    if (error) throw error;
  },
};

export const createSupabaseAdapter = (): DbAdapter => ({
  teams,
  folders,
  queries,
});
