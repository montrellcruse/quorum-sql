import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

interface TestWorkspaceDatabase {
  createWorkspace(name: string, ownerEmail: string): Promise<void>;
  seedFolderPages(parentId: string): Promise<void>;
  addReviewer(folderId: string, email: string): Promise<void>;
  rejectHistoryWrites(queryId: string): Promise<() => Promise<void>>;
  rejectNewHistoryWrites(reason: string): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export function openWorkspaceTestDatabase(databaseUrl: string): TestWorkspaceDatabase {
  const target = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('Workspace fixtures require an isolated local test database');
  }

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

  async function rejectHistoryWrite(
    column: 'query_id' | 'change_reason',
    value: string,
  ): Promise<() => Promise<void>> {
    const name = `draft_test_${randomUUID().replaceAll('-', '')}`;
    const { rows } = await pool.query<{ ddl: string }>(
      `select format(
         'alter table public.query_history add constraint %I check (%I::text is distinct from %L) not valid',
         $1::text, $2::text, $3::text
       ) as ddl`,
      [name, column, value],
    );
    await pool.query(rows[0].ddl);
    return async () => {
      await pool.query(`alter table public.query_history drop constraint ${name}`);
    };
  }

  return {
    async createWorkspace(name, ownerEmail) {
      const result = await pool.query(
        `with workspace as (
           insert into public.teams (name, admin_id)
           select $1, id from auth.users where email = $2
           returning id, admin_id
         )
         insert into public.team_members (team_id, user_id, role)
         select id, admin_id, 'admin' from workspace`,
        [name, ownerEmail],
      );
      if (result.rowCount !== 1) throw new Error('Could not create a test workspace');
    },
    async seedFolderPages(parentId) {
      await pool.query(
        `insert into public.folders (team_id, user_id, created_by_email, name, parent_folder_id, description)
         select p.team_id, p.user_id, p.created_by_email, seed.name, seed.parent_folder_id, seed.description
         from public.folders p
         cross join lateral (
           select 'A nested ' || lpad(n::text, 3, '0') as name, p.id as parent_folder_id, null::text as description
           from generate_series(1, 51) n
           union all
           select 'Root ' || lpad(least(n, 49)::text, 3, '0'), null::uuid, 'Root record ' || n
           from generate_series(1, 51) n
         ) seed
         where p.id = $1`,
        [parentId],
      );
    },
    async addReviewer(folderId, email) {
      const result = await pool.query(
        `insert into public.team_members (team_id, user_id)
         select q.team_id, u.id
         from public.folders q cross join auth.users u
         where q.id = $1 and u.email = $2`,
        [folderId, email],
      );
      if (result.rowCount !== 1)
        throw new Error('Could not add the test reviewer to the draft team');
    },
    rejectHistoryWrites: (queryId) => rejectHistoryWrite('query_id', queryId),
    rejectNewHistoryWrites: (reason) => rejectHistoryWrite('change_reason', reason),
    close: () => pool.end(),
  };
}
