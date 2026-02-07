import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { getPendingApprovalsCount } from '@/utils/teamUtils';
import { useToast } from '@/hooks/use-toast';
import type { QueryApproval, QueryHistory, SqlQuery } from '@/lib/provider/types';
import { getErrorMessage } from '@/utils/errors';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { useQueryApprovals, useQueryById, useQueryHistory } from '@/hooks/useQueries';

export function useQueryView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { activeTeam } = useTeam();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { adapter } = useDbProvider();
  const queryClient = useQueryClient();

  const [selectedHistory, setSelectedHistory] = useState<QueryHistory | null>(null);
  const [previousHistory, setPreviousHistory] = useState<QueryHistory | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [changeReason, setChangeReason] = useState('');

  const queryByIdQuery = useQueryById(id, {
    enabled: Boolean(user && id),
  });
  const queryHistoryQuery = useQueryHistory(id, {
    enabled: Boolean(user && id),
  });

  const query: SqlQuery | null = queryByIdQuery.data ?? null;
  const fullHistory = useMemo(() => queryHistoryQuery.data ?? [], [queryHistoryQuery.data]);
  const history = useMemo(
    () => fullHistory.filter((record) => record.status === 'approved'),
    [fullHistory]
  );
  const latestPendingHistory = useMemo(
    () => fullHistory.find((record) => record.status === 'pending_approval') ?? null,
    [fullHistory]
  );

  const queryApprovalsQuery = useQueryApprovals(id, {
    enabled: Boolean(user && id && query?.status === 'pending_approval'),
  });
  const latestHistoryId =
    queryApprovalsQuery.data?.latest_history_id ?? latestPendingHistory?.id ?? null;
  const approvals: QueryApproval[] = queryApprovalsQuery.data?.approvals ?? [];
  const approvalQuota = queryApprovalsQuery.data?.approval_quota ?? 1;
  const hasUserApproved = approvals.some((approval) => approval.user_id === user?.id);
  const loadingQuery = queryByIdQuery.isLoading;
  const loadingHistory = queryHistoryQuery.isLoading;

  const invalidateQueryData = async () => {
    if (!id) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.detail(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.history(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.approvals(id) });
  };

  useEffect(() => {
    if (!id || !user) {
      return;
    }
    if (queryByIdQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(queryByIdQuery.error, 'Failed to fetch query'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [id, user, queryByIdQuery.isError, queryByIdQuery.error, navigate, toast]);

  useEffect(() => {
    if (!id || !user) {
      return;
    }
    if (queryByIdQuery.isSuccess && !queryByIdQuery.data) {
      toast({
        title: 'Error',
        description: 'Query not found',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [id, user, queryByIdQuery.isSuccess, queryByIdQuery.data, navigate, toast]);

  useEffect(() => {
    if (queryHistoryQuery.isError) {
      toast({
        title: 'Error',
        description: getErrorMessage(queryHistoryQuery.error, 'Failed to fetch history'),
        variant: 'destructive',
      });
    }
  }, [queryHistoryQuery.isError, queryHistoryQuery.error, toast]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleHistoryClick = (record: QueryHistory, index: number) => {
    setSelectedHistory(record);
    const previousVersion = history[index + 1] || null;
    setPreviousHistory(previousVersion);
    setHistoryModalOpen(true);
  };

  const handleApprove = async () => {
    if (!query || !id || !user || !latestHistoryId) {
      return;
    }

    setUpdating(true);
    try {
      await adapter.queries.approve(id, latestHistoryId);
      toast({ title: 'Success', description: 'Approval recorded.' });

      if (location.state?.from === 'approvals' && activeTeam && user?.email) {
        const remainingCount = await getPendingApprovalsCount(activeTeam.id, user.email);

        if (remainingCount > 0) {
          toast({
            title: 'More approvals needed',
            description: `${remainingCount} ${remainingCount === 1 ? 'query' : 'queries'} still awaiting your review`,
          });
          navigate('/approvals');
          return;
        }
        navigate('/approvals');
        return;
      }

      await invalidateQueryData();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to approve query'),
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!query || !id || !latestHistoryId || !user?.id) {
      return;
    }

    setUpdating(true);
    try {
      await adapter.queries.reject(id, latestHistoryId);

      toast({
        title: 'Success',
        description: 'Query rejected and returned to draft',
      });

      if (location.state?.from === 'approvals') {
        if (activeTeam && user?.email) {
          const remainingCount = await getPendingApprovalsCount(activeTeam.id, user.email);

          if (remainingCount > 0) {
            toast({
              title: 'More approvals needed',
              description: `${remainingCount} ${remainingCount === 1 ? 'query' : 'queries'} still awaiting your review`,
            });
          }
        }
        navigate('/approvals');
        return;
      }

      await invalidateQueryData();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to reject query'),
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteQuery = async () => {
    if (!query) {
      return;
    }

    try {
      await adapter.queries.remove(query.id);

      toast({
        title: 'Success',
        description: 'Query permanently deleted',
      });

      navigate(`/folder/${query.folder_id}`);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to delete query'),
        variant: 'destructive',
      });
    }
  };

  const handleCopySql = async () => {
    if (!query?.sql_content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(query.sql_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleRevert = async () => {
    if (!selectedHistory || !id || !user) {
      return;
    }

    setReverting(true);
    try {
      await adapter.queries.update(id, {
        sql_content: selectedHistory.sql_content,
        status: 'draft',
        last_modified_by_email: user.email,
      });

      toast({
        title: 'Success',
        description: 'Query reverted to previous version. Submit for approval when ready.',
      });

      setRevertDialogOpen(false);
      setHistoryModalOpen(false);
      await invalidateQueryData();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to revert query'),
        variant: 'destructive',
      });
    } finally {
      setReverting(false);
    }
  };

  const canRevert =
    Boolean(selectedHistory) &&
    query?.sql_content !== selectedHistory?.sql_content &&
    query?.status !== 'pending_approval';

  const canApprove =
    query?.status === 'pending_approval' &&
    query?.last_modified_by_email !== user?.email &&
    !hasUserApproved;

  const canReject =
    query?.status === 'pending_approval' && query?.last_modified_by_email !== user?.email;

  const canSubmitForApproval = query?.status === 'draft';

  const canDeleteQuery = () => {
    if (!query || !user || !activeTeam) {
      return false;
    }
    const isOwner = query.user_id === user.id;
    const isAdmin = activeTeam.role === 'admin';
    return isOwner || isAdmin;
  };

  const handleSubmitForApproval = async () => {
    if (!query || !id || !user || !activeTeam) {
      return;
    }

    setSubmitting(true);
    try {
      await adapter.queries.submitForApproval(id, query.sql_content, {
        modified_by_email: user.email || '',
        change_reason: changeReason.trim() || null,
        team_id: activeTeam.id,
        user_id: user.id,
      });
      toast({ title: 'Success', description: 'Query submitted for approval' });

      setSubmitDialogOpen(false);
      setChangeReason('');
      await invalidateQueryData();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to submit query for approval'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'pending_approval':
        return 'secondary';
      case 'draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return {
    id,
    user,
    query,
    history,
    selectedHistory,
    previousHistory,
    approvals,
    approvalQuota,
    hasUserApproved,
    loadingQuery,
    loadingHistory,
    updating,
    copied,
    revertDialogOpen,
    deleteDialogOpen,
    submitDialogOpen,
    historyModalOpen,
    reverting,
    submitting,
    changeReason,
    canRevert,
    canApprove,
    canReject,
    canSubmitForApproval,
    getStatusVariant,
    formatDate,
    setHistoryModalOpen,
    setRevertDialogOpen,
    setDeleteDialogOpen,
    setSubmitDialogOpen,
    setChangeReason,
    handleHistoryClick,
    handleApprove,
    handleReject,
    handleDeleteQuery,
    handleCopySql,
    handleRevert,
    canDeleteQuery,
    handleSubmitForApproval,
    navigate,
    theme,
  };
}
