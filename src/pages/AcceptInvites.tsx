import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  teams: {
    name: string;
  };
}

const AcceptInvites = () => {
  const { user, loading } = useAuth();
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user!.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, team_id, invited_email, role, teams(name)')
        .eq('invited_email', profile.email)
        .eq('status', 'pending');

      if (error) throw error;

      setInvitations(data || []);

      // If no pending invites, redirect based on team membership
      if (!data || data.length === 0) {
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

      // Update invitation status
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Invitation accepted successfully.',
      });

      // Remove from local state
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // If no more invites, redirect
      if (invitations.length === 1) {
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
      const { error } = await supabase
        .from('team_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation declined.',
      });

      // Remove from local state
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));

      // If no more invites, redirect based on team membership
      if (invitations.length === 1) {
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
                    <h3 className="font-semibold">{invitation.teams.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Role: {invitation.role}
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
    </div>
  );
};

export default AcceptInvites;
