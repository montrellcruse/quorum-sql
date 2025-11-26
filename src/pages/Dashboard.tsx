import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { getDbAdapter } from '@/lib/provider';
import { restAuthAdapter } from '@/lib/auth/restAuthAdapter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, Search, FileText, Settings, Mail, ClipboardCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { checkPendingInvitationsCount, getPendingApprovalsCount } from '@/utils/teamUtils';

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
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Define callbacks BEFORE useEffects that reference them
  const checkAdminStatus = useCallback(async () => {
    try {
      const adapter = getDbAdapter();
      const teams = await adapter.teams.listForUser();
      const current = teams.find(t => t.id === activeTeam?.id);
      setIsAdmin((current as { role?: string })?.role === 'admin');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error checking admin status:', { message });
    }
  }, [activeTeam?.id]);

  const fetchPendingInvitesCount = useCallback(async () => {
    if (!user?.email) return;
    const count = await checkPendingInvitationsCount(user.email);
    setPendingInvitesCount(count);
  }, [user?.email]);

  const fetchPendingApprovalsCount = useCallback(async () => {
    if (!user?.email || !activeTeam) return;
    const count = await getPendingApprovalsCount(activeTeam.id, user.email);
    setPendingApprovalsCount(count);
  }, [user?.email, activeTeam]);

  const fetchProjects = useCallback(async () => {
    if (!activeTeam) return;
    
    try {
      const adapter = getDbAdapter();
      const data = await adapter.folders.listByTeam(activeTeam.id);
      const roots = (data || []).filter((f: unknown) => (f as Folder & { parent_folder_id?: string }).parent_folder_id == null).sort((a, b) => a.name.localeCompare(b.name));
      setProjects(roots);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch projects';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setLoadingProjects(false);
    }
  }, [activeTeam, toast]);

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
  }, [user, activeTeam, fetchProjects, checkAdminStatus]);

  useEffect(() => {
    if (user?.email) {
      fetchPendingInvitesCount();
      
      // Poll every 60 seconds for new invitations
      const interval = setInterval(fetchPendingInvitesCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.email, fetchPendingInvitesCount]);

  useEffect(() => {
    if (user?.email && activeTeam) {
      fetchPendingApprovalsCount();
      
      // Poll every 60 seconds for new approvals
      const interval = setInterval(fetchPendingApprovalsCount, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.email, activeTeam, fetchPendingApprovalsCount]);

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
      const adapter = getDbAdapter();
      const all = await adapter.folders.listByTeam(activeTeam.id);
      const dup = all.find(f => (f.parent_folder_id == null) && f.name.toLowerCase() === newProject.name.trim().toLowerCase());
      if (dup) {
        toast({
          title: 'Error',
          description: 'A folder with this name already exists at the root.',
          variant: 'destructive'
        });
        return;
      }

      await adapter.folders.create({
        name: newProject.name,
        description: newProject.description,
        user_id: (user as any)?.id,
        created_by_email: user?.email || '',
        parent_folder_id: null,
        team_id: activeTeam.id,
      });

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
      const adapter = getDbAdapter();
      const data = await adapter.queries.search({ teamId: activeTeam.id, q: searchTerm.trim() });
      // Folder name not guaranteed in REST adapter results; default to Unknown
      const map: SearchResult[] = (data || []).map((q: any) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        folder_id: q.folder_id,
        folder_name: (q.folder_name as string) || 'Unknown Folder',
      }));
      setSearchResults(map);
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
    try {
      if ((import.meta.env.VITE_DB_PROVIDER || 'supabase') === 'rest') {
        await restAuthAdapter.signOut();
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      toast({ title: 'Signed out', description: 'Successfully signed out.' });
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to sign out',
        variant: 'destructive'
      });
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
    <main className="min-h-screen bg-background p-8">
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
            {pendingInvitesCount > 0 && (
              <Button onClick={() => navigate('/accept-invites')} variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Pending Invites
                <Badge className="ml-2">{pendingInvitesCount}</Badge>
              </Button>
            )}
            {pendingApprovalsCount > 0 && (
              <Button onClick={() => navigate('/approvals')} variant="outline">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Approvals Needed
                <Badge className="ml-2" variant="destructive">{pendingApprovalsCount}</Badge>
              </Button>
            )}
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
    </main>
  );
};

export default Dashboard;
