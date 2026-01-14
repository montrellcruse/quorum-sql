import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl, getDbProviderType } from '@/lib/provider/env';
import { getErrorMessage } from '@/utils/errors';

const provider = getDbProviderType();
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const apiBase = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch (error: unknown) {
    throw new Error(`Network error: ${getErrorMessage(error, 'request failed')}`);
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const checkUserTeamMembership = async (userId: string): Promise<boolean> => {
  try {
    if (provider === 'rest') {
      const teams = await http<unknown[]>('/teams');
      return Array.isArray(teams) && teams.length > 0;
    } else {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      if (error) return false;
      return !!(data && data.length > 0);
    }
  } catch {
    return false;
  }
};

export const checkPendingInvitations = async (email: string): Promise<boolean> => {
  try {
    if (provider === 'rest') {
      const invites = await http<unknown[]>('/invites/mine');
      return Array.isArray(invites) && invites.length > 0;
    } else {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id')
        .eq('invited_email', email)
        .eq('status', 'pending')
        .limit(1);
      if (error) return false;
      return !!(data && data.length > 0);
    }
  } catch {
    return false;
  }
};

export const checkPendingInvitationsCount = async (email: string): Promise<number> => {
  try {
    if (provider === 'rest') {
      const invites = await http<unknown[]>('/invites/mine');
      return Array.isArray(invites) ? invites.length : 0;
    } else {
      const { count, error } = await supabase
        .from('team_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('invited_email', email)
        .eq('status', 'pending');
      if (error) return 0;
      return count || 0;
    }
  } catch {
    return 0;
  }
};

export const getPendingApprovalsCount = async (teamId: string, userEmail: string): Promise<number> => {
  try {
    if (provider === 'rest') {
      const params = new URLSearchParams({ teamId, excludeEmail: userEmail });
      const rows = await http<unknown[]>(`/approvals?${params.toString()}`);
      return Array.isArray(rows) ? rows.length : 0;
    } else {
      const { count, error } = await supabase
        .from('sql_queries')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'pending_approval')
        .neq('last_modified_by_email', userEmail);
      if (error) return 0;
      return count || 0;
    }
  } catch {
    return 0;
  }
};
