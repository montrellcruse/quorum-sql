import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, requireTeamAdmin, isValidUUID } from '../middleware/auth.js';
import {
  CreateInviteBodySchema,
  type CreateInviteBody,
  type IdParams,
} from '../schemas.js';

export default async function invitationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get('/invites/mine', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    return fastify.withReadClient(sess.id, async (client) => {
      const { rows } = await client.query(
        `select i.id, i.team_id, i.invited_email, i.role, i.invited_by_user_id, i.status, i.created_at,
                t.name as team_name, p.email as inviter_email, p.full_name as inviter_full_name
         from public.team_invitations i
         join public.teams t on t.id = i.team_id
         left join public.profiles p on p.user_id = i.invited_by_user_id
         where lower(i.invited_email) = lower((select email from auth.users where id = auth.uid())) and i.status = 'pending'
         order by i.created_at desc`,
      );
      return rows;
    });
  });

  fastify.get<{ Params: IdParams }>('/teams/:id/invites', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    return fastify.withReadClient(sess.id, async (client) => {
      // Verify admin status
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can view invitations' });
      }

      const { rows } = await client.query(
        `select i.* from public.team_invitations i
         where i.team_id = $1 and i.status = 'pending'
         order by i.created_at desc`,
        [id],
      );
      return rows;
    });
  });

  fastify.post<{ Params: IdParams; Body: CreateInviteBody }>('/teams/:id/invites', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid team ID' });
    }

    const parsed = CreateInviteBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { invited_email, role } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      // Verify admin status
      const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can send invitations' });
      }

      await client.query(
        `insert into public.team_invitations(team_id, invited_email, role, status, invited_by_user_id)
         select $1, $2, $3, 'pending', auth.uid()
         where not exists (
           select 1 from public.team_invitations where team_id = $1 and lower(invited_email) = lower($2) and status = 'pending'
         )`,
        [id, invited_email.trim().toLowerCase(), role],
      );

      req.log.info({ teamId: id, invitedEmail: invited_email, role, invitedBy: sess.id }, 'ADMIN: Invitation sent');
      return { ok: true };
    });
  });

  fastify.post<{ Params: IdParams }>('/invites/:id/accept', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid invite ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      const invRes = await client.query(
        'select * from public.team_invitations where id = $1 and status = \'pending\'',
        [id],
      );
      const inv = invRes.rows[0];
      if (!inv) return reply.code(404).send({ error: 'Invite not found' });

      // Confirm invited email matches current user
      const me = await client.query('select email from auth.users where id = auth.uid()');
      if (!me.rows[0] || me.rows[0].email.toLowerCase() !== inv.invited_email.toLowerCase()) {
        req.log.warn({ inviteId: id, userId: sess.id }, 'AUTH FAILURE: Attempted to accept invite for another user');
        return reply.code(403).send({ error: 'Forbidden' });
      }

      // Insert membership if not exists
      await client.query(
        `insert into public.team_members(team_id, user_id, role)
         select $1, auth.uid(), $2
         where not exists (
           select 1 from public.team_members where team_id = $1 and user_id = auth.uid()
         )`,
        [inv.team_id, inv.role],
      );

      // Delete invitation
      await client.query('delete from public.team_invitations where id = $1', [id]);

      req.log.info({ inviteId: id, teamId: inv.team_id, userId: sess.id }, 'Invitation accepted');
      return { ok: true };
    });
  });

  fastify.post<{ Params: IdParams }>('/invites/:id/decline', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid invite ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Verify the invite belongs to the current user
      const invRes = await client.query(
        `select i.id, i.team_id from public.team_invitations i
         where i.id = $1 and i.status = 'pending'
         and lower(i.invited_email) = lower((select email from auth.users where id = auth.uid()))`,
        [id],
      );

      if (!invRes.rows[0]) {
        return reply.code(404).send({ error: 'Invite not found' });
      }

      await client.query('delete from public.team_invitations where id = $1', [id]);

      req.log.info({ inviteId: id, userId: sess.id }, 'Invitation declined');
      return { ok: true };
    });
  });

  fastify.delete<{ Params: IdParams }>('/invites/:id', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid invite ID' });
    }

    return fastify.withClient(sess.id, async (client) => {
      // Get the invite to check team ownership
      const invRes = await client.query(
        'select team_id from public.team_invitations where id = $1',
        [id],
      );

      if (!invRes.rows[0]) {
        return reply.code(404).send({ error: 'Invite not found' });
      }

      const teamId = invRes.rows[0].team_id;

      // Verify admin status
      const isAdmin = await requireTeamAdmin(client, sess.id, teamId, req);
      if (!isAdmin) {
        return reply.code(403).send({ error: 'Only team admins can revoke invitations' });
      }

      await client.query('delete from public.team_invitations where id = $1', [id]);

      req.log.info({ inviteId: id, teamId, revokedBy: sess.id }, 'ADMIN: Invitation revoked');
      return { ok: true };
    });
  });
}
