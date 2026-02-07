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

const Dashboard = () => {
  const {
    user,
    activeTeam,
    userTeams,
    teamLoading,
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

  if (!activeTeam && userTeams.length === 0) {
    if (teamLoading) {
      return <DashboardSetupLoadingState />;
    }

    return <DashboardNoWorkspaceState onCreateWorkspace={() => navigate('/create-team')} />;
  }

  if (teamLoading) {
    return <DashboardGenericLoadingState />;
  }

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl">
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
          onOpenFolder={(folderId) => navigate(`/folder/${folderId}`)}
        />
      </div>
    </main>
  );
};

export default Dashboard;
