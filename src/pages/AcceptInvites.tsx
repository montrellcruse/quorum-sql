import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { checkUserTeamMembership } from '@/utils/teamUtils';

interface TeamInvitation {
  id: string;
  team_id: string;
  invited_email: string;
  role: string;
  invited_by_user_id?: string;
  teams?: {
    name: string;
  };
  inviter?: {
    full_name: string;
    email: string;
  };
}

const AcceptInvites = () => {
  const { user, loading } = useAuth();
  const { refreshTeams } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchPendingInvitations();
    }
  }, [user, loading, navigate]);

  const fetchPendingInvitations = async () => {
    try {
      // Use email directly from the auth user session
      const userEmail = user!.email;
      
      if (!userEmail) {
        console.error('No email found for user');
        const hasMembership = await checkUserTeamMembership(user!.id);
        navigate(hasMembership ? '/dashboard' : '/create-team');
        return;
      }

      // Step 1: Fetch invitations with invited_by_user_id
      const { data: invitationsData, error: invitationsError } = await supabase
        .from('team_invitations')
        .select('id, team_id, invited_email, role, invited_by_user_id')
        .eq('invited_email', userEmail)
        .eq('status', 'pending');

      if (invitationsError) throw invitationsError;

      // If no pending invites, redirect based on team membership
      if (!invitationsData || invitationsData.length === 0) {
        const hasMembership = await checkUserTeamMembership(user!.id);
        navigate(hasMembership ? '/dashboard' : '/create-team');
        return;
      }

      // Step 2: Fetch team data separately
      const teamIds = invitationsData.map(inv => inv.team_id);
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamsError) {
        console.error('Error fetching teams:', { message: teamsError?.message });
      }

      // Step 3: Fetch inviter profiles
      const inviterIds = invitationsData
        .map(inv => inv.invited_by_user_id)
        .filter((id): id is string => id != null);

      const { data: invitersData, error: invitersError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', inviterIds);

      if (invitersError) {
        console.error('Error fetching inviters:', { message: invitersError?.message });
      }

      // Step 4: Map all data together
      const invitationsWithTeams: TeamInvitation[] = invitationsData.map(inv => {
        const team = teamsData?.find(t => t.id === inv.team_id);
        const inviter = inv.invited_by_user_id 
          ? invitersData?.find(i => i.user_id === inv.invited_by_user_id)
          : null;
        
        return {
          ...inv,
          teams: team ? { name: team.name } : undefined,
          inviter: inviter ? {
            full_name: inviter.full_name,
            email: inviter.email
          } : undefined
        };
      });

      setInvitations(invitationsWithTeams);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleAccept = async (invitationId: string, teamId: string, role: string) => {
    setProcessingId(invitationId);
    try {
      // Add user to team
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: teamId,
          user_id: user!.id,
          role: role,
        });

      if (memberError) throw memberError;

      // Delete the invitation record
      const { error: deleteError } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (deleteError) throw deleteError;

      toast({
        title: 'Success',
        description: 'Invitation accepted successfully.',
      });

      // Remove from local state and check if we should redirect
      const updatedInvitations = invitations.filter(inv => inv.id !== invitationId);
      setInvitations(updatedInvitations);

      // If no more invites, refresh teams and redirect to dashboard
      if (updatedInvitations.length === 0) {
        await refreshTeams();
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      // Delete the invitation record
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation declined.',
      });

      // Remove from local state and check if we should redirect
      const updatedInvitations = invitations.filter(inv => inv.id !== invitationId);
      setInvitations(updatedInvitations);

      // If no more invites, redirect based on team membership
      if (updatedInvitations.length === 0) {
        const hasMembership = await checkUserTeamMembership(user!.id);
        navigate(hasMembership ? '/dashboard' : '/create-team');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading || loadingInvites) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Team Invitations</CardTitle>
          <CardDescription>
            You have pending team invitations. Accept or decline them below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {invitation.teams?.name || 'Team Invitation'}
                    </h3>
                    {invitation.inviter && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Invited by {invitation.inviter.email}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Role: <span className="capitalize">{invitation.role}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAccept(invitation.id, invitation.team_id, invitation.role)}
                      disabled={processingId === invitation.id}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDecline(invitation.id)}
                      disabled={processingId === invitation.id}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </main>
  );
};

export default AcceptInvites;
