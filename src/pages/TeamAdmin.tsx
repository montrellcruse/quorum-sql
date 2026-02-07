import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Trash2, UserCog, Shield, ShieldOff, UserPlus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { emailSchema } from '@/lib/validationSchemas';
import { getDbAdapter } from '@/lib/provider';
import { getErrorMessage } from '@/utils/errors';
import { FeatureGate } from '@/components/FeatureGate';
import { useSoloUser } from '@/hooks/useSoloUser';
import { getSettingsLabel } from '@/utils/terminology';

interface Team {
  id: string;
  name: string;
  approval_quota: number;
  admin_id: string;
  is_personal?: boolean;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

interface TeamInvitation {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  created_at: string;
}

const TeamAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const { activeTeam, refreshTeams } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [approvalQuota, setApprovalQuota] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [transferOwnershipDialogOpen, setTransferOwnershipDialogOpen] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');
  const resolvedTeamId = selectedTeamId || activeTeam?.id;
  const personalTeamFlag = selectedTeam?.is_personal ?? activeTeam?.isPersonal ?? false;
  const soloContext = useSoloUser({
    teamId: resolvedTeamId,
    isPersonalTeam: personalTeamFlag,
  });
  const { isSoloUser, isPersonalTeam, loading: soloLoading } = soloContext;
  const settingsLabel = soloLoading ? 'Team Administration' : getSettingsLabel(isSoloUser);

  // Helper function to check if a member is the team owner
  const isTeamOwner = (userId: string) => {
    return selectedTeam?.admin_id === userId;
  };

