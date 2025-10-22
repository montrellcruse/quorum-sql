import { supabase } from '@/integrations/supabase/client';

export const checkUserTeamMembership = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      console.error('Error checking team membership:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking team membership:', error);
    return false;
  }
};

export const checkPendingInvitations = async (email: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('invited_email', email)
      .eq('status', 'pending')
      .limit(1);

    if (error) {
      console.error('Error checking pending invitations:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking pending invitations:', error);
    return false;
  }
};
