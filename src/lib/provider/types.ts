export type UUID = string;

export interface UserIdentity {
  id: UUID;
  email: string;
  full_name?: string | null;
}

export interface AuthAdapter {
  getSessionUser(): Promise<UserIdentity | null>;
  signInWithPassword?(email: string, password: string): Promise<void>;
  signInWithOAuth?(provider: 'google'): Promise<void>;
  signOut(): Promise<void>;
}

export interface Team {
  id: UUID;
  name: string;
  approval_quota: number;
  admin_id: UUID;
  is_personal?: boolean;
}

export interface Folder {
  id: UUID;
  name: string;
  team_id: UUID;
  parent_folder_id?: UUID | null;
  description?: string | null;
  created_at?: string;
  created_by_email?: string | null;
}

export interface FolderPath {
  id: UUID;
  full_path: string;
}

export type QueryStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface SqlQuery {
  id: UUID;
  title: string;
  description?: string | null;
  sql_content: string;
  status: QueryStatus;
  team_id: UUID;
  folder_id?: UUID | null;
  created_by_email?: string | null;
  last_modified_by_email?: string | null;
}

export type Role = 'admin' | 'member';

export interface TeamsRepo {
  listForUser(): Promise<(Team & { role?: Role })[]>;
  getById(id: UUID): Promise<Team | null>;
  create(name: string, approvalQuota?: number): Promise<Team>;
  update(id: UUID, data: { approval_quota?: number; name?: string }): Promise<void>;
  remove(id: UUID): Promise<void>;
  transferOwnership(id: UUID, newOwnerUserId: UUID): Promise<void>;
}

export interface FoldersRepo {
  listByTeam(teamId: UUID): Promise<Folder[]>;
  listPaths(teamId: UUID): Promise<FolderPath[]>;
  getById(id: UUID): Promise<Folder | null>;
  create(input: { team_id: UUID; name: string; parent_folder_id?: UUID | null; description?: string | null; created_by_email?: string | null; user_id?: UUID }): Promise<Folder>;
}

export interface QueryHistory {
  id: UUID;
  query_id: UUID;
  sql_content: string;
  modified_by_email: string;
  change_reason?: string | null;
  status: QueryStatus;
  created_at: string;
}

export interface QueryApproval {
  id: UUID;
  query_history_id: UUID;
  user_id: UUID;
  created_at: string;
}

export interface TeamMember {
  id: UUID;
  user_id: UUID;
  team_id: UUID;
  role: Role;
  email?: string;
}

export interface TeamInvitation {
  id: UUID;
  team_id: UUID;
  invited_email: string;
  role: Role;
  status: 'pending' | 'accepted' | 'declined';
  invited_by_user_id?: UUID;
  created_at: string;
  team_name?: string;
  inviter_email?: string;
  inviter_full_name?: string;
}

export interface QueriesRepo {
  getById(id: UUID): Promise<SqlQuery | null>;
  search(params: { teamId: UUID; q?: string }): Promise<SqlQuery[]>;
  create(input: Partial<SqlQuery> & { title: string; sql_content: string; team_id: UUID }): Promise<SqlQuery>;
  update(id: UUID, patch: Partial<SqlQuery>): Promise<void>;
  remove(id: UUID): Promise<void>;
  submitForApproval(
    id: UUID,
    sql: string,
    opts?: { modified_by_email?: string | null; change_reason?: string | null; team_id?: UUID; user_id?: UUID }
  ): Promise<void>;
  approve(id: UUID, historyId: UUID): Promise<void>;
  reject(id: UUID, historyId: UUID, reason?: string): Promise<void>;
  getHistory(id: UUID): Promise<QueryHistory[]>;
  getApprovals(id: UUID): Promise<{ approvals: QueryApproval[]; approval_quota: number; latest_history_id?: UUID }>;
  getPendingForApproval(teamId: UUID, excludeEmail: string): Promise<PendingApprovalQuery[]>;
}

export interface PendingApprovalQuery {
  id: UUID;
  title: string;
  description: string | null;
  folder_id: UUID;
  last_modified_by_email: string;
  updated_at: string;
  folder_name: string;
  approval_count: number;
  approval_quota: number;
}

export interface TeamMembersRepo {
  list(teamId: UUID): Promise<TeamMember[]>;
  remove(teamId: UUID, memberId: UUID): Promise<void>;
  updateRole(teamId: UUID, memberId: UUID, role: Role): Promise<void>;
}

export interface InvitationsRepo {
  listMine(): Promise<TeamInvitation[]>;
  listByTeam(teamId: UUID): Promise<TeamInvitation[]>;
  create(teamId: UUID, email: string, role: Role): Promise<void>;
  accept(id: UUID): Promise<void>;
  decline(id: UUID): Promise<void>;
  revoke(id: UUID): Promise<void>;
}

export interface DbAdapter {
  teams: TeamsRepo;
  folders: FoldersRepo;
  queries: QueriesRepo;
  members: TeamMembersRepo;
  invitations: InvitationsRepo;
}
