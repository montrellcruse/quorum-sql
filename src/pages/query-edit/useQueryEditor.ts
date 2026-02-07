import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useToast } from '@/hooks/use-toast';
import { querySchema, changeReasonSchema, validateSqlSafety } from '@/lib/validationSchemas';
import { getErrorMessage } from '@/utils/errors';
import type { QueryStatus, SqlQuery } from '@/lib/provider/types';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { useQueryById, useQueryHistory } from '@/hooks/useQueries';
import { useTeamFolderPaths } from '@/hooks/useTeamFolders';

export function useQueryEditor() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const { activeTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { adapter } = useDbProvider();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState<SqlQuery | null>(null);
  const [hasInitializedQuery, setHasInitializedQuery] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');
  const [sqlWarnings, setSqlWarnings] = useState<string[]>([]);

  const isNewQuery = id === 'new';
  const folderId = location.state?.folderId;
  const queryId = isNewQuery ? undefined : id;

  const queryByIdQuery = useQueryById(queryId, {
    enabled: Boolean(user && queryId),
  });
  const queryHistoryQuery = useQueryHistory(queryId, {
    enabled: Boolean(user && queryId),
  });
  const folderPathsQuery = useTeamFolderPaths(activeTeam?.id, {
    enabled: Boolean(activeTeam?.id && moveDialogOpen),
  });
  const folders = (folderPathsQuery.data ?? []).filter((folder) => folder.id !== query?.folder_id);

  useEffect(() => {
    if (query?.sql_content) {
      const { warnings } = validateSqlSafety(query.sql_content);
      setSqlWarnings(warnings);
    } else {
      setSqlWarnings([]);
    }
  }, [query?.sql_content]);

  useEffect(() => {
    setHasInitializedQuery(false);
    setQuery(null);
  }, [id, isNewQuery]);

  useEffect(() => {
    if (!user || hasInitializedQuery) {
      return;
    }

    if (isNewQuery) {
      if (!folderId) {
        toast({
          title: 'Error',
          description: 'Folder ID is required',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }
      setQuery({
        id: '',
        title: '',
        description: '',
        sql_content: '',
        status: 'draft',
        team_id: '',
        folder_id: folderId,
        last_modified_by_email: null,
        created_by_email: null,
      });
      setHasInitializedQuery(true);
      return;
    }

    if (queryByIdQuery.isSuccess && queryByIdQuery.data) {
      setQuery(queryByIdQuery.data);
      setHasInitializedQuery(true);
    }
  }, [
    user,
    hasInitializedQuery,
    isNewQuery,
    folderId,
    queryByIdQuery.isSuccess,
    queryByIdQuery.data,
    navigate,
    toast,
  ]);

  useEffect(() => {
    if (!isNewQuery && queryByIdQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(queryByIdQuery.error, 'Failed to fetch query'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [isNewQuery, queryByIdQuery.isError, queryByIdQuery.error, navigate, toast]);

  useEffect(() => {
    if (!isNewQuery && queryByIdQuery.isSuccess && !queryByIdQuery.data) {
      toast({
        title: 'Error',
        description: 'Query not found',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [isNewQuery, queryByIdQuery.isSuccess, queryByIdQuery.data, navigate, toast]);

  useEffect(() => {
    if (moveDialogOpen && folderPathsQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(folderPathsQuery.error, 'Failed to load folders'),
        variant: 'destructive',
      });
    }
  }, [moveDialogOpen, folderPathsQuery.isError, folderPathsQuery.error, toast]);

  const saveQueryMutation = useMutation({
    mutationFn: async (newStatus: QueryStatus) => {
      if (!query) {
        throw new Error('Query is not loaded');
      }
      if (!user?.id) {
        throw new Error('User is not authenticated');
      }

      const userId = user.id;
      const userEmail = user.email || '';
      const teamId = activeTeam?.id;
      let resolvedTeamId = teamId;
      let resolvedQueryId = isNewQuery ? '' : (id ?? '');

      if (isNewQuery) {
        if (!resolvedTeamId) {
          const folder = await adapter.folders.getById(query.folder_id);
          resolvedTeamId = folder?.team_id;
        }
        if (!resolvedTeamId) {
          throw new Error('Active team is required to create a query');
        }
        const created = await adapter.queries.create({
          title: query.title,
          description: query.description,
          sql_content: query.sql_content,
          status: newStatus,
          folder_id: query.folder_id,
          team_id: resolvedTeamId,
          created_by_email: userEmail,
          last_modified_by_email: userEmail,
        });
        resolvedQueryId = created.id;
      } else {
        if (!resolvedQueryId) {
          throw new Error('Missing query ID');
        }
        await adapter.queries.update(resolvedQueryId, {
          title: query.title,
          description: query.description,
          sql_content: query.sql_content,
          status: newStatus,
          last_modified_by_email: userEmail,
        });
      }

      if (!resolvedQueryId) {
        throw new Error('Failed to resolve query ID');
      }

      if (newStatus === 'pending_approval') {
        await adapter.queries.submitForApproval(resolvedQueryId, query.sql_content, {
          modified_by_email: userEmail,
          change_reason: changeReason.trim() || null,
          team_id: resolvedTeamId,
          user_id: userId,
        });
      }

      return { queryId: resolvedQueryId, folderId: query.folder_id, status: newStatus };
    },
  });

  const createNewDraftMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Missing query ID');
      }
      await adapter.queries.update(id, { status: 'draft' });
    },
  });

  const discardDraftMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Missing query ID');
      }

      const history = queryHistoryQuery.data ?? (await queryHistoryQuery.refetch()).data ?? [];
      const approvedHistory = history.find((entry) => entry.status === 'approved');

      if (approvedHistory) {
        await adapter.queries.update(id, {
          sql_content: approvedHistory.sql_content,
          status: 'approved',
          last_modified_by_email: approvedHistory.modified_by_email,
        });
        return { revertedToApproved: true };
      }

      await adapter.queries.remove(id);
      return { revertedToApproved: false };
    },
  });

  const moveQueryMutation = useMutation({
    mutationFn: async (nextFolderId: string) => {
      if (!id) {
        throw new Error('Missing query ID');
      }
      await adapter.queries.update(id, { folder_id: nextFolderId });
    },
  });

  const saving =
    saveQueryMutation.isPending ||
    createNewDraftMutation.isPending ||
    discardDraftMutation.isPending ||
    moveQueryMutation.isPending;

  const handleSave = async (newStatus: QueryStatus) => {
    const validation = querySchema.safeParse({
      title: query?.title,
      description: query?.description,
      sql_content: query?.sql_content,
    });

    if (!validation.success) {
      toast({
        title: 'Validation Error',
        description: validation.error.issues[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (newStatus === 'pending_approval') {
      const reasonValidation = changeReasonSchema.safeParse(changeReason);
      if (!reasonValidation.success) {
        toast({
          title: 'Invalid Change Reason',
          description: reasonValidation.error.issues[0].message,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const result = await saveQueryMutation.mutateAsync(newStatus);
      if (newStatus === 'pending_approval') {
        setChangeReason('');
        toast({ title: 'Success', description: 'Query submitted for approval' });
      } else {
        toast({
          title: 'Success',
          description:
            newStatus === 'approved'
              ? 'Query approved'
              : newStatus === 'draft'
                ? 'Query saved as draft'
                : 'Query updated',
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.queries.detail(result.queryId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.queries.history(result.queryId) });
      navigate(`/folder/${result.folderId}`);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to save query'),
        variant: 'destructive',
      });
    }
  };

  const handleCreateNewDraft = async () => {
    try {
      await createNewDraftMutation.mutateAsync();
      setQuery((previous) => (previous ? { ...previous, status: 'draft' } : previous));
      if (id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.queries.detail(id) });
      }
      toast({
        title: 'Success',
        description: 'Query converted to draft',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to create draft'),
        variant: 'destructive',
      });
    }
  };

  const handleDiscardDraft = async () => {
    try {
      const result = await discardDraftMutation.mutateAsync();
      if (result.revertedToApproved && id) {
        toast({
          title: 'Success',
          description: 'Draft discarded and reverted to last approved version',
        });
        navigate(`/query/view/${id}`);
      } else {
        toast({ title: 'Success', description: 'Draft discarded successfully' });
        navigate(`/folder/${query?.folder_id}`);
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to discard draft'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleOpenMoveDialog = () => {
    setSelectedFolderId(query?.folder_id || '');
    setMoveDialogOpen(true);
  };

  const handleMove = async () => {
    if (!selectedFolderId || !query) {
      toast({
        title: 'Error',
        description: 'Please select a folder',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFolderId === query.folder_id) {
      toast({
        title: 'Error',
        description: 'Query is already in this folder',
        variant: 'destructive',
      });
      return;
    }

    try {
      await moveQueryMutation.mutateAsync(selectedFolderId);
      if (id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.queries.detail(id) });
      }
      toast({
        title: 'Success',
        description: 'Query moved successfully',
      });
      navigate(`/folder/${selectedFolderId}`);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to move query'),
        variant: 'destructive',
      });
    } finally {
      setMoveDialogOpen(false);
    }
  };

  const loadingQuery =
    isNewQuery
      ? !query
      : queryByIdQuery.isLoading ||
        (queryByIdQuery.isSuccess && Boolean(queryByIdQuery.data) && !query);

  const isEditable = query?.status === 'draft' || isNewQuery;

  return {
    id,
    query,
    setQuery,
    isNewQuery,
    theme,
    folders,
    loadingFoldersForMove: folderPathsQuery.isLoading,
    sqlWarnings,
    saving,
    loadingQuery,
    isEditable,
    deleteDialogOpen,
    setDeleteDialogOpen,
    moveDialogOpen,
    setMoveDialogOpen,
    approvalDialogOpen,
    setApprovalDialogOpen,
    selectedFolderId,
    setSelectedFolderId,
    changeReason,
    setChangeReason,
    handleSave,
    handleCreateNewDraft,
    handleDiscardDraft,
    handleOpenMoveDialog,
    handleMove,
    navigate,
  };
}
