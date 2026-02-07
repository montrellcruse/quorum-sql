import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, requireTeamMember, isValidUUID } from '../middleware/auth.js';
import {
  CreateFolderBodySchema,
  UpdateFolderBodySchema,
  type CreateFolderBody,
  type FolderPathsQuery,
  type IdParams,
  type UpdateFolderBody,
} from '../schemas.js';

export default async function folderRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Params: IdParams }>('/teams/:id/folders', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      const { rows } = await client.query(
        'select * from public.folders where team_id = $1 order by name',
        [id],
      );
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/folders/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid folder ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      const { rows } = await client.query('select * from public.folders where id = $1', [id]);
      const folder = rows[0];
      if (!folder) return null;

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, folder.team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      return folder;
    });
  });

  fastify.get<{ Querystring: FolderPathsQuery }>('/folders/paths', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const { teamId } = req.query;
    if (!teamId || !isValidUUID(teamId)) {
      return reply.code(400).send({ error: 'Valid teamId query parameter is required' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, teamId, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Filter to only folders belonging to the user's team
      const { rows } = await client.query(
        `select fp.* from public.get_all_folder_paths() fp
         join public.folders f on f.id = fp.id
         where f.team_id = $1`,
        [teamId],
      );
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/folders/:id/children', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid folder ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      // Get the parent folder to check team membership
      const { rows: parentRows } = await client.query('select team_id from public.folders where id = $1', [id]);
      if (!parentRows[0]) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, parentRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const { rows } = await client.query(
        'select * from public.folders where parent_folder_id = $1 order by name',
        [id],
      );
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/folders/:id/queries', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid folder ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      // Get the folder to check team membership
      const { rows: folderRows } = await client.query('select team_id from public.folders where id = $1', [id]);
      if (!folderRows[0]) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, folderRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const { rows } = await client.query(
        `select id, title, status, description, created_at, created_by_email, last_modified_by_email, updated_at
         from public.sql_queries where folder_id = $1 order by updated_at desc nulls last`,
        [id],
      );
      return rows;
    });
  });

  fastify.post<{ Body: CreateFolderBody }>('/folders', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const parsed = CreateFolderBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const {
      name,
      description = null,
      created_by_email: rawCreatedByEmail = null,
      parent_folder_id = null,
      team_id,
    } = parsed.data;
    // Issue #79: Always use authenticated user ID, never trust client-supplied user_id
    const user_id = sess.id;
    // Issue #78: Normalize email to lowercase
    const created_by_email = rawCreatedByEmail?.trim().toLowerCase() ?? null;

    return fastify.withClient(sess.id, async (client) => {
      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // If parent_folder_id is provided, verify it belongs to the same team
      if (parent_folder_id) {
        const { rows: parentRows } = await client.query(
          'select team_id from public.folders where id = $1',
          [parent_folder_id],
        );
        if (!parentRows[0] || parentRows[0].team_id !== team_id) {
          return reply.code(400).send({ error: 'Parent folder must belong to the same team' });
        }
      }

      const { rows } = await client.query(
        `insert into public.folders(name, description, user_id, created_by_email, parent_folder_id, team_id)
         values($1,$2,$3,$4,$5,$6) returning *`,
        [name, description, user_id, created_by_email, parent_folder_id, team_id],
      );
      return rows[0];
    });
  });

  fastify.patch<{ Params: IdParams; Body: UpdateFolderBody }>('/folders/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid folder ID' });
    }

    const parsed = UpdateFolderBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { name = null, description = null } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      // Get the folder to check team membership
      const { rows: folderRows } = await client.query('select team_id from public.folders where id = $1', [id]);
      if (!folderRows[0]) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, folderRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await client.query(
        'update public.folders set name = coalesce($1, name), description = $2 where id = $3',
        [name, description, id],
      );
      return { ok: true };
    });
  });

  fastify.delete<{ Params: IdParams }>('/folders/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid folder ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Get the folder to check team membership
      const { rows: folderRows } = await client.query('select team_id from public.folders where id = $1', [id]);
      if (!folderRows[0]) {
        return reply.code(404).send({ error: 'Folder not found' });
      }

      // Validate team membership
      const isMember = await requireTeamMember(client, sess.id, folderRows[0].team_id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await client.query('delete from public.folders where id = $1', [id]);
      return { ok: true };
    });
  });
}
