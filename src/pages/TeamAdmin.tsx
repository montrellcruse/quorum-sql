import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Trash2, UserCog, Shield, ShieldOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Team {
  id: string;
  name: string;
  approval_quota: number;
  admin_id: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  email?: string;
}

const TeamAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [approvalQuota, setApprovalQuota] = useState(1);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      checkAdminAccess();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamDetails();
      fetchTeamMembers();
    }
  }, [selectedTeamId]);

  const checkAdminAccess = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, approval_quota, admin_id)')
        .eq('user_id', user?.id)
        .eq('role', 'admin');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'Access Denied',
          description: 'You do not have admin access to any team.',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      const adminTeams = data.map(tm => tm.teams).filter(Boolean) as Team[];
      setTeams(adminTeams);
      if (adminTeams.length > 0) {
        setSelectedTeamId(adminTeams[0].id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', selectedTeamId)
        .single();

      if (error) throw error;
      setSelectedTeam(data);
      setApprovalQuota(data.approval_quota);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', selectedTeamId);

      if (error) throw error;

      // Fetch user emails
      const userIds = data.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const membersWithEmails = data.map(member => ({
        ...member,
        email: profiles?.find(p => p.user_id === member.user_id)?.email || 'Unknown',
      }));

      setMembers(membersWithEmails);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', newUserEmail.trim())
        .single();

      if (profileError || !profile) {
        toast({
          title: 'Error',
          description: 'User not found with this email.',
          variant: 'destructive',
        });
        return;
      }

      // Add to team
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: selectedTeamId,
          user_id: profile.user_id,
          role: 'member',
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Error',
            description: 'User is already a member of this team.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: 'Success',
        description: 'User invited successfully.',
      });
      setNewUserEmail('');
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Member removed successfully.',
      });
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Member role updated to ${newRole}.`,
      });
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateApprovalQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('teams')
        .update({ approval_quota: approvalQuota })
        .eq('id', selectedTeamId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Approval quota updated successfully.',
      });
      fetchTeamDetails();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleHandoverAdmin = async () => {
    if (!selectedNewAdmin) return;

    try {
      const { error } = await supabase
        .from('teams')
        .update({ admin_id: selectedNewAdmin })
        .eq('id', selectedTeamId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Admin role handed over successfully.',
      });
      setHandoverDialogOpen(false);
      fetchTeamDetails();
      // Recheck admin access as current user might no longer be admin
      checkAdminAccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const adminMembers = members.filter(m => m.role === 'admin');

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/dashboard')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      <h1 className="text-3xl font-bold mb-6">Team Administration</h1>

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
          {/* User Management */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage team members and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteUser} className="mb-6">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="email">Invite User by Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="mt-auto">
                    Invite
                  </Button>
                </div>
              </form>

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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleRole(member.id, member.role)}
                      >
                        <UserCog className="h-4 w-4 mr-1" />
                        Make {member.role === 'admin' ? 'Member' : 'Admin'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Handover Admin */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Handover Admin</CardTitle>
              <CardDescription>
                Transfer team ownership to another admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setHandoverDialogOpen(true)}
                disabled={adminMembers.length <= 1}
              >
                Handover Admin Role
              </Button>
              {adminMembers.length <= 1 && (
                <p className="text-sm text-muted-foreground mt-2">
                  You need at least one other admin to handover the role.
                </p>
              )}
            </CardContent>
          </Card>

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
                      onChange={(e) => setApprovalQuota(parseInt(e.target.value))}
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

      {/* Handover Dialog */}
      <AlertDialog open={handoverDialogOpen} onOpenChange={setHandoverDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Handover Admin Role</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new admin to transfer team ownership. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="new-admin">Select New Admin</Label>
            <Select value={selectedNewAdmin} onValueChange={setSelectedNewAdmin}>
              <SelectTrigger id="new-admin">
                <SelectValue placeholder="Select an admin" />
              </SelectTrigger>
              <SelectContent>
                {adminMembers
                  .filter(m => m.user_id !== selectedTeam?.admin_id)
                  .map(member => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHandoverAdmin}
              disabled={!selectedNewAdmin}
            >
              Confirm Handover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamAdmin;
