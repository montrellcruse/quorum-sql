import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { createPool } from './db.js';
import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';

const fastify = Fastify({ logger: true });
await fastify.register(cookie);
await fastify.register(cors, {
  origin: true,
  credentials: true,
});
const pool = createPool();

const SESSION_SECRET = (process.env.SESSION_SECRET || 'dev-secret').padEnd(32, 'x');
const DEV_FAKE_USER_ID = process.env.DEV_FAKE_USER_ID || '11111111-1111-1111-1111-111111111111';
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/keys` : null);

let supabaseJWKS = null;
function getSupabaseJWKS() {
  if (!SUPABASE_JWKS_URL) return null;
  if (!supabaseJWKS) {
    try {
      supabaseJWKS = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
    } catch (e) {
      supabaseJWKS = null;
    }
  }
  return supabaseJWKS;
}

async function withClient(userId, fn) {
  const client = await pool.connect();
  try {
    if (userId) {
      await client.query('set local app.user_id = $1', [userId]);
      await client.query("set local app.role = 'authenticated'");
    }
    return await fn(client);
  } finally {
    client.release();
  }
}

async function getSessionUser(req) {
  try {
    // 1) Authorization: Bearer <token> (try Supabase JWT)
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      const JWKS = getSupabaseJWKS();
      if (JWKS) {
        try {
          const { payload } = await jwtVerify(token, JWKS, {
            algorithms: ['RS256'],
            // issuer/audience verification can be enabled if configured
          });
          return {
            id: payload.sub,
            email: payload.email,
            role: payload.role || 'authenticated',
            source: 'supabase',
          };
        } catch {}
      }
      // If Supabase verification not configured or failed, fall through
    }

    // 2) Cookie-based local session
    const token = req.cookies.session;
    if (token) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(SESSION_SECRET));
      return { id: payload.sub, email: payload.email, role: 'authenticated', source: 'local' };
    }
  } catch {}
  const headerUser = req.headers['x-user-id'];
  if (headerUser && process.env.NODE_ENV !== 'production') {
    return { id: String(headerUser) };
  }
  if (process.env.NODE_ENV !== 'production') {
    return { id: DEV_FAKE_USER_ID };
  }
  return null;
}

fastify.get('/health', async () => ({ ok: true }));

fastify.get('/health/db', async () => {
  return withClient(null, async (client) => {
    const { rows } = await client.query('select now() as now');
    return { ok: true, now: rows[0].now };
  });
});

// Auth
fastify.get('/auth/me', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.send(null);
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query('select id, email, full_name from auth.users where id = $1', [sess.id]);
    return rows[0] || null;
  });
});

fastify.post('/auth/login', async (req, reply) => {
  const body = req.body || {};
  const email = body.email?.toString()?.trim().toLowerCase();
  if (!email) return reply.code(400).send('email required');
  const row = await withClient(null, async (client) => {
    const { rows } = await client.query('select id, email from auth.users where lower(email) = $1', [email]);
    return rows[0];
  });
  if (!row) return reply.code(401).send('invalid credentials');
  const token = await new SignJWT({ email: row.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(SESSION_SECRET));
  reply.setCookie('session', token, { httpOnly: true, sameSite: 'lax', path: '/' });
  return { ok: true };
});

fastify.post('/auth/logout', async (req, reply) => {
  reply.clearCookie('session', { path: '/' });
  return { ok: true };
});

// Teams
fastify.get('/teams', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select distinct on (t.id)
              t.id, t.name, t.approval_quota, t.admin_id,
              tm.role
       from public.team_members tm
       join public.teams t on t.id = tm.team_id
       where tm.user_id = auth.uid()
       order by t.id, case when tm.role = 'admin' then 0 else 1 end, t.name`
    );
    return rows;
  });
});

fastify.get('/teams/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select id, name, approval_quota, admin_id from public.teams where id = $1`,
      [id]
    );
    return rows[0] || null;
  });
});

fastify.post('/teams', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { name, approval_quota = 1 } = req.body || {};
  if (!name) return reply.code(400).send('name required');
  return withClient(sess.id, async (client) => {
    try {
      const call = await client.query('select * from public.create_team_with_admin($1, $2)', [name, approval_quota]);
      return call.rows?.[0] || { ok: true };
    } catch (e) {
      // Fallback manual insert if function not available
      const tRes = await client.query(
        `insert into public.teams(name, approval_quota, admin_id) values ($1, $2, auth.uid()) returning *`,
        [name, approval_quota]
      );
      const team = tRes.rows[0];
      await client.query(
        `insert into public.team_members(team_id, user_id, role) values($1, auth.uid(), 'admin') on conflict do nothing`,
        [team.id]
      );
      return team;
    }
  });
});

