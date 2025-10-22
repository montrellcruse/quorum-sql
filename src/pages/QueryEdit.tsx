import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import CodeEditor from '@uiw/react-textarea-code-editor';
import rehypePrism from 'rehype-prism-plus';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Trash2, FolderInput } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface Folder {
  id: string;
  full_path: string;
}

const QueryEdit = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { activeTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState<Query | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');
  
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
        // Get the folder's team_id
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('team_id')
          .eq('id', query.folder_id)
          .single();

        if (folderError) throw folderError;

        if (!folderData?.team_id) {
          throw new Error('Folder does not have a team_id');
        }

        const { data, error } = await supabase
          .from('sql_queries')
          .insert({
            title: query.title,
            description: query.description,
            sql_content: query.sql_content,
            status: newStatus,
            folder_id: query.folder_id,
            team_id: folderData.team_id,
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
            status: 'pending_approval',
            change_reason: changeReason.trim() || null,
          });

        if (historyError) {
          console.error('History insert error:', historyError);
          throw historyError;
        }
        
        // Reset change reason after successful submission
        setChangeReason('');
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

      // Refresh local state before showing success
      await fetchQuery();

      toast({
        title: 'Success',
        description: 'Query converted to draft',
      });
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

  const handleDiscardDraft = async () => {
    setSaving(true);
    try {
      // Find the most recent 'approved' history record for this query
      const { data: approvedHistory, error: historyError } = await supabase
        .from('query_history')
        .select('*')
        .eq('query_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (historyError) throw historyError;

      if (approvedHistory) {
        // Approved history exists - revert to it
        const { error: updateError } = await supabase
          .from('sql_queries')
          .update({
            sql_content: approvedHistory.sql_content,
            status: 'approved',
            last_modified_by_email: approvedHistory.modified_by_email,
          })
          .eq('id', id);

        if (updateError) throw updateError;

        toast({
          title: 'Success',
          description: 'Draft discarded and reverted to last approved version',
        });

        // Redirect to view page
        navigate(`/query/view/${id}`);
      } else {
        // No approved history exists - delete the query entirely
        const { error: deleteError } = await supabase
          .from('sql_queries')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        toast({
          title: 'Success',
          description: 'Draft discarded successfully',
        });

        // Redirect to folder page
        navigate(`/folder/${query?.folder_id}`);
      }
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

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_all_folder_paths');

      if (error) throw error;
      
      // Filter out the current folder
      const filteredFolders = (data || []).filter(
        (folder: Folder) => folder.id !== query?.folder_id
      );
      
      setFolders(filteredFolders);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleOpenMoveDialog = () => {
    fetchFolders();
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('sql_queries')
        .update({ folder_id: selectedFolderId })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Query moved successfully',
      });

      navigate(`/folder/${selectedFolderId}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      setMoveDialogOpen(false);
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

          <div className="flex gap-2">
            {!isNewQuery && (
              <>
                <Button
                  variant="outline"
                  onClick={handleOpenMoveDialog}
                >
                  <FolderInput className="mr-2 h-4 w-4" />
                  Move
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/query/view/${query.id}`)}
                >
                  View Query
                </Button>
              </>
            )}
          </div>
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
              <CodeEditor
                value={query.sql_content}
                language="sql"
                placeholder="Enter your SQL query here"
                onChange={(e) => setQuery({ ...query, sql_content: e.target.value })}
                padding={15}
                disabled={!isEditable}
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
                    onClick={() => setApprovalDialogOpen(true)} 
                    disabled={saving}
                    className="flex-1"
                  >
                    Request Approval
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
                    Discard Draft
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
            <AlertDialogTitle>Discard Draft</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard this draft? All changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDiscardDraft}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? 'Discarding...' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Query to Folder</DialogTitle>
            <DialogDescription>
              Select the folder where you want to move this query
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="folder-select">Select Folder</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger id="folder-select" className="mt-2 bg-background">
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.full_path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMove} disabled={saving}>
              {saving ? 'Moving...' : 'Confirm Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Approval</DialogTitle>
            <DialogDescription>
              Optionally provide a reason for this change before submitting for approval
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="change-reason">Change Reason (Optional)</Label>
            <Textarea
              id="change-reason"
              placeholder="Explain what changed and why..."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="mt-2 min-h-[100px]"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {changeReason.length}/1000 characters
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setApprovalDialogOpen(false);
                setChangeReason('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setApprovalDialogOpen(false);
                handleSave('pending_approval');
              }} 
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QueryEdit;
