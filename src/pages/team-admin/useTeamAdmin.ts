import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';
import { emailSchema } from '@/lib/validationSchemas';
import { getErrorMessage } from '@/utils/errors';
import { useSoloUser } from '@/hooks/useSoloUser';
import { getSettingsLabel } from '@/utils/terminology';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { useAdminTeams, useTeamDetails, useTeamInvitations, useTeamMembers } from '@/hooks/useTeamMembers';
import type { Role } from '@/lib/provider/types';

export function useTeamAdmin() {
  const { user } = useAuth();
  const { activeTeam, refreshTeams } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { adapter } = useDbProvider();
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('member');
  const [approvalQuota, setApprovalQuota] = useState(1);
  const [teamName, setTeamName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [transferOwnershipDialogOpen, setTransferOwnershipDialogOpen] = useState(false);
  const [selectedNewOwner, setSelectedNewOwner] = useState<string>('');

  const adminTeamsQuery = useAdminTeams({ enabled: Boolean(user) });
  const adminTeams = useMemo(() => adminTeamsQuery.data ?? [], [adminTeamsQuery.data]);
  const teamDetailsQuery = useTeamDetails(selectedTeamId, { enabled: Boolean(selectedTeamId) });
  const selectedTeam = teamDetailsQuery.data ?? null;
  const membersQuery = useTeamMembers(selectedTeamId, { enabled: Boolean(selectedTeamId) });
  const members = membersQuery.data ?? [];
  const invitationsQuery = useTeamInvitations(selectedTeamId, { enabled: Boolean(selectedTeamId) });
  const invitations = invitationsQuery.data ?? [];

  const resolvedTeamId = selectedTeamId || activeTeam?.id;
  const personalTeamFlag = selectedTeam?.is_personal ?? activeTeam?.isPersonal ?? false;
  const soloContext = useSoloUser({
    teamId: resolvedTeamId,
    isPersonalTeam: personalTeamFlag,
  });
  const { isSoloUser, isPersonalTeam, loading: soloLoading } = soloContext;
  const settingsLabel = soloLoading ? 'Team Administration' : getSettingsLabel(isSoloUser);

  const isTeamOwner = (userId: string) => selectedTeam?.admin_id === userId;

  useEffect(() => {
    if (!user || !adminTeamsQuery.isSuccess) {
      return;
    }

    if (adminTeams.length === 0) {
      toast({
        title: 'Error',
        description: 'You do not have admin access to any team.',
        variant: 'destructive',
      });
      navigate('/dashboard');
      return;
    }

    const selectedTeamIsAdmin = adminTeams.some((team) => team.id === selectedTeamId);
    if (selectedTeamIsAdmin) {
      return;
    }

    const activeTeamIsAdmin = activeTeam
      ? adminTeams.some((team) => team.id === activeTeam.id)
      : false;
    const defaultTeamId = activeTeamIsAdmin ? activeTeam!.id : adminTeams[0].id;
    setSelectedTeamId(defaultTeamId);
  }, [
    user,
    adminTeamsQuery.isSuccess,
    adminTeams,
    selectedTeamId,
    activeTeam,
    navigate,
    toast,
  ]);

  useEffect(() => {
    if (adminTeamsQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(adminTeamsQuery.error, 'Failed to load teams'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [adminTeamsQuery.isError, adminTeamsQuery.error, navigate, toast]);

  useEffect(() => {
    if (selectedTeamId && teamDetailsQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(teamDetailsQuery.error, 'Failed to load team details'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, teamDetailsQuery.isError, teamDetailsQuery.error, toast]);

  useEffect(() => {
    if (selectedTeamId && membersQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(membersQuery.error, 'Failed to load team members'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, membersQuery.isError, membersQuery.error, toast]);

  useEffect(() => {
    if (selectedTeamId && invitationsQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(invitationsQuery.error, 'Failed to load invitations'),
        variant: 'destructive',
      });
    }
  }, [selectedTeamId, invitationsQuery.isError, invitationsQuery.error, toast]);

  useEffect(() => {
    if (!selectedTeam) {
      return;
    }
    setApprovalQuota(selectedTeam.approval_quota);
    setTeamName(selectedTeam.name);
  }, [selectedTeam]);

  const handleInviteUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!newUserEmail.trim()) {
      return;
    }

    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      const email = newUserEmail.trim();
      if (!user?.id) {
        toast({ title: 'Error', description: 'Missing user context', variant: 'destructive' });
        return;
      }

      const validation = emailSchema.safeParse(email);
      if (!validation.success) {
        toast({
          title: 'Invalid Email',
          description: validation.error.issues[0].message,
          variant: 'destructive',
        });
        return;
      }

      await adapter.invitations.create(selectedTeamId, email, newUserRole);

      if (isPersonalTeam) {
        try {
          await adapter.teams.convertPersonal(selectedTeamId);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.teams.detail(selectedTeamId),
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.teams.admin,
          });
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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.invitations(selectedTeamId),
      });
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
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      await adapter.invitations.revoke(invitationId);

      toast({
        title: 'Success',
        description: 'Invitation revoked successfully.',
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.invitations(selectedTeamId),
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to revoke invitation'),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberRole: Role) => {
    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      if (memberRole === 'admin') {
        const adminCount = members.filter((member) => member.role === 'admin').length;
        if (adminCount <= 1) {
          toast({
            title: 'Cannot Remove',
            description: 'Cannot remove the last admin. Please transfer ownership or promote another admin first.',
            variant: 'destructive',
          });
          return;
        }
      }
      await adapter.members.remove(selectedTeamId, memberId);

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
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.members(selectedTeamId),
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to remove member'),
        variant: 'destructive',
      });
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: Role) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';

    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      if (currentRole === 'admin' && newRole === 'member') {
        const adminCount = members.filter((member) => member.role === 'admin').length;
        if (adminCount <= 1) {
          toast({ title: 'Cannot Demote', description: 'Cannot demote the last admin.', variant: 'destructive' });
          return;
        }
      }

      await adapter.members.updateRole(selectedTeamId, memberId, newRole);

      toast({
        title: 'Success',
        description: `Member role updated to ${newRole}.`,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.members(selectedTeamId),
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update member role'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateApprovalQuota = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      await adapter.teams.update(selectedTeamId, { approval_quota: approvalQuota });

      toast({
        title: 'Success',
        description: 'Approval quota updated successfully.',
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.detail(selectedTeamId),
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update approval quota'),
        variant: 'destructive',
      });
    }
  };

  const handleRenameTeam = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = teamName.trim();
    if (!trimmedName) {
      toast({ title: 'Error', description: 'Team name is required.', variant: 'destructive' });
      return;
    }

    setRenaming(true);
    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      await adapter.teams.update(selectedTeamId, { name: trimmedName });

      toast({
        title: 'Success',
        description: 'Workspace name updated successfully.',
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.detail(selectedTeamId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.admin,
      });
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
    if (!selectedNewOwner) {
      return;
    }

    try {
      if (!selectedTeamId) {
        toast({ title: 'Error', description: 'Select a team first.', variant: 'destructive' });
        return;
      }
      await adapter.teams.transferOwnership(selectedTeamId, selectedNewOwner);

      toast({
        title: 'Success',
        description: 'Ownership transferred successfully.',
      });

      setTransferOwnershipDialogOpen(false);
      setSelectedNewOwner('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.detail(selectedTeamId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.members(selectedTeamId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.admin,
      });
      await refreshTeams();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to transfer ownership'),
        variant: 'destructive',
      });
    }
  };

  const loadingPage =
    adminTeamsQuery.isLoading ||
    (Boolean(selectedTeamId) && teamDetailsQuery.isLoading && !selectedTeam);

  return {
    selectedTeamId,
    setSelectedTeamId,
    selectedTeam,
    adminTeams,
    members,
    invitations,
    newUserEmail,
    setNewUserEmail,
    newUserRole,
    setNewUserRole,
    approvalQuota,
    setApprovalQuota,
    teamName,
    setTeamName,
    renaming,
    transferOwnershipDialogOpen,
    setTransferOwnershipDialogOpen,
    selectedNewOwner,
    setSelectedNewOwner,
    isSoloUser,
    isPersonalTeam,
    soloContext,
    settingsLabel,
    loadingPage,
    isTeamOwner,
    handleInviteUser,
    handleRevokeInvitation,
    handleRemoveMember,
    handleToggleRole,
    handleUpdateApprovalQuota,
    handleRenameTeam,
    handleTransferOwnership,
    navigate,
  };
}
