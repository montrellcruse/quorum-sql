import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import CodeEditor from '@uiw/react-textarea-code-editor';
import rehypePrism from 'rehype-prism-plus';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Clock, Trash2 } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer';

interface Query {
  id: string;
  title: string;
  description: string | null;
  sql_content: string;
  status: string;
  folder_id: string;
  team_id: string;
  user_id: string;
  created_by_email: string | null;
  last_modified_by_email: string | null;
}

interface HistoryRecord {
  id: string;
  modified_by_email: string;
  created_at: string;
  sql_content: string;
  change_reason: string | null;
  status: string;
}

interface Approval {
  id: string;
  user_id: string;
  created_at: string;
}

const QueryView = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { activeTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState<Query | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(true);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<HistoryRecord | null>(null);
  const [previousHistory, setPreviousHistory] = useState<HistoryRecord | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approvalQuota, setApprovalQuota] = useState(1);
  const [latestHistoryId, setLatestHistoryId] = useState<string | null>(null);
  const [hasUserApproved, setHasUserApproved] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchQuery();
      fetchHistory();
    }
  }, [user, id]);

  useEffect(() => {
    if (query?.status === 'pending_approval') {
      fetchApprovals();
    }
  }, [query?.status, latestHistoryId]);

  const fetchQuery = async () => {
    try {
      const { data, error } = await supabase
        .from('sql_queries')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: 'Error',
          description: 'Query not found',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setQuery(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoadingQuery(false);
    }
  };

  const fetchHistory = async () => {
    if (!id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('query_history')
        .select('*')
        .eq('query_id', id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      // Get approved history for display
      const approvedHistory = (data || []).filter(h => h.status === 'approved');
      setHistory(approvedHistory);
      
      // Get latest pending approval history
      const pendingHistory = (data || []).find(h => h.status === 'pending_approval');
      if (pendingHistory) {
        setLatestHistoryId(pendingHistory.id);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchApprovals = async () => {
    if (!latestHistoryId) return;

    try {
      // Fetch team approval quota
      const { data: queryData, error: queryError } = await supabase
        .from('sql_queries')
        .select('team_id, teams(approval_quota)')
        .eq('id', id)
        .single();

      if (queryError) throw queryError;
      
      const quota = (queryData as any)?.teams?.approval_quota || 1;
      setApprovalQuota(quota);

      // Fetch approvals for this history record
      const { data: approvalsData, error: approvalsError } = await supabase
        .from('query_approvals')
        .select('*')
        .eq('query_history_id', latestHistoryId);

      if (approvalsError) throw approvalsError;
      
      setApprovals(approvalsData || []);
      
      // Check if current user has approved
      const userApproval = (approvalsData || []).some(a => a.user_id === user?.id);
      setHasUserApproved(userApproval);
    } catch (error: any) {
      console.error('Error fetching approvals:', error);
    }
  };

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

  const handleHistoryClick = (record: HistoryRecord, index: number) => {
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
      // Call the security definer function
      const { data, error } = await supabase.rpc('approve_query_with_quota', {
        _query_id: id,
        _query_history_id: latestHistoryId,
        _approver_user_id: user.id,
      });

      if (error) throw error;

      const result = data as any;

      if (!result.success) {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
        return;
      }

      if (result.approved) {
        toast({
          title: 'Success',
          description: `${result.message} (${result.approval_count}/${result.approval_quota} approvals reached)`,
        });
      } else {
        toast({
          title: 'Approval Recorded',
          description: `${result.message} (${result.approval_count}/${result.approval_quota} approvals)`,
        });
      }

      // Force full refresh of all data
      await fetchQuery();
      await fetchHistory();
      await fetchApprovals();
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!query || !id || !latestHistoryId) return;
    
    setUpdating(true);
    try {
      // Update query status to draft
      const { error: queryError } = await supabase
        .from('sql_queries')
        .update({ status: 'draft' })
        .eq('id', id);

      if (queryError) throw queryError;

      // Update history status to rejected
      const { error: historyError } = await supabase
        .from('query_history')
        .update({ status: 'rejected' })
        .eq('id', latestHistoryId);

      if (historyError) throw historyError;

      // Clear all approvals for this history record
      const { error: clearError } = await supabase
        .from('query_approvals')
        .delete()
        .eq('query_history_id', latestHistoryId);

      if (clearError) throw clearError;

      toast({
        title: 'Success',
        description: 'Query rejected and returned to draft',
      });

      // Refresh data
      await fetchQuery();
      await fetchHistory();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteQuery = async () => {
    if (!query) return;

    try {
      const { error } = await supabase
        .from('sql_queries')
        .delete()
        .eq('id', query.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Query permanently deleted',
      });

      navigate(`/folder/${query.folder_id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const canApprove = query?.status === 'pending_approval' && 
                     query?.last_modified_by_email !== user?.email &&
                     !hasUserApproved;
  
  const canReject = query?.status === 'pending_approval' && 
                    query?.last_modified_by_email !== user?.email;

  const canDeleteQuery = () => {
    if (!query || !user || !activeTeam) return false;
    const isOwner = query.user_id === user.id;
    const isAdmin = activeTeam.role === 'admin';
    return isOwner || isAdmin;
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
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(`/folder/${query.folder_id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Folder
          </Button>
          
          <div className="flex gap-2">
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
            <div className="flex items-center gap-2 mb-2">
              <CardTitle>{query.title}</CardTitle>
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
              <Label>SQL Content</Label>
              <CodeEditor
                value={query.sql_content}
                language="sql"
                readOnly={true}
                padding={15}
                rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}
                data-color-mode="light"
                style={{
                  fontSize: 14,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  backgroundColor: '#f4f4f4',
                  border: '1px solid #e0e0e0',
                  borderRadius: '0.375rem',
                  minHeight: '300px',
                }}
              />
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
                
                <div className="rounded-lg overflow-hidden border">
                  <ReactDiffViewer
                    oldValue={previousHistory?.sql_content || ''}
                    newValue={selectedHistory.sql_content}
                    splitView={true}
                    leftTitle={previousHistory ? `Previous Version (${formatDate(previousHistory.created_at)})` : 'No Previous Version'}
                    rightTitle={`Selected Version (${formatDate(selectedHistory.created_at)})`}
                    showDiffOnly={false}
                    useDarkTheme={false}
                  />
                </div>
                
                <Button onClick={() => setHistoryModalOpen(false)} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
      </div>
    </div>
  );
};

export default QueryView;
