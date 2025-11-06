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
}

export interface FoldersRepo {
  listByTeam(teamId: UUID): Promise<Folder[]>;
  getById(id: UUID): Promise<Folder | null>;
  create(input: { team_id: UUID; name: string; parent_folder_id?: UUID | null; description?: string | null; created_by_email?: string | null; user_id?: UUID }): Promise<Folder>;
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
}

export interface DbAdapter {
  teams: TeamsRepo;
  folders: FoldersRepo;
  queries: QueriesRepo;
}
