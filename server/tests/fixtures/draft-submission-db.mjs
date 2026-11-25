import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

export function openDraftSubmissionTestDatabase(databaseUrl) {
  const target = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('Draft submission fixtures require an isolated local test database');
  }

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });

  return {
    async seedDraft(folderId, draft) {
      const result = await pool.query(
        `insert into public.sql_queries (
           folder_id, team_id, user_id, title, description, sql_content,
           created_by_email, last_modified_by_email
         )
         select id, team_id, user_id, $2, $3, $4, created_by_email, created_by_email
         from public.folders
         where id = $1`,
        [folderId, draft.title, draft.description, draft.sql_content],
      );
      if (result.rowCount !== 1)
        throw new Error('Could not seed an existing draft in the test folder');
    },
    async addReviewer(queryId, email) {
      const result = await pool.query(
        `insert into public.team_members (team_id, user_id)
         select q.team_id, u.id
         from public.sql_queries q cross join auth.users u
         where q.id = $1 and u.email = $2`,
        [queryId, email],
      );
      if (result.rowCount !== 1)
        throw new Error('Could not add the test reviewer to the draft team');
    },
    async rejectHistoryWrites(queryId) {
      const name = `draft_test_${randomUUID().replaceAll('-', '')}`;
      const { rows } = await pool.query(
        `select format(
           'alter table public.query_history add constraint %I check (query_id <> %L::uuid) not valid',
           $1::text, $2::uuid
         ) as ddl`,
        [name, queryId],
      );
      await pool.query(rows[0].ddl);
      return async () => {
        await pool.query(`alter table public.query_history drop constraint ${name}`);
      };
    },
    close: () => pool.end(),
  };
}
