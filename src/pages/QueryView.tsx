import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Clock } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer';

interface Query {
  id: string;
  title: string;
  description: string | null;
  sql_content: string;
  status: string;
  folder_id: string;
  created_by_email: string | null;
  last_modified_by_email: string | null;
}

interface HistoryRecord {
  id: string;
  modified_by_email: string;
  created_at: string;
  sql_content: string;
}

const QueryView = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
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
      setHistory(data || []);
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

  const handleStatusChange = async (newStatus: string) => {
    if (!query || !id) return;
    
    setUpdating(true);
    try {
      // Find the latest query_history record
      const { data: latestHistory, error: historyFetchError } = await supabase
        .from('query_history')
        .select('id')
        .eq('query_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (historyFetchError) throw historyFetchError;

      // Update the query status
      const { error: updateError } = await supabase
        .from('sql_queries')
        .update({
          status: newStatus,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update the latest history record's status
      if (latestHistory) {
        const historyStatus = newStatus === 'approved' ? 'approved' : 'rejected';
        const { error: historyUpdateError } = await supabase
          .from('query_history')
          .update({
            status: historyStatus,
          })
          .eq('id', latestHistory.id);

        if (historyUpdateError) throw historyUpdateError;
      }

      toast({
        title: 'Success',
        description: newStatus === 'approved' 
          ? 'Query approved' 
          : 'Query rejected and returned to draft',
      });

      // Refresh query data and history
      await fetchQuery();
      await fetchHistory();
    } catch (error: any) {
      console.error('Status change error:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const canApproveOrReject = query?.status === 'pending_approval' && 
                              query?.last_modified_by_email !== user?.email;

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
            {canApproveOrReject && (
              <>
                <Button 
                  onClick={() => handleStatusChange('approved')} 
                  disabled={updating}
                >
                  {updating ? 'Processing...' : 'Approve'}
                </Button>
                <Button 
                  onClick={() => handleStatusChange('draft')} 
                  disabled={updating}
                  variant="outline"
                >
                  {updating ? 'Processing...' : 'Reject'}
                </Button>
              </>
            )}
            <Button onClick={() => navigate(`/query/edit/${query.id}`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Query
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CardTitle>{query.title}</CardTitle>
              <Badge variant={getStatusVariant(query.status)}>
                {query.status === 'pending_approval' ? 'Pending Approval' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
              </Badge>
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
              <Textarea
                value={query.sql_content}
                readOnly
                rows={15}
                className="font-mono text-sm mt-2"
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
      </div>
    </div>
  );
};

export default QueryView;
