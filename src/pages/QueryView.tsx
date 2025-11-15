import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { getPendingApprovalsCount } from '@/utils/teamUtils';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, Edit, Clock, Trash2, Copy, Check } from 'lucide-react';
import { getDbAdapter } from '@/lib/provider';

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
  const location = useLocation();
  const { toast } = useToast();
  const { theme } = useTheme();
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
  const [copied, setCopied] = useState(false);

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
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        const q = await getDbAdapter().queries.getById(id!);
        if (!q) {
          toast({ title: 'Error', description: 'Query not found', variant: 'destructive' });
          navigate('/dashboard');
          return;
        }
        setQuery(q as any);
      } else {
        const { data, error } = await supabase
          .from('sql_queries')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast({ title: 'Error', description: 'Query not found', variant: 'destructive' });
          navigate('/dashboard');
          return;
        }
        setQuery(data as any);
      }
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
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
        if (!API_BASE) throw new Error('VITE_API_BASE_URL is not set');
        const res = await fetch(`${API_BASE.replace(/\/$/, '')}/queries/${id}/history`, { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const approvedHistory = (data || []).filter((h: any) => h.status === 'approved');
        setHistory(approvedHistory);
        const pendingHistory = (data || []).find((h: any) => h.status === 'pending_approval');
        if (pendingHistory) setLatestHistoryId(pendingHistory.id);
      } else {
        const { data, error } = await supabase
          .from('query_history')
          .select('*')
          .eq('query_id', id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (error) throw error;
        const approvedHistory = (data || []).filter(h => h.status === 'approved');
        setHistory(approvedHistory);
        const pendingHistory = (data || []).find(h => h.status === 'pending_approval');
        if (pendingHistory) setLatestHistoryId(pendingHistory.id);
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
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
        if (!API_BASE) throw new Error('VITE_API_BASE_URL is not set');
        const res = await fetch(`${API_BASE.replace(/\/$/, '')}/queries/${id}/approvals`, { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text());
        const payload = await res.json();
        setApprovalQuota(payload.approval_quota || 1);
        setApprovals(payload.approvals || []);
        if (payload.latest_history_id) setLatestHistoryId(payload.latest_history_id);
        const userApproval = (payload.approvals || []).some((a: any) => a.user_id === user?.id);
        setHasUserApproved(userApproval);
      } else {
        const { data: queryData, error: queryError } = await supabase
          .from('sql_queries')
          .select('team_id, teams(approval_quota)')
          .eq('id', id)
          .single();
        if (queryError) throw queryError;
        const quota = (queryData as any)?.teams?.approval_quota || 1;
        setApprovalQuota(quota);
        const { data: approvalsData, error: approvalsError } = await supabase
          .from('query_approvals')
          .select('*')
          .eq('query_history_id', latestHistoryId);
        if (approvalsError) throw approvalsError;
        setApprovals(approvalsData || []);
        const userApproval = (approvalsData || []).some(a => a.user_id === user?.id);
        setHasUserApproved(userApproval);
      }
    } catch (error: any) {
      // Error fetching approvals - silently fail as this is not critical
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

  const handleDiffEditorMount = (editor: any) => {
    // Get references to both the original (left) and modified (right) editors
    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();
    
    // Force word wrap on both editors
    originalEditor.updateOptions({
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
    });
    
    modifiedEditor.updateOptions({
      wordWrap: 'on',
      wrappingStrategy: 'advanced',
    });
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
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        await getDbAdapter().queries.approve(id, latestHistoryId);
        toast({ title: 'Success', description: 'Approval recorded.' });
      } else {
        const { data, error } = await supabase.rpc('approve_query_with_quota', {
          _query_id: id,
          _query_history_id: latestHistoryId,
          _approver_user_id: user.id,
        });
        if (error) throw error;
        const result = data as any;
        if (!result.success) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          return;
        }
        if (result.approved) {
          toast({ title: 'Success', description: `${result.message} (${result.approval_count}/${result.approval_quota} approvals reached)` });
        } else {
          toast({ title: 'Approval Recorded', description: `${result.message} (${result.approval_count}/${result.approval_quota} approvals)` });
        }
      }

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
      await fetchQuery();
      await fetchHistory();
      await fetchApprovals();
    } catch (error: any) {
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
    if (!query || !id || !latestHistoryId || !user?.id) return;
    
    setUpdating(true);
    try {
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        await getDbAdapter().queries.reject(id, latestHistoryId);
      } else {
        const { data, error } = await supabase.rpc('reject_query_with_authorization', {
          _query_id: id,
          _query_history_id: latestHistoryId,
          _rejecter_user_id: user.id,
        });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; message?: string };
        if (!result.success) throw new Error(result.error || 'Failed to reject query');
      }

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
      await fetchQuery();
      await fetchHistory();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject query',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteQuery = async () => {
    if (!query) return;

    try {
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        await getDbAdapter().queries.remove(query.id);
      } else {
        const { error } = await supabase
          .from('sql_queries')
          .delete()
          .eq('id', query.id);
        if (error) throw error;
      }

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
    <main className="min-h-screen bg-background p-8">
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
              <div className="flex items-center justify-between mb-2">
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
                      onMount={handleDiffEditorMount}
                      options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        wordWrap: 'on',
                        wrappingStrategy: 'advanced',
                        automaticLayout: true,
                      }}
                    />
                  </div>
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
    </main>
  );
};

export default QueryView;
