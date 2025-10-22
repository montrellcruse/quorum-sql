import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, FileText, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Folder {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by_email: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  folder_name: string;
}

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { activeTeam, userTeams, setActiveTeam, loading: teamLoading } = useTeam();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<Folder[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && activeTeam) {
      fetchProjects();
      checkAdminStatus();
    }
  }, [user, activeTeam]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user?.id)
        .eq('role', 'admin')
        .limit(1);

      if (error) throw error;
      setIsAdmin(data && data.length > 0);
    } catch (error: any) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchProjects = async () => {
    if (!activeTeam) return;
    
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .is('parent_folder_id', null)
        .eq('team_id', activeTeam.id)
        .order('name', { ascending: true });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: 'Error',
        description: 'Folder name is required',
        variant: 'destructive'
      });
      return;
    }
    
    if (!activeTeam) {
      toast({
        title: 'Error',
        description: 'No active team selected',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Check for duplicate folder name at root level
      const { data: existingFolder, error: checkError } = await supabase
        .from('folders')
        .select('id')
        .eq('name', newProject.name.trim())
        .is('parent_folder_id', null)
        .eq('team_id', activeTeam.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingFolder) {
        toast({
          title: 'Error',
          description: 'A folder with this name already exists at the root.',
          variant: 'destructive'
        });
        return;
      }

      const { error } = await supabase
        .from('folders')
        .insert({
          name: newProject.name,
          description: newProject.description,
          user_id: user?.id,
          created_by_email: user?.email || '',
          parent_folder_id: null,
          team_id: activeTeam.id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Folder created successfully'
      });

      setNewProject({ name: '', description: '' });
      setDialogOpen(false);
      fetchProjects();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    if (!activeTeam) return;
    
    setSearching(true);
    try {
      const searchPattern = `%${searchTerm}%`;
      const { data, error } = await supabase
        .from('sql_queries')
        .select(`
          id,
          title,
          description,
          sql_content,
          folder_id,
          folders (
            name
          )
        `)
        .eq('team_id', activeTeam.id)
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern},sql_content.ilike.${searchPattern}`);

      if (error) throw error;

      const results: SearchResult[] = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        folder_id: item.folder_id,
        folder_name: item.folders?.name || 'Unknown Folder'
      }));

      setSearchResults(results);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Signed out',
        description: 'Successfully signed out.'
      });
      navigate('/auth');
    }
  };

  if (loading || teamLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }
  
  if (!activeTeam && userTeams.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>No Teams Found</CardTitle>
            <CardDescription>
              You are not a member of any teams. Create a team to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/create-team')} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Create New Team
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SQL Query Manager</h1>
            <p className="text-muted-foreground">Welcome back, {user.email}</p>
            {activeTeam && userTeams.length > 1 && (
              <div className="mt-2">
                <Select value={activeTeam.id} onValueChange={(teamId) => {
                  const team = userTeams.find(t => t.id === teamId);
                  if (team) setActiveTeam(team);
                }}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {userTeams.map(team => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name} {team.role === 'admin' ? '(Admin)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {activeTeam && userTeams.length === 1 && (
              <p className="mt-1 text-sm text-muted-foreground">Team: {activeTeam.name}</p>
            )}
          </div>
          <div className="flex gap-2">
            <ThemeToggle />
            <Button onClick={() => navigate('/create-team')} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create New Team
            </Button>
            {isAdmin && (
              <Button onClick={() => navigate('/team-admin')} variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Team Admin
              </Button>
            )}
            <Button onClick={handleSignOut} variant="outline">
              Sign Out
            </Button>
          </div>
        </header>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search queries by title, description, or SQL content..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10" 
              />
            </div>
            <Button type="submit" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                Found {searchResults.length} {searchResults.length === 1 ? 'query' : 'queries'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {searchResults.map(result => (
                  <div 
                    key={result.id} 
                    onClick={() => navigate(`/query/view/${result.id}`)} 
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                  >
                    <FileText className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <h4 className="font-semibold">{result.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        Folder: {result.folder_name}
                      </p>
                      {result.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
                <DialogDescription>
                  Create a new folder to organize your SQL queries
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Folder Name</Label>
                  <Input 
                    id="name" 
                    value={newProject.name} 
                    onChange={e => setNewProject({ ...newProject, name: e.target.value })} 
                    placeholder="Enter folder name" 
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={newProject.description} 
                    onChange={e => setNewProject({ ...newProject, description: e.target.value })} 
                    placeholder="Enter folder description" 
                  />
                </div>
                <Button onClick={handleCreateProject} className="w-full">
                  Create Folder
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loadingProjects ? (
          <p className="text-muted-foreground">Loading folders...</p>
        ) : projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <Card 
                key={project.id} 
                className="cursor-pointer transition-colors hover:bg-accent" 
                onClick={() => navigate(`/folder/${project.id}`)}
              >
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.created_by_email && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Created by {project.created_by_email}
                    </p>
                  )}
                  {project.description && <CardDescription>{project.description}</CardDescription>}
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Folders Yet</CardTitle>
              <CardDescription>
                Create your first folder to start organizing your SQL queries
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
