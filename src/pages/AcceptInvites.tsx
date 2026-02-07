import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useDbProvider } from '@/hooks/useDbProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { checkUserTeamMembership } from '@/utils/teamUtils';
import { getErrorMessage } from '@/utils/errors';
import { ArrowLeft } from 'lucide-react';
import type { TeamInvitation } from '@/lib/provider/types';

const AcceptInvites = () => {
  const { user } = useAuth();
  const { refreshTeams } = useTeam();
  const { adapter } = useDbProvider();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingInvitations = useCallback(async () => {
    if (!user) return;
    
    try {
      const invites = await adapter.invitations.listMine();
      
      if (!invites.length) {
        const hasMembership = await checkUserTeamMembership(user.id);
        navigate(hasMembership ? '/dashboard' : '/create-team');
        return;
      }
      
      setInvitations(invites);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to fetch invitations'),
        variant: 'destructive',
      });
    } finally {
      setLoadingInvites(false);
    }
  }, [user, adapter.invitations, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchPendingInvitations();
    }
  }, [user, fetchPendingInvitations]);

  const handleAccept = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      await adapter.invitations.accept(invitationId);

      toast({
        title: 'Success',
        description: 'Invitation accepted successfully.',
      });

      const updatedInvitations = invitations.filter(inv => inv.id !== invitationId);
      setInvitations(updatedInvitations);

      if (updatedInvitations.length === 0) {
        await refreshTeams();
        navigate('/dashboard');
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to accept invitation'),
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setProcessingId(invitationId);
    try {
      await adapter.invitations.decline(invitationId);

      toast({
        title: 'Success',
        description: 'Invitation declined.',
      });

      const updatedInvitations = invitations.filter(inv => inv.id !== invitationId);
      setInvitations(updatedInvitations);

      if (updatedInvitations.length === 0) {
        if (!user?.id) {
          navigate('/auth');
          return;
        }
        const hasMembership = await checkUserTeamMembership(user.id);
        navigate(hasMembership ? '/dashboard' : '/create-team');
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to decline invitation'),
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loadingInvites) {
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Team Invitations</CardTitle>
              <CardDescription>
                You have pending team invitations. Accept or decline them below.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="self-start sm:self-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {invitation.team_name || 'Team Invitation'}
                    </h3>
                    {invitation.inviter_email && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Invited by {invitation.inviter_email}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      Role: <span className="capitalize">{invitation.role}</span>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      onClick={() => handleAccept(invitation.id)}
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
