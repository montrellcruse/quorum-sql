import type { FormEvent } from 'react';
import { FeatureGate } from '@/components/FeatureGate';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getWorkspaceLabel } from '@/utils/terminology';
import type { Folder } from '@/lib/provider/types';
import type { QuerySearchResult } from '@/hooks/useQueries';
import type { SoloUserContext } from '@/hooks/useSoloUser';
import { ClipboardCheck, FileText, Loader2, Mail, Plus, Search, Settings, Users } from 'lucide-react';

interface TeamOption {
  id: string;
  name: string;
  role: 'admin' | 'member';
}

interface ActiveTeam {
  id: string;
  name: string;
}

interface NewFolderForm {
  name: string;
  description: string;
}

interface DashboardHeaderProps {
  userEmail?: string;
  activeTeam: ActiveTeam | null;
  userTeams: TeamOption[];
  isSoloUser: boolean;
  soloContext: SoloUserContext;
  pendingInvitesCount: number;
  pendingApprovalsCount: number;
  isAdmin: boolean;
  onTeamChange: (teamId: string) => void;
  onAcceptInvites: () => void;
  onApprovals: () => void;
  onCreateTeam: () => void;
  onTeamAdmin: () => void;
  onSignOut: () => void;
}

interface DashboardSearchProps {
  searchTerm: string;
  searching: boolean;
  searchResults: QuerySearchResult[];
  onSearchTermChange: (value: string) => void;
  onSearch: (event: FormEvent) => Promise<void>;
  onOpenQuery: (queryId: string) => void;
}

interface CreateFolderDialogProps {
  open: boolean;
  creating: boolean;
  form: NewFolderForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: NewFolderForm) => void;
  onCreate: () => Promise<void>;
}

interface DashboardFoldersProps {
  loading: boolean;
  hasError: boolean;
  folders: Folder[];
  onOpenFolder: (folderId: string) => void;
}

export function DashboardSetupLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Setting up your workspace...</p>
      </div>
    </div>
  );
}

export function DashboardGenericLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

export function DashboardNoWorkspaceState({ onCreateWorkspace }: { onCreateWorkspace: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Welcome to Quorum</CardTitle>
          <CardDescription>Let's create your workspace to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onCreateWorkspace} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Create Workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardHeader({
  userEmail,
  activeTeam,
  userTeams,
  isSoloUser,
  soloContext,
  pendingInvitesCount,
  pendingApprovalsCount,
  isAdmin,
  onTeamChange,
  onAcceptInvites,
  onApprovals,
  onCreateTeam,
  onTeamAdmin,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Quorum</h1>
        <p className="text-muted-foreground">Welcome back, {userEmail}</p>
        {activeTeam && userTeams.length > 1 && (
          <div className="mt-2">
            <Select value={activeTeam.id} onValueChange={onTeamChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {userTeams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name} {team.role === 'admin' ? '(Admin)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {activeTeam && userTeams.length === 1 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {getWorkspaceLabel(isSoloUser)}: {activeTeam.name}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <ThemeToggle />
        {pendingInvitesCount > 0 && (
          <Button onClick={onAcceptInvites} variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Pending Invites
            <Badge className="ml-2">{pendingInvitesCount}</Badge>
          </Button>
        )}
        <FeatureGate teamOnly soloContext={soloContext}>
          {pendingApprovalsCount > 0 && (
            <Button onClick={onApprovals} variant="outline">
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Approvals Needed
              <Badge className="ml-2" variant="destructive">
                {pendingApprovalsCount}
              </Badge>
            </Button>
          )}
        </FeatureGate>
        <FeatureGate soloOnly soloContext={soloContext}>
          <Button onClick={onCreateTeam} variant="outline">
            <Users className="mr-2 h-4 w-4" />
            Start Collaborating
          </Button>
        </FeatureGate>
        <FeatureGate teamOnly soloContext={soloContext}>
          <Button onClick={onCreateTeam} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Create New Team
          </Button>
        </FeatureGate>
        {isAdmin && (
          <Button onClick={onTeamAdmin} variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            {isSoloUser ? 'Settings' : 'Team Admin'}
          </Button>
        )}
        <Button onClick={onSignOut} variant="outline">
          Sign Out
        </Button>
      </div>
    </header>
  );
}

export function DashboardSearch({
  searchTerm,
  searching,
  searchResults,
  onSearchTermChange,
  onSearch,
  onOpenQuery,
}: DashboardSearchProps) {
  return (
    <>
      <form onSubmit={onSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search queries by title, description, or SQL content..."
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
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
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  onClick={() => onOpenQuery(result.id)}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
                >
                  <FileText className="mt-1 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h4 className="font-semibold">{result.title}</h4>
                    <p className="text-sm text-muted-foreground">Folder: {result.folder_name}</p>
                    {result.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
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
    </>
  );
}

export function DashboardCreateFolderDialog({
  open,
  creating,
  form,
  onOpenChange,
  onFormChange,
  onCreate,
}: CreateFolderDialogProps) {
  return (
    <div className="mb-6">
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>Create a new folder to organize your SQL queries</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                placeholder="Enter folder name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    description: event.target.value,
                  })
                }
                placeholder="Enter folder description"
              />
            </div>
            <Button onClick={onCreate} className="w-full" disabled={creating}>
              {creating ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DashboardFolders({ loading, hasError, folders, onOpenFolder }: DashboardFoldersProps) {
  if (loading) {
    return <p className="text-muted-foreground">Loading folders...</p>;
  }

  if (hasError) {
    return <p className="text-muted-foreground">Failed to load folders.</p>;
  }

  if (folders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Folders Yet</CardTitle>
          <CardDescription>
            Create your first folder to start organizing your SQL queries
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {folders.map((folder) => (
        <Card
          key={folder.id}
          data-testid="folder-card"
          data-folder-name={folder.name}
          className="cursor-pointer transition-colors hover:bg-accent"
          onClick={() => onOpenFolder(folder.id)}
        >
          <CardHeader>
            <CardTitle>{folder.name}</CardTitle>
            {folder.description && <CardDescription>{folder.description}</CardDescription>}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
