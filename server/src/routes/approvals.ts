import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser, isValidUUID } from '../middleware/auth.js';
import {
  ApproveQueryBodySchema,
  RejectQueryBodySchema,
  SubmitQueryBodySchema,
  type ApprovalsQuery,
  type ApproveQueryBody,
  type IdParams,
  type RejectQueryBody,
  type SubmitQueryBody,
} from '../schemas.js';

// Check if error is a missing table (42P01 = undefined_table)
function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === '42P01';
}

export default async function approvalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuthenticatedUser);

  fastify.get<{ Params: IdParams }>('/queries/:id/history', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    try {
      return await fastify.withReadClient(sess.id, async (client) => {
        const { rows } = await client.query(
          'select * from public.query_history where query_id = $1 order by created_at desc limit 100',
          [id],
        );
        return rows;
      });
    } catch (err) {
      if (isMissingTable(err)) return [];
      throw err;
    }
  });

  fastify.get<{ Params: IdParams }>('/queries/:id/approvals', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    try {
      return await fastify.withReadClient(sess.id, async (client) => {
        const quotaRes = await client.query(
          `select q.team_id, t.approval_quota
           from public.sql_queries q
           join public.teams t on t.id = q.team_id
           where q.id = $1`,
          [id],
        );
        const approval_quota = quotaRes.rows[0]?.approval_quota || 1;

        const histRes = await client.query(
          'select id from public.query_history where query_id = $1 order by created_at desc limit 1',
          [id],
        );
        const latestId = histRes.rows[0]?.id;

        if (!latestId) return { approvals: [], approval_quota };

        const apprRes = await client.query(
          'select * from public.query_approvals where query_history_id = $1',
          [latestId],
        );
        return { approvals: apprRes.rows, approval_quota, latest_history_id: latestId };
      });
    } catch (err) {
      if (isMissingTable(err)) return { approvals: [], approval_quota: 1 };
      throw err;
    }
  });

  fastify.get<{ Querystring: ApprovalsQuery }>('/approvals', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

    const { teamId, excludeEmail = '' } = req.query;

    if (!teamId || !isValidUUID(teamId)) {
      return reply.code(400).send({ error: 'Valid teamId is required' });
    }

    try {
      return await fastify.withReadClient(sess.id, async (client) => {
        const { rows } = await client.query(
          `with latest_hist as (
             select h.query_id, (array_agg(h.id order by h.created_at desc))[1] as latest_id
             from public.query_history h
             group by h.query_id
           ),
           appr as (
             select lh.query_id, count(qa.id) as approval_count
             from latest_hist lh
             left join public.query_approvals qa on qa.query_history_id = lh.latest_id
             group by lh.query_id
           )
           select q.id, q.title, q.description, q.folder_id, q.last_modified_by_email, q.updated_at,
                  f.name as folder_name, coalesce(a.approval_count,0) as approval_count, t.approval_quota
           from public.sql_queries q
           join public.teams t on t.id = q.team_id
           left join public.folders f on f.id = q.folder_id
           left join appr a on a.query_id = q.id
           where q.team_id = $1 and q.status = 'pending_approval'
             and (q.last_modified_by_email is null or lower(q.last_modified_by_email) <> lower($2))
           order by q.updated_at desc`,
          [teamId, excludeEmail.trim().toLowerCase()],
        );
        return rows;
      });
    } catch (err) {
      if (isMissingTable(err)) return [];
      throw err;
    }
  });

  fastify.post<{ Params: IdParams; Body: SubmitQueryBody }>('/queries/:id/submit', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    const parsed = SubmitQueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { sql, modified_by_email: rawModifiedByEmail = null, change_reason = null, team_id = null } = parsed.data;
    // Issue #78: Normalize email to lowercase
    const modified_by_email = rawModifiedByEmail?.trim().toLowerCase() ?? null;
    // Issue #79: Always use authenticated user ID from session, never trust client-supplied user_id

    return fastify.withClient(sess.id, async (client) => {
      try {
        await client.query('select public.submit_query_for_approval($1, $2, $3, $4, $5, $6)', [
          id,
          sql || null,
          modified_by_email,
          change_reason,
          team_id,
          sess.id,
        ]);
        return { ok: true };
      } catch (error) {
        req.log.warn(
          { err: error, queryId: id, userId: sess.id },
          'submit_query_for_approval v2 failed, falling back to legacy signature',
        );
        // Fallback for older function signature
        await client.query('select public.submit_query_for_approval($1, $2)', [id, sql || null]);
        return { ok: true };
      }
    });
  });

  fastify.post<{ Params: IdParams; Body: ApproveQueryBody }>('/queries/:id/approve', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    const parsed = ApproveQueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { historyId } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      // Get approver email for the RPC call
      const { rows: userRows } = await client.query(
        'select email from auth.users where id = $1',
        [sess.id],
      );
      const approverEmail = userRows[0]?.email;

      await client.query('select public.approve_query_with_quota($1, $2, $3)', [historyId, sess.id, approverEmail]);
      req.log.info({ queryId: id, historyId, userId: sess.id }, 'Query approved');
      return { ok: true };
    });
  });

  fastify.post<{ Params: IdParams; Body: RejectQueryBody }>('/queries/:id/reject', async (req, reply) => {
    const sess = req.user;
    if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params;

    if (!isValidUUID(id)) {
      return reply.code(400).send({ error: 'Invalid query ID' });
    }

    const parsed = RejectQueryBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { historyId, reason = null } = parsed.data;

    return fastify.withClient(sess.id, async (client) => {
      // Pass rejecter user ID (not reason) as the function expects
      await client.query('select public.reject_query_with_authorization($1, $2, $3)', [historyId, sess.id, reason]);
      req.log.info({ queryId: id, historyId, reason, userId: sess.id }, 'Query rejected');
      return { ok: true };
    });
  });
}
