import { supabase } from '@/integrations/supabase/client';

export const checkUserTeamMembership = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      return false;
    }

    return data && data.length > 0;
  } catch (error: any) {
    return false;
  }
};

export const checkPendingInvitations = async (email: string): Promise<boolean> => {
  try {
    // Check directly in team_invitations using the email parameter
    const { data, error } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .limit(1);

    if (error) {
      return false;
    }

    return data && data.length > 0;
  } catch (error: any) {
    return false;
  }
};

export const checkPendingInvitationsCount = async (email: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('team_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('invited_email', email)
      .eq('status', 'pending');

    if (error) {
      return 0;
    }

    return count || 0;
  } catch (error: any) {
    return 0;
  }
};

export const getPendingApprovalsCount = async (teamId: string, userEmail: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('sql_queries')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'pending_approval')
      .neq('last_modified_by_email', userEmail);

    if (error) {
      return 0;
    }

    return count || 0;
  } catch (error: any) {
    return 0;
  }
};
