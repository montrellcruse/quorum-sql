import {
  DashboardCreateFolderDialog,
  DashboardFolders,
  DashboardGenericLoadingState,
  DashboardHeader,
  DashboardNoWorkspaceState,
  DashboardSearch,
  DashboardSetupLoadingState,
} from '@/pages/dashboard/DashboardSections';
import { useDashboardPage } from '@/pages/dashboard/useDashboardPage';
import { Button } from '@/components/ui/button';

const Dashboard = () => {
  const {
    user,
    activeTeam,
    userTeams,
    teamLoading,
    teamError,
    refreshTeams,
    isSoloUser,
    soloContext,
    createFolderDialogOpen,
    setCreateFolderDialogOpen,
    newFolder,
    setNewFolder,
    searchTerm,
    setSearchTerm,
    projects,
    loadingProjects,
    loadingFoldersError,
    moreFoldersError,
    hasMoreFolders,
    loadingMoreFolders,
    loadMoreFolders,
    pendingInvitesCount,
    pendingApprovalsCount,
    searchResults,
    searching,
    isAdmin,
    createFolderPending,
    handleCreateFolder,
    handleSearch,
    handleSignOut,
    handleTeamChange,
    navigate,
  } = useDashboardPage();

  if (!user) {
    return null;
  }

  const teamListError = teamError && (
    <div role="alert" className="mb-4 flex items-center gap-3">
      <p>Could not refresh your teams.</p>
      <Button variant="outline" onClick={() => void refreshTeams()}>Try again</Button>
    </div>
  );

  if (!activeTeam && userTeams.length === 0) {
    if (teamLoading) {
      return <DashboardSetupLoadingState />;
    }

    if (teamListError) return <main className="p-8">{teamListError}</main>;
    return <DashboardNoWorkspaceState onCreateWorkspace={() => navigate('/create-team')} />;
  }

  if (teamLoading) {
    return <DashboardGenericLoadingState />;
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
        {teamListError}
        <DashboardHeader
          userEmail={user.email}
          activeTeam={activeTeam}
          userTeams={userTeams}
          isSoloUser={isSoloUser}
          soloContext={soloContext}
          pendingInvitesCount={pendingInvitesCount}
          pendingApprovalsCount={pendingApprovalsCount}
          isAdmin={isAdmin}
          onTeamChange={handleTeamChange}
          onAcceptInvites={() => navigate('/accept-invites')}
          onApprovals={() => navigate('/approvals')}
          onCreateTeam={() => navigate('/create-team')}
          onTeamAdmin={() => navigate('/team-admin')}
          onSignOut={handleSignOut}
        />

        <DashboardSearch
          searchTerm={searchTerm}
          searching={searching}
          searchResults={searchResults}
          onSearchTermChange={setSearchTerm}
          onSearch={handleSearch}
          onOpenQuery={(queryId) => navigate(`/query/view/${queryId}`)}
        />

        <DashboardCreateFolderDialog
          open={createFolderDialogOpen}
          creating={createFolderPending}
          form={newFolder}
          onOpenChange={setCreateFolderDialogOpen}
          onFormChange={setNewFolder}
          onCreate={handleCreateFolder}
        />

        <DashboardFolders
          loading={loadingProjects}
          hasError={loadingFoldersError}
          folders={projects}
          moreError={moreFoldersError}
          hasMore={hasMoreFolders}
          loadingMore={loadingMoreFolders}
          onLoadMore={() => void loadMoreFolders({ cancelRefetch: false })}
          onOpenFolder={(folderId) => navigate(`/folder/${folderId}`)}
        />
      </div>
    </main>
  );
};

export default Dashboard;
