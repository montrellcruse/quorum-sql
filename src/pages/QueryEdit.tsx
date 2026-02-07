import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Editor from '@monaco-editor/react';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Trash2, FolderInput, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { querySchema, changeReasonSchema, validateSqlSafety } from '@/lib/validationSchemas';
import { getDbAdapter } from '@/lib/provider';
import { getErrorMessage } from '@/utils/errors';
import type { QueryStatus } from '@/lib/provider/types';

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
  const { theme } = useTheme();
  const [query, setQuery] = useState<Query | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [changeReason, setChangeReason] = useState('');
  const [sqlWarnings, setSqlWarnings] = useState<string[]>([]);
  
  const isNewQuery = id === 'new';
  const folderId = location.state?.folderId;

  // Check SQL content for dangerous patterns
  useEffect(() => {
    if (query?.sql_content) {
      const { warnings } = validateSqlSafety(query.sql_content);
      setSqlWarnings(warnings);
    } else {
      setSqlWarnings([]);
    }
  }, [query?.sql_content]);

  // Define fetchQuery callback BEFORE useEffect that uses it
  const fetchQuery = useCallback(async () => {
    try {
      if (!id) {
        setLoadingQuery(false);
        return;
      }
      const q = await getDbAdapter().queries.getById(id);
      if (!q) throw new Error('Query not found');
      setQuery(q as unknown as Query);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to fetch query'),
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoadingQuery(false);
    }
  }, [id, toast, navigate]);

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
  }, [user, id, isNewQuery, folderId, navigate, toast, fetchQuery]);

  const handleSave = async (newStatus: string) => {
    // Validate query data using zod schema
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

    // Validate change reason if requesting approval
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

    setSaving(true);
    try {
      if (!query) {
        throw new Error('Query is not loaded');
      }
      if (!user?.id) {
        throw new Error('User is not authenticated');
      }
      const userId = user.id;
      const userEmail = user.email || '';
      if (!isNewQuery && !id) {
        throw new Error('Missing query ID');
      }

      let queryId = isNewQuery ? '' : (id ?? '');
      if (isNewQuery) {
        const folder = await getDbAdapter().folders.getById(query.folder_id);
        if (!folder?.team_id) throw new Error('Folder does not have a team_id');
        const created = await getDbAdapter().queries.create({
          title: query.title,
          description: query.description,
          sql_content: query.sql_content,
          status: newStatus as QueryStatus,
          folder_id: query.folder_id,
          team_id: folder.team_id,
          created_by_email: userEmail,
          last_modified_by_email: userEmail,
        });
        queryId = created.id;
      } else {
        await getDbAdapter().queries.update(queryId, {
          title: query.title,
          description: query.description,
          sql_content: query.sql_content,
          status: newStatus as QueryStatus,
          last_modified_by_email: userEmail,
        });
      }

      // Step 1: If requesting approval, use atomic function to handle single-person team auto-approval
      if (!queryId) {
        throw new Error('Failed to resolve query ID');
      }

      if (newStatus === 'pending_approval') {
        await getDbAdapter().queries.submitForApproval(queryId, query.sql_content, {
          modified_by_email: userEmail,
          change_reason: changeReason.trim() || null,
          team_id: activeTeam?.id,
          user_id: userId,
        });
        setChangeReason('');
        toast({ title: 'Success', description: 'Query submitted for approval' });
      } else {
        toast({
          title: 'Success',
          description: newStatus === 'approved' 
            ? 'Query approved' 
            : newStatus === 'draft' 
            ? 'Query saved as draft' 
            : 'Query updated',
        });
      }

      // Redirect back to folder page
      navigate(`/folder/${query!.folder_id}`);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to save query'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewDraft = async () => {
    setSaving(true);
    try {
      if (!id) {
        throw new Error('Missing query ID');
      }
      await getDbAdapter().queries.update(id, { status: 'draft' });

      // Refresh local state before showing success
      await fetchQuery();

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
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = async () => {
    setSaving(true);
    try {
      if (!id) {
        throw new Error('Missing query ID');
      }
      const all = await getDbAdapter().queries.getHistory(id);
      const approvedHistory = (all || []).find((h) => h.status === 'approved');
      if (approvedHistory) {
        await getDbAdapter().queries.update(id, {
          sql_content: approvedHistory.sql_content,
          status: 'approved',
          last_modified_by_email: approvedHistory.modified_by_email,
        });
        toast({ title: 'Success', description: 'Draft discarded and reverted to last approved version' });
        navigate(`/query/view/${id}`);
      } else {
        await getDbAdapter().queries.remove(id);
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
      setSaving(false);
      setDeleteDialogOpen(false);
    }
  };

  const fetchFolders = async () => {
    if (!activeTeam) return;
    
    try {
      const data = await getDbAdapter().folders.listPaths(activeTeam.id);
      const filteredFolders = (data || []).filter((folder: Folder) => folder.id !== query?.folder_id);
      setFolders(filteredFolders);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to load folders'),
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
      if (!id) {
        throw new Error('Missing query ID');
      }
      await getDbAdapter().queries.update(id, { folder_id: selectedFolderId });

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
      setSaving(false);
      setMoveDialogOpen(false);
    }
  };

  // Only draft queries are editable
  const isEditable = (query?.status === 'draft') || isNewQuery;

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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(`/folder/${query.folder_id}`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Folder
          </Button>

          <div className="flex flex-wrap gap-2">
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
               query.status === 'pending_approval' ? 'Editing query (currently pending approval)' :
               query.status === 'approved' ? 'Editing approved query (will create new version)' :
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
                maxLength={200}
                className={!isEditable ? 'cursor-not-allowed opacity-60' : ''}
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
                maxLength={1000}
                className={!isEditable ? 'cursor-not-allowed opacity-60' : ''}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="sql_content">SQL Content</Label>
                {!isEditable && (
                  <span className="text-xs text-muted-foreground">
                    Read-only. Click "Create New Draft" to edit.
                  </span>
                )}
              </div>
              <div className={`overflow-hidden rounded-md border ${
                !isEditable 
                  ? 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800' 
                  : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900'
              }`}>
                <Editor
                  height="300px"
                  defaultLanguage="sql"
                  value={query.sql_content}
                  onChange={(value) => setQuery({ ...query, sql_content: value || '' })}
                  options={{
                    readOnly: !isEditable,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                  theme={theme === "dark" ? "vs-dark" : "light"}
                />
              </div>
              
              {/* SQL Safety Warnings */}
              {sqlWarnings.length > 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>SQL Safety Warning</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <p className="font-semibold text-sm">
                        This query contains potentially dangerous operations:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {sqlWarnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                      <p className="text-sm mt-2 italic">
                        ⚠️ Note: SQL queries are stored for reference only and not executed by this application. 
                        Review carefully before running them manually in your database.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
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
    </main>
  );
};

export default QueryEdit;
