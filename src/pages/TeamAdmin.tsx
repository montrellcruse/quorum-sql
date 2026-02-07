import { FeatureGate } from '@/components/FeatureGate';
import {
  ApprovalQuotaCard,
  CollaborateCard,
  TeamAdminHeader,
  TeamAdminLoadingState,
  TeamMembersCard,
  TeamSelectionCard,
  TransferOwnershipCard,
  TransferOwnershipDialog,
  WorkspaceNameCard,
} from '@/pages/team-admin/TeamAdminSections';
import { useTeamAdmin } from '@/pages/team-admin/useTeamAdmin';

const TeamAdmin = () => {
  const {
    selectedTeamId,
    setSelectedTeamId,
    selectedTeam,
    adminTeams,
    members,
    invitations,
    newUserEmail,
    setNewUserEmail,
    newUserRole,
    setNewUserRole,
    approvalQuota,
    setApprovalQuota,
    teamName,
    setTeamName,
    renaming,
    transferOwnershipDialogOpen,
    setTransferOwnershipDialogOpen,
    selectedNewOwner,
    setSelectedNewOwner,
    isPersonalTeam,
    soloContext,
    settingsLabel,
    loadingPage,
    isTeamOwner,
    handleInviteUser,
    handleRevokeInvitation,
    handleRemoveMember,
    handleToggleRole,
    handleUpdateApprovalQuota,
    handleRenameTeam,
    handleTransferOwnership,
    navigate,
  } = useTeamAdmin();

  if (loadingPage) {
    return <TeamAdminLoadingState />;
  }

  return (
    <main className="container mx-auto max-w-4xl p-6">
      <TeamAdminHeader title={settingsLabel} onBack={() => navigate('/dashboard')} />

      <TeamSelectionCard
        selectedTeamId={selectedTeamId}
        teams={adminTeams}
        onSelectTeam={setSelectedTeamId}
      />

      {selectedTeam && (
        <>
          <WorkspaceNameCard
            teamName={teamName}
            renaming={renaming}
            isPersonalTeam={isPersonalTeam}
            onTeamNameChange={setTeamName}
            onSubmit={handleRenameTeam}
          />

          <FeatureGate teamOnly soloContext={soloContext}>
            <TeamMembersCard
              email={newUserEmail}
              role={newUserRole}
              invitations={invitations}
              members={members}
              isTeamOwner={isTeamOwner}
              onEmailChange={setNewUserEmail}
              onRoleChange={setNewUserRole}
              onInvite={handleInviteUser}
              onRevokeInvitation={handleRevokeInvitation}
              onToggleRole={handleToggleRole}
              onRemoveMember={handleRemoveMember}
            />
          </FeatureGate>

          <FeatureGate soloOnly soloContext={soloContext}>
            <CollaborateCard
              email={newUserEmail}
              role={newUserRole}
              invitations={invitations}
              onEmailChange={setNewUserEmail}
              onRoleChange={setNewUserRole}
              onInvite={handleInviteUser}
              onRevokeInvitation={handleRevokeInvitation}
            />
          </FeatureGate>

          <FeatureGate teamOnly soloContext={soloContext}>
            <TransferOwnershipCard
              canTransfer={members.length > 1}
              onOpenDialog={() => setTransferOwnershipDialogOpen(true)}
            />
          </FeatureGate>

          <ApprovalQuotaCard
            approvalQuota={approvalQuota}
            onApprovalQuotaChange={setApprovalQuota}
            onSubmit={handleUpdateApprovalQuota}
          />
        </>
      )}

      <TransferOwnershipDialog
        open={transferOwnershipDialogOpen}
        selectedNewOwner={selectedNewOwner}
        currentOwnerId={selectedTeam?.admin_id}
        members={members}
        onOpenChange={setTransferOwnershipDialogOpen}
        onSelectOwner={setSelectedNewOwner}
        onTransfer={handleTransferOwnership}
      />
    </main>
  );
};

export default TeamAdmin;
