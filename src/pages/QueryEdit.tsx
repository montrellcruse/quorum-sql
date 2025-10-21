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
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Query {
  id: string;
  title: string;
  description: string | null;
  sql_content: string;
  status: string;
  folder_id: string;
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const isNewQuery = id === 'new';
  const folderId = location.state?.folderId;

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
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
          folder_id: folderId,
          last_modified_by_email: null,
          created_by_email: null,
        });
        setLoadingQuery(false);
      } else if (id) {
        fetchQuery();
      }
    }
  }, [user, id, isNewQuery, folderId]);

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
            folder_id: query.folder_id,
            user_id: user?.id,
            created_by_email: user?.email || '',
            last_modified_by_email: user?.email || '',
          })
          .select()
          .single();

        if (error) throw error;
        queryId = data.id;
      } else {
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
      }

      // Step 1: If requesting approval, create history record FIRST
      if (newStatus === 'pending_approval') {
        const { error: historyError } = await supabase
          .from('query_history')
          .insert({
            query_id: queryId,
            sql_content: query.sql_content,
            modified_by_email: user?.email || '',
          });

        if (historyError) {
          console.error('History insert error:', historyError);
          throw historyError;
        }
      }

      toast({
        title: 'Success',
        description: newStatus === 'pending_approval' 
          ? 'Query submitted for approval and logged to history' 
          : newStatus === 'approved' 
          ? 'Query approved' 
          : newStatus === 'draft' 
          ? 'Query saved as draft' 
          : 'Query updated',
      });

      // Redirect back to folder page
      navigate(`/folder/${query.folder_id}`);
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

  const handleCreateNewDraft = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sql_queries')
        .update({
          status: 'draft',
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Query converted to draft',
      });

      // Refresh local state
      fetchQuery();
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

  const handleDelete = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sql_queries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Draft deleted successfully',
      });

      // Redirect to folder page
      navigate(`/folder/${query?.folder_id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  const isEditable = query?.status === 'draft';

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

          {!isNewQuery && (
            <Button
              variant="outline"
              onClick={() => navigate(`/query/view/${query.id}`)}
            >
              View Query
            </Button>
          )}
        </div>

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
              <div className="space-y-2">
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
                {!isNewQuery && (
                  <Button 
                    onClick={() => setDeleteDialogOpen(true)} 
                    disabled={saving}
                    variant="destructive"
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Draft
                  </Button>
                )}
              </div>
            )}

            {query.status === 'pending_approval' && (
              <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                This query is pending approval. Approval actions are available on the View page.
              </div>
            )}

            {query.status === 'approved' && (
              <Button 
                onClick={handleCreateNewDraft} 
                disabled={saving}
                className="w-full"
              >
                {saving ? 'Processing...' : 'Create New Draft'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this draft? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QueryEdit;
