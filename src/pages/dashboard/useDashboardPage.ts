import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { getAuthAdapter } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errors';
import { useSoloUser } from '@/hooks/useSoloUser';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { useTeamFolders } from '@/hooks/useTeamFolders';
import { useSearchQueriesMutation } from '@/hooks/useQueries';
import { usePendingApprovalsCount, usePendingInvitesCount } from '@/hooks/usePendingApprovals';
import { useAdminTeams } from '@/hooks/useTeamMembers';

interface NewFolderForm {
  name: string;
  description: string;
}

const INITIAL_NEW_FOLDER: NewFolderForm = {
  name: '',
  description: '',
};

export function useDashboardPage() {
  const { user } = useAuth();
  const { activeTeam, userTeams, setActiveTeam, loading: teamLoading } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { adapter } = useDbProvider();
  const queryClient = useQueryClient();

  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolder, setNewFolder] = useState<NewFolderForm>(INITIAL_NEW_FOLDER);
  const [searchTerm, setSearchTerm] = useState('');

  const authAdapter = getAuthAdapter();
  const activeTeamId = activeTeam?.id;
  const soloContext = useSoloUser();

  const foldersQuery = useTeamFolders(activeTeamId, {
    enabled: Boolean(user && activeTeamId),
    rootOnly: true,
  });
  const adminTeamsQuery = useAdminTeams({ enabled: Boolean(user) });
  const pendingInvitesCountQuery = usePendingInvitesCount(user?.email, {
    enabled: Boolean(user?.email),
  });
  const pendingApprovalsCountQuery = usePendingApprovalsCount(activeTeamId, user?.email, {
    enabled: Boolean(user?.email && activeTeamId),
  });
  const searchQueriesMutation = useSearchQueriesMutation(activeTeamId);

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      if (!activeTeam) {
        throw new Error('No active team selected');
      }

      const trimmedName = newFolder.name.trim();
      const allFolders = await adapter.folders.listByTeam(activeTeam.id);
      const duplicateFolder = allFolders.find(
        (folder) =>
          folder.parent_folder_id == null &&
          folder.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (duplicateFolder) {
        throw new Error('A folder with this name already exists at the root.');
      }

      await adapter.folders.create({
        name: trimmedName,
        description: newFolder.description,
        user_id: user?.id ?? '',
        created_by_email: user?.email || '',
        parent_folder_id: null,
        team_id: activeTeam.id,
      });
    },
    onSuccess: async () => {
      toast({
        title: 'Success',
        description: 'Folder created successfully',
      });
      setNewFolder(INITIAL_NEW_FOLDER);
      setCreateFolderDialogOpen(false);
      if (activeTeamId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.folders.byTeam(activeTeamId),
        });
      }
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to create folder'),
        variant: 'destructive',
      });
    },
  });

  const projects = foldersQuery.data ?? [];
  const loadingProjects = foldersQuery.isLoading;
  const pendingInvitesCount = pendingInvitesCountQuery.data ?? 0;
  const pendingApprovalsCount = pendingApprovalsCountQuery.data ?? 0;
  const searchResults = searchQueriesMutation.data ?? [];
  const searching = searchQueriesMutation.isPending;
  const isAdmin = Boolean(
    activeTeamId && adminTeamsQuery.data?.some((team) => team.id === activeTeamId)
  );

  useEffect(() => {
    if (foldersQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(foldersQuery.error, 'Failed to fetch projects'),
        variant: 'destructive',
      });
    }
  }, [foldersQuery.isError, foldersQuery.error, toast]);

  useEffect(() => {
    if (adminTeamsQuery.isError && import.meta.env.DEV) {
      console.error(
        'Error checking admin status:',
        getErrorMessage(adminTeamsQuery.error, 'Unknown error')
      );
    }
  }, [adminTeamsQuery.isError, adminTeamsQuery.error]);

  const handleCreateFolder = async () => {
    if (!newFolder.name.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name is required',
        variant: 'destructive',
      });
      return;
    }

    if (!activeTeam) {
      toast({
        title: 'Error',
        description: 'No active team selected',
        variant: 'destructive',
      });
      return;
    }

    await createFolderMutation.mutateAsync();
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!searchTerm.trim()) {
      searchQueriesMutation.reset();
      return;
    }

    if (!activeTeam) {
      return;
    }

    try {
      await searchQueriesMutation.mutateAsync(searchTerm);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to search queries'),
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await authAdapter.signOut();
      toast({ title: 'Signed out', description: 'Successfully signed out.' });
      navigate('/auth?signout=1');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to sign out'),
        variant: 'destructive',
      });
    }
  };

  const handleTeamChange = (teamId: string) => {
    const nextTeam = userTeams.find((team) => team.id === teamId);
    if (nextTeam) {
      setActiveTeam(nextTeam);
    }
  };

  return {
    user,
    activeTeam,
    userTeams,
    teamLoading,
    isSoloUser: soloContext.isSoloUser,
    soloContext,
    createFolderDialogOpen,
    setCreateFolderDialogOpen,
    newFolder,
    setNewFolder,
    searchTerm,
    setSearchTerm,
    projects,
    loadingProjects,
    loadingFoldersError: foldersQuery.isError,
    pendingInvitesCount,
    pendingApprovalsCount,
    searchResults,
    searching,
    isAdmin,
    createFolderPending: createFolderMutation.isPending,
    handleCreateFolder,
    handleSearch,
    handleSignOut,
    handleTeamChange,
    navigate,
  };
}
