import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, requireTeamMember, isValidUUID } from '../middleware/auth.js';
import {
  CreateQueryBodySchema,
  UpdateQueryBodySchema,
  type CreateQueryBody,
  type IdParams,
  type TeamIdQuery,
  type UpdateQueryBody,
} from '../schemas.js';

export default async function queryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Querystring: TeamIdQuery }>('/queries', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const { teamId, q } = req.query;

    if (!teamId || !isValidUUID(teamId)) {
      return reply.code(400).send({ error: 'Valid teamId is required' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, teamId, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const params = [teamId];
      let sql = `select q.*, f.name as folder_name
                 from public.sql_queries q
                 left join public.folders f on f.id = q.folder_id
                 where q.team_id = $1`;
      if (q) {
        // Escape ILIKE wildcards to prevent injection
        const escapedQ = q.replace(/[%_\\]/g, '\\$&');
        params.push(`%${escapedQ}%`, `%${escapedQ}%`, `%${escapedQ}%`);
        sql += ' and (q.title ilike $2 or q.description ilike $3 or q.sql_content ilike $4)';
      }
      sql += ' order by q.updated_at desc nulls last';
      const { rows } = await client.query(sql, params);
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/queries/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      const { rows } = await client.query('select * from public.sql_queries where id = $1', [id]);
      const query = rows[0];
      if (!query) return null;

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, query.team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      return query;
    });
  });

  fastify.post<{ Body: CreateQueryBody }>('/queries', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const parsed = CreateQueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const body = parsed.data;

    // Issue #78: Normalize email fields to lowercase
    if (body.created_by_email) body.created_by_email = body.created_by_email.trim().toLowerCase();
    if (body.last_modified_by_email) body.last_modified_by_email = body.last_modified_by_email.trim().toLowerCase();

    return fastify.withClient(sess.id, async (client) => {
      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, body.team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // If folder_id is provided, verify it belongs to the same team
      if (body.folder_id) {
        const { rows: folderRows } = await client.query(
          'select team_id from public.folders where id = $1',
          [body.folder_id],
        );
        if (!folderRows[0] || folderRows[0].team_id !== body.team_id) {
          return reply.code(400).send({ error: 'Folder must belong to the same team' });
        }
      }

      const fields: Array<keyof CreateQueryBody> = [
        'title',
        'description',
        'sql_content',
        'status',
        'team_id',
        'folder_id',
        'created_by_email',
        'last_modified_by_email',
      ];
      const cols = [];
      const vals = [];
      const params = [];
      let i = 1;

      for (const f of fields) {
        if (body[f] !== undefined) {
          cols.push(f);
          vals.push(`$${i++}`);
          params.push(body[f]);
        }
      }
      cols.push('user_id');
      vals.push(`$${i}`);
      params.push(sess.id);

      const sql = `insert into public.sql_queries(${cols.join(',')}) values(${vals.join(',')}) returning *`;
      const { rows } = await client.query(sql, params);
      return rows[0];
    });
  });

  fastify.patch<{ Params: IdParams; Body: UpdateQueryBody }>('/queries/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    const parsed = UpdateQueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const body = parsed.data;

    // Issue #78: Normalize email fields to lowercase
    if (body.last_modified_by_email) body.last_modified_by_email = body.last_modified_by_email.trim().toLowerCase();

    return fastify.withClient(sess.id, async (client) => {
      // Get the query to check team membership
      const { rows: queryRows } = await client.query('select team_id from public.sql_queries where id = $1', [id]);
      if (!queryRows[0]) {
        return reply.code(404).send({ error: 'Query not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, queryRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // If folder_id is being changed, verify it belongs to the same team
      if (body.folder_id) {
        const { rows: folderRows } = await client.query(
          'select team_id from public.folders where id = $1',
          [body.folder_id],
        );
        if (!folderRows[0] || folderRows[0].team_id !== queryRows[0].team_id) {
          return reply.code(400).send({ error: 'Folder must belong to the same team' });
        }
      }

      const sets = [];
      const params = [];
      let i = 1;

      const entries = Object.entries(body) as Array<[keyof UpdateQueryBody, UpdateQueryBody[keyof UpdateQueryBody]]>;
      for (const [k, v] of entries) {
        if (v === undefined) continue;
        sets.push(`${k} = $${i++}`);
        params.push(v);
      }

      if (sets.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      params.push(id);
      const sql = `update public.sql_queries set ${sets.join(', ')} where id = $${i} returning id`;
      await client.query(sql, params);
      return { ok: true };
    });
  });

  fastify.delete<{ Params: IdParams }>('/queries/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Get the query to check team membership
      const { rows: queryRows } = await client.query('select team_id from public.sql_queries where id = $1', [id]);
      if (!queryRows[0]) {
        return reply.code(404).send({ error: 'Query not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, queryRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await client.query('delete from public.sql_queries where id = $1', [id]);
      return { ok: true };
    });
  });
}