// Folders
fastify.get('/teams/:id/folders', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select * from public.folders where team_id = $1 order by name`,
      [id]
    );
    return rows;
  });
});

fastify.get('/folders/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(`select * from public.folders where id = $1`, [id]);
    return rows[0] || null;
  });
});

fastify.post('/folders', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const body = req.body || {};
  const { name, description = null, user_id = sess.id, created_by_email = null, parent_folder_id = null, team_id } = body;
  if (!name || !team_id) return reply.code(400).send('name and team_id required');
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `insert into public.folders(name, description, user_id, created_by_email, parent_folder_id, team_id)
       values($1,$2,$3,$4,$5,$6) returning *`,
      [name, description, user_id, created_by_email, parent_folder_id, team_id]
    );
    return rows[0];
  });
});

fastify.get('/folders/paths', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query('select * from public.get_all_folder_paths()');
    return rows;
  });
});

// Folder children
fastify.get('/folders/:id/children', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select * from public.folders where parent_folder_id = $1 order by name`,
      [id]
    );
    return rows;
  });
});

// Folder queries
fastify.get('/folders/:id/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select id, title, status, description, created_at, created_by_email, last_modified_by_email, updated_at
       from public.sql_queries where folder_id = $1 order by updated_at desc nulls last`,
      [id]
    );
    return rows;
  });
});

// Update/delete folder
fastify.patch('/folders/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { name = null, description = null } = req.body || {};
  return withClient(sess.id, async (client) => {
    await client.query(
      `update public.folders set name = coalesce($1, name), description = $2 where id = $3`,
      [name, description, id]
    );
    return { ok: true };
  });
});

fastify.delete('/folders/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    await client.query(`delete from public.folders where id = $1`, [id]);
    return { ok: true };
  });
});

// Queries
fastify.get('/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const teamId = req.query.teamId;
  const q = req.query.q;
  return withClient(sess.id, async (client) => {
    const params = [teamId];
    let sql = `select q.*, f.name as folder_name
               from public.sql_queries q
               left join public.folders f on f.id = q.folder_id
               where q.team_id = $1`;
    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      sql += ` and (q.title ilike $2 or q.description ilike $3 or q.sql_content ilike $4)`;
    }
    sql += ' order by q.updated_at desc nulls last';
    const { rows } = await client.query(sql, params);
    return rows;
  });
});

fastify.get('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(`select * from public.sql_queries where id = $1`, [id]);
    return rows[0] || null;
  });
});

fastify.post('/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const body = req.body || {};
  const fields = ['title', 'description', 'sql_content', 'status', 'team_id', 'folder_id', 'created_by_email', 'last_modified_by_email'];
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
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(sql, params);
    return rows[0];
  });
});

fastify.patch('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const body = req.body || {};
  const sets = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(body)) {
    sets.push(`${k} = $${i++}`);
    params.push(v);
  }
  params.push(id);
  const sql = `update public.sql_queries set ${sets.join(', ')} where id = $${i} returning id`;
  return withClient(sess.id, async (client) => {
    await client.query(sql, params);
    return { ok: true };
  });
});

// Query history and approvals
fastify.get('/queries/:id/history', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select * from public.query_history where query_id = $1 order by created_at desc limit 100`,
      [id]
    );
    return rows;
  });
});

fastify.get('/queries/:id/approvals', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const quotaRes = await client.query(
      `select q.team_id, t.approval_quota from public.sql_queries q join public.teams t on t.id = q.team_id where q.id = $1`,
      [id]
    );
    const approval_quota = quotaRes.rows[0]?.approval_quota || 1;
    const histRes = await client.query(
      `select id from public.query_history where query_id = $1 order by created_at desc limit 1`,
      [id]
    );
    const latestId = histRes.rows[0]?.id;
    if (!latestId) return { approvals: [], approval_quota };
    const apprRes = await client.query(
      `select * from public.query_approvals where query_history_id = $1`,
      [latestId]
    );
    return { approvals: apprRes.rows, approval_quota, latest_history_id: latestId };
  });
});

// Approvals queue
fastify.get('/approvals', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const teamId = req.query.teamId;
  const excludeEmail = req.query.excludeEmail || '';
  return withClient(sess.id, async (client) => {
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
       where q.team_id = $1 and q.status = 'pending_approval' and (q.last_modified_by_email is null or q.last_modified_by_email <> $2)
       order by q.updated_at desc`,
      [teamId, excludeEmail]
    );
    return rows;
  });
});

// Invitations
fastify.get('/invites/mine', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select i.id, i.team_id, i.invited_email, i.role, i.invited_by_user_id, i.status, i.created_at,
              t.name as team_name, p.email as inviter_email, p.full_name as inviter_full_name
       from public.team_invitations i
       join public.teams t on t.id = i.team_id
       left join public.profiles p on p.user_id = i.invited_by_user_id
       where i.invited_email = (select email from auth.users where id = auth.uid()) and i.status = 'pending'
       order by i.created_at desc`
    );
    return rows;
  });
});

