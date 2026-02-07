import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, requireTeamAdmin, requireTeamMember, isValidUUID } from '../middleware/auth.js';
import {
  UpdateMemberRoleBodySchema,
  type IdParams,
  type TeamMemberParams,
  type UpdateMemberRoleBody,
} from '../schemas.js';

export default async function memberRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Params: IdParams }>('/teams/:id/members', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      // Verify user is a team member
      const isMember = await requireTeamMember(client, sess.id, id, req);
      if (!isMember) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      const { rows } = await client.query(
        `select tm.id, tm.user_id, tm.role, p.email
         from public.team_members tm
         join public.profiles p on p.user_id = tm.user_id
         where tm.team_id = $1`,
        [id],
      );
      return rows;
    });
  });

  fastify.delete<{ Params: TeamMemberParams }>('/teams/:id/members/:memberId', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id, memberId } = req.params;

    if (!isValidUUID(id) || !isValidUUID(memberId)) {
      return reply.code(400).send({ error: 'Invalid ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Verify admin status
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can remove members' });
      }

      // Get the member being removed
      const { rows: memberRows } = await client.query(
        'select user_id from public.team_members where id = $1 and team_id = $2',
        [memberId, id],
      );

      if (!memberRows[0]) {
        return reply.code(404).send({ error: 'Member not found' });
      }

      // Prevent removing the team owner
      const { rows: teamRows } = await client.query(
        'select admin_id from public.teams where id = $1',
        [id],
      );

      if (teamRows[0]?.admin_id === memberRows[0].user_id) {
        return reply.code(400).send({ error: 'Cannot remove the team owner' });
      }

      await client.query('delete from public.team_members where id = $1', [memberId]);

      req.log.info({ teamId: id, memberId, removedBy: sess.id }, 'ADMIN: Team member removed');
      return { ok: true };
    });
  });

  fastify.patch<{ Params: TeamMemberParams; Body: UpdateMemberRoleBody }>(
    '/teams/:id/members/:memberId',
    async (req, reply) => {
      const sess = req.user;
      if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
      const { id, memberId } = req.params;

      if (!isValidUUID(id) || !isValidUUID(memberId)) {
        return reply.code(400).send({ error: 'Invalid ID' });
      }

      const parsed = UpdateMemberRoleBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
      }

      const { role } = parsed.data;

      return fastify.withClient(sess.id, async (client) => {
        // Verify admin status
        const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
        if (!isAdmin) {
          return reply.code(403).send({ error: 'Only team admins can update member roles' });
        }

        // Get the member being updated
        const { rows: memberRows } = await client.query(
          'select user_id from public.team_members where id = $1 and team_id = $2',
          [memberId, id],
        );

        if (!memberRows[0]) {
          return reply.code(404).send({ error: 'Member not found' });
        }

        // Prevent demoting the team owner
        const { rows: teamRows } = await client.query(
          'select admin_id from public.teams where id = $1',
          [id],
        );

        if (teamRows[0]?.admin_id === memberRows[0].user_id && role !== 'admin') {
          return reply.code(400).send({ error: 'Cannot demote the team owner' });
        }

        await client.query(
          'update public.team_members set role = $1 where id = $2',
          [role, memberId],
        );

        req.log.info({ teamId: id, memberId, role, updatedBy: sess.id }, 'ADMIN: Team member role updated');
        return { ok: true };
      });
    },
  );
}