  const checkAdminAccess = useCallback(async () => {
    try {
      const adapter = getDbAdapter();
      const teamsForUser = await adapter.teams.listForUser();
      const adminTeams = teamsForUser.filter(t => t.role === 'admin');

      if (adminTeams.length === 0) {
        toast({
          title: 'Error',
          description: 'You do not have admin access to any team.',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setTeams(adminTeams);

      // Check if activeTeam is in the admin teams list
      const activeTeamIsAdmin = activeTeam && adminTeams.some(t => t.id === activeTeam.id);

      // Default to activeTeam if it's in admin list, otherwise first admin team
      setSelectedTeamId(activeTeamIsAdmin ? activeTeam.id : adminTeams[0].id);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load teams'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast, navigate, activeTeam]);

  const fetchTeamDetails = useCallback(async () => {
    try {
      const team = await getDbAdapter().teams.getById(selectedTeamId);
      if (!team) throw new Error('Team not found');
      setSelectedTeam(team);
      setApprovalQuota(team.approval_quota);
      setTeamName(team.name);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load team details'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, toast]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const rows = await getDbAdapter().members.list(selectedTeamId);
      setMembers(rows || []);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load team members'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, toast]);

  const fetchPendingInvitations = useCallback(async () => {
    try {
      const rows = await getDbAdapter().invitations.listByTeam(selectedTeamId);
      setInvitations(rows || []);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load invitations'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      checkAdminAccess();
    }
  }, [user, authLoading, navigate, checkAdminAccess]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamDetails();
      fetchTeamMembers();
      fetchPendingInvitations();
    }
  }, [selectedTeamId, fetchTeamDetails, fetchTeamMembers, fetchPendingInvitations]);

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    try {
      const email = newUserEmail.trim();
      if (!user?.id) {
        toast({ title: 'Error', description: 'Missing user context', variant: 'destructive' });
        return;
      }

      // Validate email using zod schema
      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        toast({
          title: 'Invalid Email',
          description: validation.error.issues[0].message,
          variant: 'destructive',
        });
        return;
      }

      await getDbAdapter().invitations.create(selectedTeamId, email, newUserRole);

      if (isPersonalTeam) {
        try {
          await getDbAdapter().teams.convertPersonal(selectedTeamId, null);
          await fetchTeamDetails();
          await refreshTeams();
        } catch (error: unknown) {
          if (import.meta.env.DEV) {
            console.error('Failed to convert personal team:', error);
          }
        }
      }

      const showSoloMessaging = !soloLoading && isSoloUser;
      toast({
        title: showSoloMessaging ? 'Collaboration Unlocked!' : 'Success',
        description: showSoloMessaging
          ? 'Invitation sent. Once they accept, your queries will require peer approval before execution.'
          : 'Invitation sent successfully.',
      });
      
      setNewUserEmail('');
      setNewUserRole('member');
      fetchPendingInvitations();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to send invitation'),
        variant: 'destructive',
      });
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await getDbAdapter().invitations.revoke(invitationId);

      toast({
        title: 'Success',
        description: 'Invitation revoked successfully.',
      });
      fetchPendingInvitations();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to revoke invitation'),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: string) => {
    try {
      // If removing an admin, check if they're the last admin
      if (memberRole === 'admin') {
        const adminCount = await getDbAdapter().members.countByRole(selectedTeamId, 'admin');
        if (adminCount <= 1) {
          toast({
            title: 'Cannot Remove',
            description: 'Cannot remove the last admin. Please transfer ownership or promote another admin first.',
            variant: 'destructive',
          });
          return;
        }
      }
      await getDbAdapter().members.remove(selectedTeamId, memberId);

      toast({
        title: 'Success',
        description: 'Member removed successfully.',
      });
      const newMemberCount = Math.max(0, members.length - 1);
      if (newMemberCount === 1) {
        toast({
          title: 'Solo Mode',
          description: "You're now the only member. Queries will auto-approve.",
        });
      }
      fetchTeamMembers();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to remove member'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    
    try {
      // If demoting from admin to member, check if they're the last admin
      if (currentRole === 'admin' && newRole === 'member') {
        const adminCount = await getDbAdapter().members.countByRole(selectedTeamId, 'admin');
        if (adminCount <= 1) {
          toast({ title: 'Cannot Demote', description: 'Cannot demote the last admin.', variant: 'destructive' });
          return;
        }
      }

      await getDbAdapter().members.updateRole(selectedTeamId, memberId, newRole);

      toast({
        title: 'Success',
        description: `Member role updated to ${newRole}.`,
      });
      fetchTeamMembers();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update member role'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateApprovalQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await getDbAdapter().teams.update(selectedTeamId, { approval_quota: approvalQuota });

      toast({
        title: 'Success',
        description: 'Approval quota updated successfully.',
      });
      fetchTeamDetails();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update approval quota'),
        variant: 'destructive',
      });
    }
  };

  const handleRenameTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      toast({ title: 'Error', description: 'Team name is required.', variant: 'destructive' });
      return;
    }

    setRenaming(true);
    try {
      await getDbAdapter().teams.update(selectedTeamId, { name: trimmedName });

      toast({
        title: 'Success',
        description: 'Workspace name updated successfully.',
      });
      await fetchTeamDetails();
      await refreshTeams();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update workspace name'),
        variant: 'destructive',
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedNewOwner) return;

    try {
      await getDbAdapter().teams.transferOwnership(selectedTeamId, selectedNewOwner);

      toast({
        title: 'Success',
        description: 'Ownership transferred successfully.',
      });
      
      setTransferOwnershipDialogOpen(false);
      fetchTeamDetails();
      fetchTeamMembers();
      checkAdminAccess();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to transfer ownership'),
        variant: 'destructive',
      });
    }
  };

  const renderInviteForm = () => (
    <form onSubmit={handleInviteUser} className="mb-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Invite User by Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            required
            maxLength={255}
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select
            value={newUserRole}
            onValueChange={(value) => setNewUserRole(value as 'admin' | 'member')}
          >
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Collaborator
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Users will be added to the team when they sign up with this email address.
      </p>
    </form>
  );

  const renderPendingInvitations = () => {
    if (invitations.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Pending Invitations</h3>
        <div className="space-y-2">
          {invitations.map(invitation => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div>
                <p className="font-medium">{invitation.invited_email}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {invitation.role} • Pending
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleRevokeInvitation(invitation.id)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }


  return (
    <main className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboard')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <h1 className="text-3xl font-bold mb-6">{settingsLabel}</h1>

      {/* Team Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Team</CardTitle>
          <CardDescription>Choose a team to manage</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTeam && (
        <>
          {/* Workspace Name */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Workspace Name</CardTitle>
              <CardDescription>
                {isPersonalTeam
                  ? 'Rename your workspace (converts to team when you add members)'
                  : "Change your team's name"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRenameTeam}>
                <div className="flex gap-2">
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="My Team"
                    maxLength={100}
                    disabled={renaming}
                  />
                  <Button type="submit" disabled={renaming}>
                    {renaming ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Renaming...
                      </>
                    ) : (
                      'Rename'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <FeatureGate teamOnly soloContext={soloContext}>
            {/* User Management */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage team members and their roles</CardDescription>
              </CardHeader>
              <CardContent>
                {renderInviteForm()}
                {renderPendingInvitations()}

                <h3 className="font-semibold mb-3">Current Members</h3>

                <div className="space-y-2">
                  {members.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {member.role === 'admin' ? (
                          <Shield className="h-5 w-5 text-primary" />
                        ) : (
                          <ShieldOff className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">{member.email}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {member.role}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* Only show role toggle if NOT the owner */}
                        {!isTeamOwner(member.user_id) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRole(member.id, member.role)}
                          >
                            <UserCog className="h-4 w-4 mr-1" />
                            Make {member.role === 'admin' ? 'Member' : 'Admin'}
                          </Button>
                        )}

                        {/* Only show delete if NOT the owner */}
                        {!isTeamOwner(member.user_id) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveMember(member.id, member.role)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Show "Team Owner" badge for the owner */}
                        {isTeamOwner(member.user_id) && (
                          <span className="text-sm text-muted-foreground px-3 py-2">
                            Team Owner
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </FeatureGate>

          <FeatureGate soloOnly soloContext={soloContext}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Collaborate with Others</CardTitle>
                <CardDescription>
                  Invite team members to collaborate on queries with peer review.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Working solo? Your queries are auto-approved. When you're ready to
                  collaborate, invite others to enable peer review workflows.
                </p>
                {renderInviteForm()}
                {renderPendingInvitations()}
              </CardContent>
            </Card>
          </FeatureGate>

          <FeatureGate teamOnly soloContext={soloContext}>
            {/* Transfer Ownership */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Transfer Ownership</CardTitle>
                <CardDescription>
                  Transfer team ownership to another member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setTransferOwnershipDialogOpen(true)}
                  disabled={members.length <= 1}
                >
                  Transfer Ownership
                </Button>
                {members.length <= 1 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You need at least one other member to transfer ownership.
                  </p>
                )}
              </CardContent>
            </Card>
          </FeatureGate>

          {/* Approval Quota */}
          <Card>
            <CardHeader>
              <CardTitle>Approval Quota</CardTitle>
              <CardDescription>
                Set the number of approvals required for queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateApprovalQuota}>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="quota">Approval Quota</Label>
                    <Input
                      id="quota"
                      type="number"
                      min="1"
                      value={approvalQuota}
                      onChange={(e) => {
                        const next = Number.parseInt(e.target.value, 10);
                        if (Number.isNaN(next)) {
                          setApprovalQuota(1);
                          return;
                        }
                        setApprovalQuota(next);
                      }}
                      required
                    />
                  </div>
                  <Button type="submit" className="mt-auto">
                    Update
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Transfer Ownership Dialog */}
      <AlertDialog open={transferOwnershipDialogOpen} onOpenChange={setTransferOwnershipDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer team ownership to another member. The new owner will become 
              the primary admin of the team. You will remain an admin but lose 
              ownership privileges. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new-owner">Select New Owner</Label>
            <Select value={selectedNewOwner} onValueChange={setSelectedNewOwner}>
              <SelectTrigger id="new-owner">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter(m => m.user_id !== selectedTeam?.admin_id)
                  .map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.email} ({member.role})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              disabled={!selectedNewOwner}
            >
              Confirm Transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

export default TeamAdmin;
