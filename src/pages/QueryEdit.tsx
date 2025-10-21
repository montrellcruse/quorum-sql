import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';

interface Query {
  id: string;
  title: string;
  description: string | null;
  sql_content: string;
  status: string;
  project_id: string;
  last_modified_by_email: string | null;
  created_by_email: string | null;
}

const QueryEdit = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState<Query | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const isNewQuery = id === 'new';
  const projectId = location.state?.projectId;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      if (isNewQuery) {
        if (!projectId) {
          toast({
            title: 'Error',
            description: 'Project ID is required',
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
          project_id: projectId,
          last_modified_by_email: null,
          created_by_email: null,
        });
        setLoadingQuery(false);
      } else if (id) {
        fetchQuery();
      }
    }
  }, [user, id, isNewQuery, projectId]);

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

  const handleSave = async (newStatus: string) => {
    if (!query?.title.trim() || !query?.sql_content.trim()) {
      toast({
        title: 'Error',
        description: 'Title and SQL content are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let queryId = id;
      
      if (isNewQuery) {
        const { data, error } = await supabase
          .from('sql_queries')
          .insert({
            title: query.title,
            description: query.description,
            sql_content: query.sql_content,
            status: newStatus,
            project_id: query.project_id,
            user_id: user?.id,
            created_by_email: user?.email || '',
            last_modified_by_email: user?.email || '',
          })
          .select()
          .single();

        if (error) throw error;
        queryId = data.id;

        // For new queries, always create first history record
        const { error: historyError } = await supabase
          .from('query_history')
          .insert({
            query_id: queryId,
            sql_content: query.sql_content,
            modified_by_email: user?.email || '',
          });

        if (historyError) throw historyError;
      } else {
        // For existing queries, check if SQL content changed
        const { data: latestHistory } = await supabase
          .from('query_history')
          .select('sql_content')
          .eq('query_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const sqlContentChanged = !latestHistory || latestHistory.sql_content !== query.sql_content;

        // Always update the query
        const { error } = await supabase
          .from('sql_queries')
          .update({
            title: query.title,
            description: query.description,
            sql_content: query.sql_content,
            status: newStatus,
            last_modified_by_email: user?.email || '',
          })
          .eq('id', id);

        if (error) throw error;

        // Only create history record if SQL content actually changed
        if (sqlContentChanged) {
          const { error: historyError } = await supabase
            .from('query_history')
            .insert({
              query_id: id,
              sql_content: query.sql_content,
              modified_by_email: user?.email || '',
            });

          if (historyError) throw historyError;
        }
      }

      toast({
        title: 'Success',
        description: newStatus === 'pending_approval' 
          ? 'Query submitted for approval' 
          : newStatus === 'approved' 
          ? 'Query approved' 
          : newStatus === 'draft' 
          ? 'Query saved as draft' 
          : 'Query updated',
      });

      // Redirect back to project page
      navigate(`/project/${query.project_id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!query) return;
    
    setSaving(true);
    try {
      // Only update status, no history records for status-only changes
      const { error } = await supabase
        .from('sql_queries')
        .update({
          status: newStatus,
          ...(newStatus === 'draft' && { last_modified_by_email: user?.email || '' }),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: newStatus === 'approved' 
          ? 'Query approved' 
          : 'Query rejected and returned to draft',
      });

      if (newStatus === 'draft') {
        // Refresh to show editable state
        fetchQuery();
      } else {
        // Redirect back to project page
        navigate(`/project/${query.project_id}`);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isEditable = query?.status === 'draft';
  const canApprove = query?.status === 'pending_approval' && 
                     query?.last_modified_by_email !== user?.email;

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
        <Button
          variant="ghost"
          onClick={() => navigate(`/project/${query.project_id}`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Project
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{isNewQuery ? 'New Query' : 'Edit Query'}</CardTitle>
            <CardDescription>
              {isNewQuery ? 'Create a new SQL query' : 
               query.status === 'pending_approval' ? 'Query pending approval' :
               query.status === 'approved' ? 'Approved query' :
               'Edit SQL query'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={query.title}
                onChange={(e) => setQuery({ ...query, title: e.target.value })}
                placeholder="Enter query title"
                disabled={!isEditable}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={query.description || ''}
                onChange={(e) => setQuery({ ...query, description: e.target.value })}
                placeholder="Enter query description"
                rows={3}
                disabled={!isEditable}
              />
            </div>

            <div>
              <Label htmlFor="sql_content">SQL Content</Label>
              <Textarea
                id="sql_content"
                value={query.sql_content}
                onChange={(e) => setQuery({ ...query, sql_content: e.target.value })}
                placeholder="Enter your SQL query here..."
                rows={12}
                className="font-mono text-sm"
                disabled={!isEditable}
              />
            </div>

            {query.status === 'draft' && (
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleSave('draft')} 
                  disabled={saving} 
                  variant="outline"
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button 
                  onClick={() => handleSave('pending_approval')} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : 'Request Approval'}
                </Button>
              </div>
            )}

            {query.status === 'pending_approval' && canApprove && (
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleStatusChange('approved')} 
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? 'Processing...' : 'Approve'}
                </Button>
                <Button 
                  onClick={() => handleStatusChange('draft')} 
                  disabled={saving}
                  variant="outline"
                  className="flex-1"
                >
                  {saving ? 'Processing...' : 'Reject'}
                </Button>
              </div>
            )}

            {query.status === 'pending_approval' && !canApprove && (
              <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                This query is pending approval. You cannot approve your own submission.
              </div>
            )}

            {query.status === 'approved' && (
              <Button 
                onClick={() => handleStatusChange('draft')} 
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Processing...' : 'Create New Draft'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QueryEdit;