fastify.post('/invites/:id/accept', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const invRes = await client.query(`select * from public.team_invitations where id = $1 and status = 'pending'`, [id]);
    const inv = invRes.rows[0];
    if (!inv) return reply.code(404).send('invite not found');
    // Confirm invited email matches current user
    const me = await client.query(`select email from auth.users where id = auth.uid()`);
    if (!me.rows[0] || me.rows[0].email.toLowerCase() !== inv.invited_email.toLowerCase()) {
      return reply.code(403).send('forbidden');
    }
    // Insert membership if not exists
    await client.query(
      `insert into public.team_members(team_id, user_id, role)
       select $1, auth.uid(), $2
       where not exists (
         select 1 from public.team_members where team_id = $1 and user_id = auth.uid()
       )`,
      [inv.team_id, inv.role]
    );
    // Delete invitation
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    return { ok: true };
  });
});

fastify.post('/invites/:id/decline', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    return { ok: true };
  });
});

// Admin revoke invite
fastify.delete('/invites/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    return { ok: true };
  });
});

// Team members/admin
fastify.get('/teams/:id/members', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select tm.id, tm.user_id, tm.role, p.email
       from public.team_members tm
       join public.profiles p on p.user_id = tm.user_id
       where tm.team_id = $1`,
      [id]
    );
    return rows;
  });
});

// Team invitations (admin)
fastify.get('/teams/:id/invites', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select i.* from public.team_invitations i where i.team_id = $1 and i.status = 'pending' order by i.created_at desc`,
      [id]
    );
    return rows;
  });
});

fastify.post('/teams/:id/invites', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { invited_email, role } = req.body || {};
  if (!invited_email || !role) return reply.code(400).send('invited_email and role required');
  return withClient(sess.id, async (client) => {
    // prevent duplicate pending invites
    await client.query(
      `insert into public.team_invitations(team_id, invited_email, role, status, invited_by_user_id)
       select $1, $2, $3, 'pending', auth.uid()
       where not exists (
         select 1 from public.team_invitations where team_id = $1 and invited_email = $2 and status = 'pending'
       )`,
      [id, invited_email.toLowerCase(), role]
    );
    return { ok: true };
  });
});

fastify.delete('/teams/:id/members/:memberId', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { memberId } = req.params;
  return withClient(sess.id, async (client) => {
    await client.query(`delete from public.team_members where id = $1`, [memberId]);
    return { ok: true };
  });
});

fastify.patch('/teams/:id/members/:memberId', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { memberId } = req.params;
  const { role } = req.body || {};
  return withClient(sess.id, async (client) => {
    await client.query(`update public.team_members set role = $1 where id = $2`, [role, memberId]);
    return { ok: true };
  });
});

fastify.patch('/teams/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { approval_quota } = req.body || {};
  return withClient(sess.id, async (client) => {
    await client.query(`update public.teams set approval_quota = $1 where id = $2`, [approval_quota, id]);
    return { ok: true };
  });
});

fastify.post('/teams/:id/transfer-ownership', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { new_owner_user_id } = req.body || {};
  return withClient(sess.id, async (client) => {
    // ensure new owner is admin
    await client.query(
      `update public.team_members set role = 'admin' where team_id = $1 and user_id = $2`,
      [id, new_owner_user_id]
    );
    await client.query(`update public.teams set admin_id = $1 where id = $2`, [new_owner_user_id, id]);
    return { ok: true };
  });
});

fastify.delete('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  return withClient(sess.id, async (client) => {
    await client.query(`delete from public.sql_queries where id = $1`, [id]);
    return { ok: true };
  });
});

fastify.post('/queries/:id/submit', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { sql, modified_by_email = null, change_reason = null, team_id = null, user_id = null } = req.body || {};
  return withClient(sess.id, async (client) => {
    try {
      await client.query('select public.submit_query_for_approval($1, $2, $3, $4, $5, $6)', [
        id,
        sql || null,
        modified_by_email,
        change_reason,
        team_id,
        user_id,
      ]);
      return { ok: true };
    } catch (e) {
      await client.query('select public.submit_query_for_approval($1, $2)', [id, sql || null]);
      return { ok: true };
    }
  });
});

fastify.post('/queries/:id/approve', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { historyId } = req.body || {};
  return withClient(sess.id, async (client) => {
    await client.query('select public.approve_query_with_quota($1, $2)', [id, historyId]);
    return { ok: true };
  });
});

fastify.post('/queries/:id/reject', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send('unauthorized');
  const { id } = req.params;
  const { historyId, reason = null } = req.body || {};
  return withClient(sess.id, async (client) => {
    await client.query('select public.reject_query_with_authorization($1, $2, $3)', [id, historyId, reason]);
    return { ok: true };
  });
});

const port = process.env.PORT ? Number(process.env.PORT) : 8787;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
