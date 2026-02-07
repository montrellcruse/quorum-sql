import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, requireTeamAdmin, requireTeamMember, isValidUUID } from '../middleware/auth.js';
import {
  ConvertPersonalBodySchema,
  CreateTeamBodySchema,
  TransferOwnershipBodySchema,
  UpdateTeamBodySchema,
  type ConvertPersonalBody,
  type CreateTeamBody,
  type IdParams,
  type TransferOwnershipBody,
  type UpdateTeamBody,
} from '../schemas.js';

export default async function teamRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get('/teams', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    return fastify.withReadClient(sess.id, async (client) => {
      const { rows } = await client.query(
        `select distinct on (t.id)
                t.id, t.name, t.approval_quota, t.admin_id, t.is_personal,
                tm.role
         from public.team_members tm
         join public.teams t on t.id = tm.team_id
         where tm.user_id = auth.uid()
         order by t.id, case when tm.role = 'admin' then 0 else 1 end, t.name`,
      );
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/teams/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      const { rows } = await client.query(
        'select id, name, approval_quota, admin_id, is_personal from public.teams where id = $1',
        [id],
      );
      return rows[0] || null;
    });
  });

  fastify.post<{ Body: CreateTeamBody }>('/teams', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const parsed = CreateTeamBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { name, approval_quota = 1 } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      const tRes = await client.query(
        `insert into public.teams(name, approval_quota, admin_id)
         values ($1, $2, auth.uid()) returning id, name, approval_quota, admin_id, is_personal, created_at`,
        [name, approval_quota],
      );
      const team = tRes.rows[0];
      await client.query(
        `insert into public.team_members(team_id, user_id, role)
         values($1, auth.uid(), 'admin') on conflict do nothing`,
        [team.id],
      );

      req.log.info({ teamId: team.id, userId: sess.id }, 'ADMIN: Team created');
      return team;
    });
  });

  fastify.patch<{ Params: IdParams; Body: UpdateTeamBody }>('/teams/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    const parsed = UpdateTeamBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { approval_quota, name } = parsed.data;
    if (approval_quota === undefined && name === undefined) {
      return reply.code(400).send({ error: 'No updates provided' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Verify admin status
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can update team settings' });
      }

      const updates = [];
      const values = [];
      if (approval_quota !== undefined) {
        values.push(approval_quota);
        updates.push(`approval_quota = $${values.length}`);
      }
      if (name !== undefined) {
        values.push(name);
        updates.push(`name = $${values.length}`);
      }
      values.push(id);
      await client.query(
        `update public.teams set ${updates.join(', ')} where id = $${values.length}`,
        values,
      );

      req.log.info({ teamId: id, userId: sess.id, approval_quota, name }, 'ADMIN: Team settings updated');
      return { ok: true };
    });
  });

  fastify.post<{ Params: IdParams; Body: ConvertPersonalBody }>('/teams/:id/convert-personal', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    const parsed = ConvertPersonalBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { name } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can convert personal teams' });
      }

      const { rows } = await client.query(
        'select public.convert_personal_to_team($1, $2) as converted',
        [id, name || null],
      );
      return { ok: true, converted: rows[0]?.converted ?? false };
    });
  });

  fastify.delete<{ Params: IdParams }>('/teams/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can delete teams' });
      }

      const { rows: teamRows } = await client.query(
        'select is_personal from public.teams where id = $1',
        [id],
      );
      if (teamRows.length === 0) {
        return reply.code(404).send({ error: 'Team not found' });
      }

      if (teamRows[0].is_personal) {
        const { rows: countRows } = await client.query(
          'select count(*)::int as member_count from public.team_members where team_id = $1',
          [id],
        );
        if ((countRows[0]?.member_count || 0) <= 1) {
          return reply.code(400).send({
            error: 'Cannot delete your personal workspace. Create a new team first.',
          });
        }
      }

      await client.query('delete from public.teams where id = $1', [id]);
      req.log.info({ teamId: id, userId: sess.id }, 'ADMIN: Team deleted');
      return { ok: true };
    });
  });

  fastify.post<{ Params: IdParams; Body: TransferOwnershipBody }>('/teams/:id/transfer-ownership', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    const parsed = TransferOwnershipBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { new_owner_user_id } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      // Verify current user is the team owner
      const { rows: teamRows } = await client.query(
        'select admin_id from public.teams where id = $1',
        [id],
      );

      if (!teamRows[0] || teamRows[0].admin_id !== sess.id) {
        req.log.warn({ teamId: id, userId: sess.id }, 'AUTH FAILURE: Non-owner attempted ownership transfer');
        return reply.code(403).send({ error: 'Only the team owner can transfer ownership' });
      }

      // Ensure new owner is a team member
      const isMember = await requireTeamMember(client, new_owner_user_id, id, req);
      if (!isMember) {
        return reply.code(400).send({ error: 'New owner must be a team member' });
      }

      // Make new owner admin and transfer ownership
      await client.query(
        `update public.team_members set role = 'admin' where team_id = $1 and user_id = $2`,
        [id, new_owner_user_id],
      );
      await client.query(
        'update public.teams set admin_id = $1 where id = $2',
        [new_owner_user_id, id],
      );

      req.log.info({ teamId: id, oldOwner: sess.id, newOwner: new_owner_user_id }, 'ADMIN: Team ownership transferred');
      return { ok: true };
    });
  });
}
