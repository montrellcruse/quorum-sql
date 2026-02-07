import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { getPendingApprovalsCount } from '@/utils/teamUtils';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import type { QueryApproval, QueryHistory, SqlQuery } from '@/lib/provider/types';

import Editor, { DiffEditor } from '@monaco-editor/react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Clock, Trash2, Copy, Check, RotateCcw, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/errors';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { useQueryApprovals, useQueryById, useQueryHistory } from '@/hooks/useQueries';

const QueryView = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
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
  const fullHistory = useMemo(
    () => queryHistoryQuery.data ?? [],
    [queryHistoryQuery.data]
  );
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
    if (!id) return;
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.detail(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.history(id) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.queries.approvals(id) });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
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
    if (!id || !user) return;
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
    // Get the previous version (next in array since sorted descending)
    const previousVersion = history[index + 1] || null;
    setPreviousHistory(previousVersion);
    setHistoryModalOpen(true);
  };

  const handleApprove = async () => {
    if (!query || !id || !user || !latestHistoryId) return;
    
    setUpdating(true);
    try {
      await adapter.queries.approve(id, latestHistoryId);
      toast({ title: 'Success', description: 'Approval recorded.' });

      // Check if we should redirect back to approvals page
      if (location.state?.from === 'approvals' && activeTeam && user?.email) {
        const remainingCount = await getPendingApprovalsCount(activeTeam.id, user.email);
        
        if (remainingCount > 0) {
          toast({
            title: 'More approvals needed',
            description: `${remainingCount} ${remainingCount === 1 ? 'query' : 'queries'} still awaiting your review`,
          });
          navigate('/approvals');
          return;
        } else {
          navigate('/approvals');
          return;
        }
      }

      // Otherwise refresh data and stay on page
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
    if (!query || !id || !latestHistoryId || !user?.id) return;
    
    setUpdating(true);
    try {
      await adapter.queries.reject(id, latestHistoryId);

      toast({
        title: 'Success',
        description: 'Query rejected and returned to draft',
      });

      // If came from approvals page, redirect back
      if (location.state?.from === 'approvals') {
        // Check if there are more approvals
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

      // Otherwise refresh data and stay on page
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
    if (!query) return;

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
    if (!query?.sql_content) return;

    try {
      await navigator.clipboard.writeText(query.sql_content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const handleRevert = async () => {
    if (!selectedHistory || !id || !user) return;
    
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

  const canRevert = selectedHistory && 
                    query?.sql_content !== selectedHistory.sql_content &&
                    query?.status !== 'pending_approval';

  const canApprove = query?.status === 'pending_approval' && 
                     query?.last_modified_by_email !== user?.email &&
                     !hasUserApproved;
  
  const canReject = query?.status === 'pending_approval' && 
                    query?.last_modified_by_email !== user?.email;

  const canSubmitForApproval = query?.status === 'draft';

  const canDeleteQuery = () => {
    if (!query || !user || !activeTeam) return false;
    const isOwner = query.user_id === user.id;
    const isAdmin = activeTeam.role === 'admin';
    return isOwner || isAdmin;
  };

  const handleSubmitForApproval = async () => {
    if (!query || !id || !user || !activeTeam) return;
    
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

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
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

  if (loading || loadingQuery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!query) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(`/folder/${query.folder_id}`)}
            className="self-start"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Folder
          </Button>

          <div className="flex flex-wrap gap-2">
            {query?.status === 'pending_approval' && (
              <>
                <Button 
                  onClick={handleApprove} 
                  disabled={updating || !canApprove}
                >
                  {updating ? 'Processing...' : hasUserApproved ? 'Already Approved' : 'Approve'}
                </Button>
                {canReject && (
                  <Button 
                    onClick={handleReject} 
                    disabled={updating}
                    variant="outline"
                  >
                    {updating ? 'Processing...' : 'Reject'}
                  </Button>
                )}
              </>
            )}
            <Button onClick={() => navigate(`/query/edit/${query.id}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Query
            </Button>
            {canSubmitForApproval && (
              <Button 
                onClick={() => setSubmitDialogOpen(true)}
                variant="secondary"
              >
                <Send className="mr-2 h-4 w-4" />
                Submit for Approval
              </Button>
            )}
            {canDeleteQuery() && (
              <Button 
                onClick={() => setDeleteDialogOpen(true)} 
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Query
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <CardTitle className="break-words">{query.title}</CardTitle>
              <Badge variant={getStatusVariant(query.status)}>
                {query.status === 'pending_approval' ? 'Pending Approval' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
              </Badge>
              {query.status === 'pending_approval' && (
                <Badge variant="outline">
                  Approvals: {approvals.length} / {approvalQuota}
                </Badge>
              )}
            </div>
            {query.description && (
              <CardDescription>{query.description}</CardDescription>
            )}
            <div className="mt-4 space-y-1 text-sm">
              {query.created_by_email && (
                <p className="text-muted-foreground">
                  Created by {query.created_by_email}
                </p>
              )}
              {query.last_modified_by_email && (
                <p className="text-muted-foreground">
                  Last modified by {query.last_modified_by_email}
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <Label>SQL Content</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopySql}
                  className="h-8"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy SQL
                    </>
                  )}
                </Button>
              </div>
              <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <Editor
                  height="300px"
                  defaultLanguage="sql"
                  value={query.sql_content}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Change History</CardTitle>
            <CardDescription>
              View all previous versions of this query
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-muted-foreground">Loading history...</p>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map((record, index) => (
                  <button
                    key={record.id}
                    onClick={() => handleHistoryClick(record, index)}
                    className="w-full flex items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{record.modified_by_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(record.created_at)}
                      </p>
                      {record.change_reason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {record.change_reason}
                        </p>
                      )}
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No change history yet</p>
            )}
          </CardContent>
        </Card>

        <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Query History Comparison</DialogTitle>
              <DialogDescription>
                Compare this historical version with the current query
              </DialogDescription>
            </DialogHeader>
            {selectedHistory && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium">Version Modified By:</p>
                  <p className="text-muted-foreground">{selectedHistory.modified_by_email}</p>
                  <p className="text-muted-foreground">{formatDate(selectedHistory.created_at)}</p>
                  {selectedHistory.change_reason && (
                    <div className="mt-2">
                      <p className="font-medium">Change Reason:</p>
                      <p className="text-muted-foreground italic">{selectedHistory.change_reason}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">
                      {previousHistory ? `Previous Version (${formatDate(previousHistory.created_at)})` : 'No Previous Version'}
                    </span>
                    <span className="text-muted-foreground">
                      {`Selected Version (${formatDate(selectedHistory.created_at)})`}
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                    <DiffEditor
                      height="500px"
                      language="sql"
                      original={previousHistory?.sql_content || ''}
                      modified={selectedHistory.sql_content}
                      theme={theme === 'dark' ? 'vs-dark' : 'light'}
                      options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        wordWrap: 'on',
                        automaticLayout: true,
                        useInlineViewWhenSpaceIsLimited: false,
                      }}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => setRevertDialogOpen(true)}
                    variant="outline"
                    disabled={!canRevert || reverting}
                    className="flex-1"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Revert to this Version
                  </Button>
                  <Button onClick={() => setHistoryModalOpen(false)} className="flex-1">
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revert to Previous Version?</AlertDialogTitle>
              <AlertDialogDescription>
                This will replace the current SQL content with the version from{' '}
                <strong>{selectedHistory && formatDate(selectedHistory.created_at)}</strong>{' '}
                by <strong>{selectedHistory?.modified_by_email}</strong>.
                <br /><br />
                The query will be set to <strong>draft</strong> status and will need 
                to go through the approval process again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reverting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevert} disabled={reverting}>
                {reverting ? 'Reverting...' : 'Revert'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete this query and its entire history? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteQuery} 
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Query
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Query for Approval</AlertDialogTitle>
              <AlertDialogDescription>
                This will submit the current query for team approval. 
                Optionally provide a reason for this submission.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="changeReason">Change Reason (optional)</Label>
              <Textarea
                id="changeReason"
                placeholder="Describe what changed or why this is being submitted..."
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmitForApproval} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
};

export default QueryView;
