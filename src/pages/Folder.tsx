import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, FileText, Edit, Trash2, Folder as FolderIcon, Home } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface Folder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  parent_folder_id: string | null;
  team_id: string | null;
  user_id: string;
}

interface Query {
  id: string;
  title: string;
  status: string;
  description: string | null;
  created_at: string;
  created_by_email: string | null;
  last_modified_by_email: string | null;
}

interface BreadcrumbFolder {
  id: string;
  name: string;
}

const Folder = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const { activeTeam } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loadingFolder, setLoadingFolder] = useState(true);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(true);
  const [childFolders, setChildFolders] = useState<Folder[]>([]);
  const [loadingChildFolders, setLoadingChildFolders] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbFolder[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchFolder();
      fetchQueries();
      fetchChildFolders();
      fetchBreadcrumbs();
    }
  }, [user, id]);

  const fetchFolder = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: 'Error',
          description: 'Folder not found',
          variant: 'destructive',
        });
        navigate('/dashboard');
        return;
      }

      setFolder(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoadingFolder(false);
    }
  };

  const fetchQueries = async () => {
    try {
      const { data, error } = await supabase
        .from('sql_queries')
        .select('id, title, status, description, created_at, created_by_email, last_modified_by_email, updated_at')
        .eq('folder_id', id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setQueries(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingQueries(false);
    }
  };

  const fetchChildFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('parent_folder_id', id)
        .order('name', { ascending: true });

      if (error) throw error;
      setChildFolders(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingChildFolders(false);
    }
  };

  const fetchBreadcrumbs = async () => {
    if (!id) return;
    
    const crumbs: BreadcrumbFolder[] = [];
    let currentId: string | null = id;

    try {
      while (currentId) {
        const { data, error } = await supabase
          .from('folders')
          .select('id, name, parent_folder_id')
          .eq('id', currentId)
          .maybeSingle();

        if (error) throw error;
        if (!data) break;

        crumbs.unshift({ id: data.id, name: data.name });
        currentId = data.parent_folder_id;
      }

      setBreadcrumbs(crumbs);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
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

  const handleEditFolder = () => {
    if (folder) {
      setEditName(folder.name);
      setEditDescription(folder.description || '');
      setEditDialogOpen(true);
    }
  };

  const handleSaveFolder = async () => {
    if (!folder) return;

    try {
      const { error } = await supabase
        .from('folders')
        .update({
          name: editName,
          description: editDescription,
        })
        .eq('id', folder.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Folder updated successfully',
      });

      setFolder({ ...folder, name: editName, description: editDescription });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const canEditFolder = () => {
    if (!folder || !user || !activeTeam) return false;
    const isOwner = folder.user_id === user.id;
    const isAdmin = activeTeam.role === 'admin';
    return isOwner || isAdmin;
  };

  const canDeleteFolder = () => {
    if (!folder || !user || !activeTeam) return false;
    const isOwner = folder.user_id === user.id;
    const isAdmin = activeTeam.role === 'admin';
    return isOwner || isAdmin;
  };

  const handleDeleteFolder = async () => {
    if (queries.length > 0) {
      toast({
        title: 'Cannot Delete Folder',
        description: 'Folder is not empty. Please move or delete all queries in this folder first.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteDialogOpen(true);
  };

  const confirmDeleteFolder = async () => {
    if (!folder) return;

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folder.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Folder deleted successfully',
      });

      // Navigate to parent folder or dashboard
      if (folder.parent_folder_id) {
        navigate(`/folder/${folder.parent_folder_id}`);
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateChildFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Check for duplicate folder name within current parent
      const { data: existingFolder, error: checkError } = await supabase
        .from('folders')
        .select('id')
        .eq('name', newFolderName.trim())
        .eq('parent_folder_id', id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFolder) {
        toast({
          title: 'Error',
          description: 'A folder with this name already exists in this folder.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('folders')
        .insert({
          name: newFolderName,
          description: newFolderDescription,
          parent_folder_id: id,
          user_id: user?.id,
          created_by_email: user?.email || '',
          team_id: activeTeam?.id || folder?.team_id,
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Child folder created successfully',
      });

      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderDialogOpen(false);
      fetchChildFolders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading || loadingFolder || loadingQueries || loadingChildFolders) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!folder) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => navigate('/dashboard')} className="cursor-pointer">
                  <Home className="h-4 w-4" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.id} className="flex items-center">
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {index === breadcrumbs.length - 1 ? (
                      <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => navigate(`/folder/${crumb.id}`)}
                        className="cursor-pointer"
                      >
                        {crumb.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle>{folder.name}</CardTitle>
                {folder.description && (
                  <CardDescription>{folder.description}</CardDescription>
                )}
              </div>
              <div className="flex gap-2">
                {canEditFolder() && (
                  <Button variant="outline" size="sm" onClick={handleEditFolder}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Folder
                  </Button>
                )}
                {canDeleteFolder() && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteFolder}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Folder
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {childFolders.length > 0 && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Folders</h2>
              <Button onClick={() => setNewFolderDialogOpen(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </div>

            <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {childFolders.map((childFolder) => (
                <Card
                  key={childFolder.id}
                  className="cursor-pointer transition-colors hover:bg-accent"
                  onClick={() => navigate(`/folder/${childFolder.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FolderIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>{childFolder.name}</CardTitle>
                    </div>
                    {childFolder.description && (
                      <CardDescription>{childFolder.description}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </>
        )}

        {childFolders.length === 0 && (
          <div className="mb-4">
            <Button onClick={() => setNewFolderDialogOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              New Folder
            </Button>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">SQL Queries</h2>
          <Button onClick={() => navigate('/query/edit/new', { state: { folderId: id } })}>
            <Plus className="mr-2 h-4 w-4" />
            New Query
          </Button>
        </div>

        {queries.length > 0 ? (
          <div className="space-y-4">
            {queries.map((query) => (
              <Card key={query.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div
                        className="cursor-pointer"
                        onClick={() => navigate(`/query/view/${query.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg hover:underline">{query.title}</CardTitle>
                          <Badge variant={getStatusVariant(query.status)}>
                            {query.status === 'pending_approval' ? 'Pending Approval' : query.status.charAt(0).toUpperCase() + query.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          {query.created_by_email && (
                            <p className="text-xs text-muted-foreground">
                              Created by {query.created_by_email}
                            </p>
                          )}
                          {query.last_modified_by_email && (
                            <p className="text-xs text-muted-foreground">
                              Last modified by {query.last_modified_by_email}
                            </p>
                          )}
                        </div>
                        {query.description && (
                          <CardDescription className="mt-2">
                            {query.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/query/edit/${query.id}`)}
                      variant="outline"
                    >
                      Edit
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Queries Yet</CardTitle>
              <CardDescription>
                Create your first SQL query to get started
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Folder</DialogTitle>
              <DialogDescription>
                Update the folder name and description
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Folder Name</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter folder name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter folder description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFolder}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the folder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Folder
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Create a new folder inside {folder?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-folder-name">Folder Name</Label>
                <Input
                  id="new-folder-name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Enter folder name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-folder-description">Description</Label>
                <Textarea
                  id="new-folder-description"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  placeholder="Enter folder description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateChildFolder}>Create Folder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
};

export default Folder;
