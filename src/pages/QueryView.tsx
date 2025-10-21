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

interface Query {
  id: string;
  title: string;
  description: string | null;
  sql_content: string;
  status: string;
  project_id: string;
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
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

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
        .order('created_at', { ascending: false });

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

  const handleHistoryClick = (record: HistoryRecord) => {
    setSelectedHistory(record);
    setHistoryModalOpen(true);
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
            onClick={() => navigate(`/project/${query.project_id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
          
          <Button onClick={() => navigate(`/query/edit/${query.id}`)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Query
          </Button>
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
                {history.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => handleHistoryClick(record)}
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
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>Query History Comparison</DialogTitle>
              <DialogDescription>
                Compare this historical version with the current query
              </DialogDescription>
            </DialogHeader>
            {selectedHistory && (
              <div className="space-y-4">
                <div className="text-sm">
                  <p className="font-medium">Historical Version Modified By:</p>
                  <p className="text-muted-foreground">{selectedHistory.modified_by_email}</p>
                  <p className="text-muted-foreground">{formatDate(selectedHistory.created_at)}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">
                      Historical Version (from {formatDate(selectedHistory.created_at)})
                    </Label>
                    <Textarea
                      value={selectedHistory.sql_content}
                      readOnly
                      rows={20}
                      className="font-mono text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">
                      Current Version
                    </Label>
                    <Textarea
                      value={query.sql_content}
                      readOnly
                      rows={20}
                      className="font-mono text-sm"
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
      </div>
    </div>
  );
};

export default QueryView;
