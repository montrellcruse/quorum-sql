import type { FormEvent } from 'react';
import { ArrowLeft, Loader2, Shield, ShieldOff, Trash2, UserCog, UserPlus } from 'lucide-react';
import type { Role, TeamInvitation, TeamMember } from '@/lib/provider/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TeamOption {
  id: string;
  name: string;
}

interface TeamSelectionCardProps {
  selectedTeamId: string;
  teams: TeamOption[];
  onSelectTeam: (teamId: string) => void;
}

interface WorkspaceNameCardProps {
  teamName: string;
  renaming: boolean;
  isPersonalTeam: boolean;
  onTeamNameChange: (value: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

interface InviteCollaboratorFormProps {
  email: string;
  role: Role;
  onEmailChange: (value: string) => void;
  onRoleChange: (role: Role) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

interface PendingInvitationsListProps {
  invitations: TeamInvitation[];
  onRevoke: (invitationId: string) => Promise<void>;
}

interface CurrentMembersListProps {
  members: TeamMember[];
  isTeamOwner: (userId: string) => boolean;
  onToggleRole: (memberId: string, currentRole: Role) => Promise<void>;
  onRemoveMember: (memberId: string, memberRole: Role) => Promise<void>;
}

interface TransferOwnershipCardProps {
  canTransfer: boolean;
  onOpenDialog: () => void;
}

interface ApprovalQuotaCardProps {
  approvalQuota: number;
  onApprovalQuotaChange: (value: number) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

interface TransferOwnershipDialogProps {
  open: boolean;
  selectedNewOwner: string;
  currentOwnerId?: string;
  members: TeamMember[];
  onOpenChange: (open: boolean) => void;
  onSelectOwner: (userId: string) => void;
  onTransfer: () => Promise<void>;
}

export function TeamAdminLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export function TeamAdminHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <h1 className="mb-6 text-3xl font-bold">{title}</h1>
    </>
  );
}

export function TeamSelectionCard({ selectedTeamId, teams, onSelectTeam }: TeamSelectionCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Select Team</CardTitle>
        <CardDescription>Choose a team to manage</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={selectedTeamId} onValueChange={onSelectTeam}>
          <SelectTrigger>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export function WorkspaceNameCard({
  teamName,
  renaming,
  isPersonalTeam,
  onTeamNameChange,
  onSubmit,
}: WorkspaceNameCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Workspace Name</CardTitle>
        <CardDescription>
          {isPersonalTeam
            ? 'Rename your workspace (converts to team when you add members)'
            : "Change your team's name"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <div className="flex gap-2">
            <Label htmlFor="workspace-name-input" className="sr-only">
              Workspace Name
            </Label>
            <Input
              id="workspace-name-input"
              value={teamName}
              onChange={(event) => onTeamNameChange(event.target.value)}
              placeholder="My Team"
              maxLength={100}
              disabled={renaming}
            />
            <Button type="submit" disabled={renaming}>
              {renaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function InviteCollaboratorForm({
  email,
  role,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: InviteCollaboratorFormProps) {
  return (
    <form onSubmit={onSubmit} className="mb-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="email">Invite User by Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            maxLength={255}
          />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select value={role} onValueChange={(value) => onRoleChange(value as Role)}>
            <SelectTrigger id="role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Collaborator
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Users will be added to the team when they sign up with this email address.
      </p>
    </form>
  );
}

export function PendingInvitationsList({ invitations, onRevoke }: PendingInvitationsListProps) {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h3 className="mb-3 font-semibold">Pending Invitations</h3>
      <div className="space-y-2">
        {invitations.map((invitation) => (
          <div
            key={invitation.id}
            data-testid="invitation-row"
            data-invited-email={invitation.invited_email}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{invitation.invited_email}</p>
              <p className="text-sm capitalize text-muted-foreground">{invitation.role} • Pending</p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                void onRevoke(invitation.id);
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CurrentMembersList({
  members,
  isTeamOwner,
  onToggleRole,
  onRemoveMember,
}: CurrentMembersListProps) {
  return (
    <>
      <h3 className="mb-3 font-semibold">Current Members</h3>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            data-testid="member-row"
            data-member-email={member.email}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              {member.role === 'admin' ? (
                <Shield className="h-5 w-5 text-primary" />
              ) : (
                <ShieldOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{member.email}</p>
                <p className="text-sm capitalize text-muted-foreground">{member.role}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isTeamOwner(member.user_id) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void onToggleRole(member.id, member.role);
                  }}
                >
                  <UserCog className="mr-1 h-4 w-4" />
                  Make {member.role === 'admin' ? 'Member' : 'Admin'}
                </Button>
              )}

              {!isTeamOwner(member.user_id) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    void onRemoveMember(member.id, member.role);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {isTeamOwner(member.user_id) && (
                <span className="px-3 py-2 text-sm text-muted-foreground">Team Owner</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TeamMembersCard({
  email,
  role,
  invitations,
  members,
  isTeamOwner,
  onEmailChange,
  onRoleChange,
  onInvite,
  onRevokeInvitation,
  onToggleRole,
  onRemoveMember,
}: {
  email: string;
  role: Role;
  invitations: TeamInvitation[];
  members: TeamMember[];
  isTeamOwner: (userId: string) => boolean;
  onEmailChange: (value: string) => void;
  onRoleChange: (role: Role) => void;
  onInvite: (event: FormEvent) => Promise<void>;
  onRevokeInvitation: (invitationId: string) => Promise<void>;
  onToggleRole: (memberId: string, currentRole: Role) => Promise<void>;
  onRemoveMember: (memberId: string, memberRole: Role) => Promise<void>;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Manage team members and their roles</CardDescription>
      </CardHeader>
      <CardContent>
        <InviteCollaboratorForm
          email={email}
          role={role}
          onEmailChange={onEmailChange}
          onRoleChange={onRoleChange}
          onSubmit={onInvite}
        />
        <PendingInvitationsList invitations={invitations} onRevoke={onRevokeInvitation} />
        <CurrentMembersList
          members={members}
          isTeamOwner={isTeamOwner}
          onToggleRole={onToggleRole}
          onRemoveMember={onRemoveMember}
        />
      </CardContent>
    </Card>
  );
}

export function CollaborateCard({
  email,
  role,
  invitations,
  onEmailChange,
  onRoleChange,
  onInvite,
  onRevokeInvitation,
}: {
  email: string;
  role: Role;
  invitations: TeamInvitation[];
  onEmailChange: (value: string) => void;
  onRoleChange: (role: Role) => void;
  onInvite: (event: FormEvent) => Promise<void>;
  onRevokeInvitation: (invitationId: string) => Promise<void>;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Collaborate with Others</CardTitle>
        <CardDescription>
          Invite team members to collaborate on queries with peer review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground">
          Working solo? Your queries are auto-approved. When you're ready to collaborate, invite
          others to enable peer review workflows.
        </p>
        <InviteCollaboratorForm
          email={email}
          role={role}
          onEmailChange={onEmailChange}
          onRoleChange={onRoleChange}
          onSubmit={onInvite}
        />
        <PendingInvitationsList invitations={invitations} onRevoke={onRevokeInvitation} />
      </CardContent>
    </Card>
  );
}

export function TransferOwnershipCard({ canTransfer, onOpenDialog }: TransferOwnershipCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Transfer Ownership</CardTitle>
        <CardDescription>Transfer team ownership to another member</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={onOpenDialog} disabled={!canTransfer}>
          Transfer Ownership
        </Button>
        {!canTransfer && (
          <p className="mt-2 text-sm text-muted-foreground">
            You need at least one other member to transfer ownership.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ApprovalQuotaCard({
  approvalQuota,
  onApprovalQuotaChange,
  onSubmit,
}: ApprovalQuotaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval Quota</CardTitle>
        <CardDescription>Set the number of approvals required for queries</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="quota">Approval Quota</Label>
              <Input
                id="quota"
                type="number"
                min="1"
                value={approvalQuota}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  if (Number.isNaN(next)) {
                    onApprovalQuotaChange(1);
                    return;
                  }
                  onApprovalQuotaChange(next);
                }}
                required
              />
            </div>
            <Button type="submit" className="mt-auto">
              Update
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TransferOwnershipDialog({
  open,
  selectedNewOwner,
  currentOwnerId,
  members,
  onOpenChange,
  onSelectOwner,
  onTransfer,
}: TransferOwnershipDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
          <AlertDialogDescription>
            Transfer team ownership to another member. The new owner will become the primary admin
            of the team. You will remain an admin but lose ownership privileges. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="new-owner">Select New Owner</Label>
          <Select value={selectedNewOwner} onValueChange={onSelectOwner}>
            <SelectTrigger id="new-owner">
              <SelectValue placeholder="Select a member" />
            </SelectTrigger>
            <SelectContent>
              {members
                .filter((member) => member.user_id !== currentOwnerId)
                .map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.email} ({member.role})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void onTransfer();
            }}
            disabled={!selectedNewOwner}
          >
            Confirm Transfer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
