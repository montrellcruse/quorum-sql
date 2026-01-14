import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { SignJWT } from 'jose';
import { z } from 'zod';

import { createPool } from './db.js';
import { isProd, serverConfig, securityConfig } from './config.js';
import { getSessionUser, verifyPassword, hashPassword, requireTeamAdmin, requireTeamMember, isValidUUID } from './middleware/auth.js';
import { securityHeaders, errorHandler, requestLogger, csrfProtection, generateCsrfToken } from './middleware/security.js';

// Initialize Fastify with body size limit
const fastify = Fastify({ 
  logger: true,
  bodyLimit: 1048576, // 1MB default
});

// Register plugins
await fastify.register(cookie);

// Security headers and request logging
securityHeaders(fastify);
requestLogger(fastify);
errorHandler(fastify);

// CORS configuration
await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProd && securityConfig.corsOrigins.length === 0) return cb(null, true);
    if (securityConfig.corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
});

// Rate limiting
await fastify.register(rateLimit, {
  max: securityConfig.rateLimitMax,
  timeWindow: securityConfig.rateLimitWindow,
});

// CSRF protection
csrfProtection(fastify);

const pool = createPool();

// Database helper with RLS context
async function withClient(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (userId) {
      await client.query("select set_config('app.user_id', $1, true)", [userId]);
      await client.query("select set_config('app.role', 'authenticated', true)");
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// HEALTH ENDPOINTS
// ============================================

fastify.get('/health', async () => ({ ok: true, version: '1.0.0' }));

fastify.get('/health/live', async () => ({ ok: true }));

fastify.get('/health/ready', async (req, reply) => {
  try {
    const result = await withClient(null, async (client) => {
      const { rows } = await client.query('select now() as now');
      return { ok: true, database: 'connected', now: rows[0].now };
    });
    return result;
  } catch (err) {
    req.log.error({ err }, 'Health check failed');
    return reply.code(503).send({ ok: false, database: 'disconnected' });
  }
});

// Legacy endpoint
fastify.get('/health/db', async (req, reply) => {
  return withClient(null, async (client) => {
    const { rows } = await client.query('select now() as now');
    return { ok: true, now: rows[0].now };
  });
});

// ============================================
// SETUP ENDPOINTS (for wizard connection testing)
// ============================================

// Test Supabase connection from frontend
fastify.post('/setup/test-supabase', async (req, reply) => {
  const { url, anonKey } = req.body || {};

  if (!url || !anonKey) {
    return reply.code(400).send({ ok: false, error: 'Missing URL or anon key' });
  }

  // Validate URL is a legitimate Supabase URL to prevent SSRF
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return reply.code(400).send({ ok: false, error: 'Invalid URL format' });
  }

  // Only allow Supabase domains
  const allowedDomains = ['.supabase.co', '.supabase.com'];
  const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
  if (!isAllowed) {
    return reply.code(400).send({ ok: false, error: 'URL must be a Supabase project URL (*.supabase.co)' });
  }

  // Ensure HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return reply.code(400).send({ ok: false, error: 'URL must use HTTPS' });
  }

  try {
    // Test the Supabase REST API endpoint
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (response.ok || response.status === 200) {
      return { ok: true, message: 'Connection successful' };
    } else if (response.status === 401) {
      return { ok: false, error: 'Invalid API key' };
    } else {
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (err) {
    return { ok: false, error: err.message || 'Connection failed' };
  }
});

// Test Docker PostgreSQL connection (alias for health/ready)
fastify.get('/setup/test-db', async (req, reply) => {
  try {
    const result = await withClient(null, async (client) => {
      const { rows } = await client.query('SELECT 1 as connected');
      return { ok: true, message: 'Database connected' };
    });
    return result;
  } catch (err) {
    return { ok: false, error: err.message || 'Database connection failed' };
  }
});

// ============================================
// AUTH ENDPOINTS
// ============================================

fastify.get('/auth/me', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.send(null);
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      'select id, email, full_name from auth.users where id = $1',
      [sess.id]
    );
    return rows[0] || null;
  });
});

fastify.post('/auth/login', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
}, async (req, reply) => {
  const Body = z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  
  req.log.info({ email: normalizedEmail }, 'Login attempt');
  
  const row = await withClient(null, async (client) => {
    const { rows } = await client.query(
      'select id, email, encrypted_password from auth.users where lower(email) = $1',
      [normalizedEmail]
    );
    return rows[0];
  });
  
  if (!row) {
    req.log.warn({ email: normalizedEmail }, 'AUTH FAILURE: User not found');
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  // Verify password
  const passwordValid = await verifyPassword(password, row.encrypted_password);
  if (!passwordValid) {
    req.log.warn({ email: normalizedEmail, userId: row.id }, 'AUTH FAILURE: Invalid password');
    return reply.code(401).send({ error: 'Invalid credentials' });
  }
  
  req.log.info({ email: normalizedEmail, userId: row.id }, 'AUTH SUCCESS: Login successful');
  
  // Issue session token
  const secretKey = new TextEncoder().encode(securityConfig.sessionSecret);
  const token = await new SignJWT({ email: row.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.id)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
  
  reply.setCookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: isProd,
    maxAge: 60 * 60 * 24 * 7,
  });

  // Set CSRF token cookie (readable by JavaScript for double-submit pattern)
  const csrfToken = generateCsrfToken();
  reply.setCookie('csrf', csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    sameSite: 'lax',
    path: '/',
    secure: isProd,
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ok: true };
});

fastify.post('/auth/logout', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (sess) {
    req.log.info({ userId: sess.id }, 'User logged out');
  }
  reply.clearCookie('session', { path: '/', sameSite: 'lax', secure: isProd });
  reply.clearCookie('csrf', { path: '/', sameSite: 'lax', secure: isProd });
  return { ok: true };
});

// ============================================
// TEAMS ENDPOINTS
// ============================================

fastify.get('/teams', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select distinct on (t.id)
              t.id, t.name, t.approval_quota, t.admin_id, t.is_personal,
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
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(
      `select id, name, approval_quota, admin_id, is_personal from public.teams where id = $1`,
      [id]
    );
    return rows[0] || null;
  });
});

fastify.post('/teams', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  
  const Body = z.object({ 
    name: z.string().min(1).max(100), 
    approval_quota: z.number().int().min(1).optional() 
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { name, approval_quota = 1 } = parsed.data;
  
  return withClient(sess.id, async (client) => {
    try {
      await client.query('begin');
      const tRes = await client.query(
        `insert into public.teams(name, approval_quota, admin_id) 
         values ($1, $2, auth.uid()) returning id, name, approval_quota, admin_id, is_personal, created_at`,
        [name, approval_quota]
      );
      const team = tRes.rows[0];
      await client.query(
        `insert into public.team_members(team_id, user_id, role) 
         values($1, auth.uid(), 'admin') on conflict do nothing`,
        [team.id]
      );
      await client.query('commit');
      
      req.log.info({ teamId: team.id, userId: sess.id }, 'ADMIN: Team created');
      return team;
    } catch (e) {
      await client.query('rollback');
      req.log.error({ err: e, userId: sess.id }, 'Failed to create team');
      return reply.code(400).send({ error: 'Failed to create team' });
    }
  });
});

fastify.patch('/teams/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  const Body = z.object({
    approval_quota: z.number().int().min(1).optional(),
    name: z.string().min(1).max(100).optional(),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { approval_quota, name } = parsed.data;
  if (approval_quota === undefined && name === undefined) {
    return reply.code(400).send({ error: 'No updates provided' });
  }
  
  return withClient(sess.id, async (client) => {
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
      values
    );
    
    req.log.info({ teamId: id, userId: sess.id, approval_quota, name }, 'ADMIN: Team settings updated');
    return { ok: true };
  });
});

fastify.post('/teams/:id/convert-personal', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }

  const Body = z.object({ name: z.string().min(1).max(100).optional() });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }

  const { name } = parsed.data;

  return withClient(sess.id, async (client) => {
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can convert personal teams' });
    }

    const { rows } = await client.query(
      'select public.convert_personal_to_team($1, $2) as converted',
      [id, name || null]
    );
    return { ok: true, converted: rows[0]?.converted ?? false };
  });
});

fastify.delete('/teams/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }

  return withClient(sess.id, async (client) => {
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can delete teams' });
    }

    const { rows: teamRows } = await client.query(
      'select is_personal from public.teams where id = $1',
      [id]
    );
    if (teamRows.length === 0) {
      return reply.code(404).send({ error: 'Team not found' });
    }

    if (teamRows[0].is_personal) {
      const { rows: countRows } = await client.query(
        'select count(*)::int as member_count from public.team_members where team_id = $1',
        [id]
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

fastify.post('/teams/:id/transfer-ownership', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  const Body = z.object({ new_owner_user_id: z.string().uuid() });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { new_owner_user_id } = parsed.data;
  
  return withClient(sess.id, async (client) => {
    // Verify current user is the team owner
    const { rows: teamRows } = await client.query(
      `select admin_id from public.teams where id = $1`,
      [id]
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
      [id, new_owner_user_id]
    );
    await client.query(
      `update public.teams set admin_id = $1 where id = $2`,
      [new_owner_user_id, id]
    );
    
    req.log.info({ teamId: id, oldOwner: sess.id, newOwner: new_owner_user_id }, 'ADMIN: Team ownership transferred');
    return { ok: true };
  });
});

// ============================================
// TEAM MEMBERS ENDPOINTS
// ============================================

fastify.get('/teams/:id/members', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  return withClient(sess.id, async (client) => {
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
      [id]
    );
    return rows;
  });
});

fastify.delete('/teams/:id/members/:memberId', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id, memberId } = req.params;
  
  if (!isValidUUID(id) || !isValidUUID(memberId)) {
    return reply.code(400).send({ error: 'Invalid ID' });
  }
  
  return withClient(sess.id, async (client) => {
    // Verify admin status
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can remove members' });
    }
    
    // Get the member being removed
    const { rows: memberRows } = await client.query(
      `select user_id from public.team_members where id = $1 and team_id = $2`,
      [memberId, id]
    );
    
    if (!memberRows[0]) {
      return reply.code(404).send({ error: 'Member not found' });
    }
    
    // Prevent removing the team owner
    const { rows: teamRows } = await client.query(
      `select admin_id from public.teams where id = $1`,
      [id]
    );
    
    if (teamRows[0]?.admin_id === memberRows[0].user_id) {
      return reply.code(400).send({ error: 'Cannot remove the team owner' });
    }
    
    await client.query(`delete from public.team_members where id = $1`, [memberId]);
    
    req.log.info({ teamId: id, memberId, removedBy: sess.id }, 'ADMIN: Team member removed');
    return { ok: true };
  });
});

fastify.patch('/teams/:id/members/:memberId', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id, memberId } = req.params;
  
  if (!isValidUUID(id) || !isValidUUID(memberId)) {
    return reply.code(400).send({ error: 'Invalid ID' });
  }
  
  const Body = z.object({ role: z.enum(['admin', 'member']) });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { role } = parsed.data;
  
  return withClient(sess.id, async (client) => {
    // Verify admin status
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can update member roles' });
    }
    
    // Get the member being updated
    const { rows: memberRows } = await client.query(
      `select user_id from public.team_members where id = $1 and team_id = $2`,
      [memberId, id]
    );
    
    if (!memberRows[0]) {
      return reply.code(404).send({ error: 'Member not found' });
    }
    
    // Prevent demoting the team owner
    const { rows: teamRows } = await client.query(
      `select admin_id from public.teams where id = $1`,
      [id]
    );
    
    if (teamRows[0]?.admin_id === memberRows[0].user_id && role !== 'admin') {
      return reply.code(400).send({ error: 'Cannot demote the team owner' });
    }
    
    await client.query(
      `update public.team_members set role = $1 where id = $2`,
      [role, memberId]
    );
    
    req.log.info({ teamId: id, memberId, role, updatedBy: sess.id }, 'ADMIN: Team member role updated');
    return { ok: true };
  });
});

// ============================================
// INVITATIONS ENDPOINTS
// ============================================

fastify.get('/invites/mine', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  
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

fastify.get('/teams/:id/invites', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  return withClient(sess.id, async (client) => {
    // Verify admin status
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can view invitations' });
    }
    
    const { rows } = await client.query(
      `select i.* from public.team_invitations i 
       where i.team_id = $1 and i.status = 'pending' 
       order by i.created_at desc`,
      [id]
    );
    return rows;
  });
});

fastify.post('/teams/:id/invites', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
  const Body = z.object({ 
    invited_email: z.string().email(), 
    role: z.enum(['admin', 'member']) 
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { invited_email, role } = parsed.data;
  
  return withClient(sess.id, async (client) => {
    // Verify admin status
    const isAdmin = await requireTeamAdmin(client, sess.id, id, req);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Only team admins can send invitations' });
    }
    
    await client.query(
      `insert into public.team_invitations(team_id, invited_email, role, status, invited_by_user_id)
       select $1, $2, $3, 'pending', auth.uid()
       where not exists (
         select 1 from public.team_invitations where team_id = $1 and invited_email = $2 and status = 'pending'
       )`,
      [id, invited_email.toLowerCase(), role]
    );
    
    req.log.info({ teamId: id, invitedEmail: invited_email, role, invitedBy: sess.id }, 'ADMIN: Invitation sent');
    return { ok: true };
  });
});

fastify.post('/invites/:id/accept', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid invite ID' });
  }
  
  return withClient(sess.id, async (client) => {
    const invRes = await client.query(
      `select * from public.team_invitations where id = $1 and status = 'pending'`,
      [id]
    );
    const inv = invRes.rows[0];
    if (!inv) return reply.code(404).send({ error: 'Invite not found' });
    
    // Confirm invited email matches current user
    const me = await client.query(`select email from auth.users where id = auth.uid()`);
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
      [inv.team_id, inv.role]
    );
    
    // Delete invitation
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    
    req.log.info({ inviteId: id, teamId: inv.team_id, userId: sess.id }, 'Invitation accepted');
    return { ok: true };
  });
});

fastify.post('/invites/:id/decline', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid invite ID' });
  }
  
  return withClient(sess.id, async (client) => {
    // Verify the invite belongs to the current user
    const invRes = await client.query(
      `select i.id, i.team_id from public.team_invitations i
       where i.id = $1 and i.status = 'pending'
       and i.invited_email = (select email from auth.users where id = auth.uid())`,
      [id]
    );
    
    if (!invRes.rows[0]) {
      return reply.code(404).send({ error: 'Invite not found' });
    }
    
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    
    req.log.info({ inviteId: id, userId: sess.id }, 'Invitation declined');
    return { ok: true };
  });
});

fastify.delete('/invites/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid invite ID' });
  }
  
  return withClient(sess.id, async (client) => {
    // Get the invite to check team ownership
    const invRes = await client.query(
      `select team_id from public.team_invitations where id = $1`,
      [id]
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
    
    await client.query(`delete from public.team_invitations where id = $1`, [id]);
    
    req.log.info({ inviteId: id, teamId, revokedBy: sess.id }, 'ADMIN: Invitation revoked');
    return { ok: true };
  });
});

// ============================================
// FOLDERS ENDPOINTS
// ============================================

fastify.get('/teams/:id/folders', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid team ID' });
  }
  
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
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid folder ID' });
  }

  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(`select * from public.folders where id = $1`, [id]);
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

fastify.get('/folders/paths', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

  const teamId = req.query.teamId;
  if (!teamId || !isValidUUID(teamId)) {
    return reply.code(400).send({ error: 'Valid teamId query parameter is required' });
  }

  return withClient(sess.id, async (client) => {
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
      [teamId]
    );
    return rows;
  });
});

fastify.get('/folders/:id/children', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid folder ID' });
  }

  return withClient(sess.id, async (client) => {
    // Get the parent folder to check team membership
    const { rows: parentRows } = await client.query(`select team_id from public.folders where id = $1`, [id]);
    if (!parentRows[0]) {
      return reply.code(404).send({ error: 'Folder not found' });
    }

    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, parentRows[0].team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const { rows } = await client.query(
      `select * from public.folders where parent_folder_id = $1 order by name`,
      [id]
    );
    return rows;
  });
});

fastify.get('/folders/:id/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid folder ID' });
  }

  return withClient(sess.id, async (client) => {
    // Get the folder to check team membership
    const { rows: folderRows } = await client.query(`select team_id from public.folders where id = $1`, [id]);
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
      [id]
    );
    return rows;
  });
});

fastify.post('/folders', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

  const Body = z.object({
    name: z.string().min(1).max(100),
    description: z.string().nullable().optional(),
    user_id: z.string().uuid().optional(),
    created_by_email: z.string().email().nullable().optional(),
    parent_folder_id: z.string().uuid().nullable().optional(),
    team_id: z.string().uuid(),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }

  const {
    name,
    description = null,
    user_id = sess.id,
    created_by_email = null,
    parent_folder_id = null,
    team_id
  } = parsed.data;

  return withClient(sess.id, async (client) => {
    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // If parent_folder_id is provided, verify it belongs to the same team
    if (parent_folder_id) {
      const { rows: parentRows } = await client.query(
        `select team_id from public.folders where id = $1`,
        [parent_folder_id]
      );
      if (!parentRows[0] || parentRows[0].team_id !== team_id) {
        return reply.code(400).send({ error: 'Parent folder must belong to the same team' });
      }
    }

    const { rows } = await client.query(
      `insert into public.folders(name, description, user_id, created_by_email, parent_folder_id, team_id)
       values($1,$2,$3,$4,$5,$6) returning *`,
      [name, description, user_id, created_by_email, parent_folder_id, team_id]
    );
    return rows[0];
  });
});

fastify.patch('/folders/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid folder ID' });
  }

  const Body = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().nullable().optional()
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }

  const { name = null, description = null } = parsed.data;

  return withClient(sess.id, async (client) => {
    // Get the folder to check team membership
    const { rows: folderRows } = await client.query(`select team_id from public.folders where id = $1`, [id]);
    if (!folderRows[0]) {
      return reply.code(404).send({ error: 'Folder not found' });
    }

    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, folderRows[0].team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await client.query(
      `update public.folders set name = coalesce($1, name), description = $2 where id = $3`,
      [name, description, id]
    );
    return { ok: true };
  });
});

fastify.delete('/folders/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid folder ID' });
  }

  return withClient(sess.id, async (client) => {
    // Get the folder to check team membership
    const { rows: folderRows } = await client.query(`select team_id from public.folders where id = $1`, [id]);
    if (!folderRows[0]) {
      return reply.code(404).send({ error: 'Folder not found' });
    }

    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, folderRows[0].team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await client.query(`delete from public.folders where id = $1`, [id]);
    return { ok: true };
  });
});

// ============================================
// QUERIES ENDPOINTS
// ============================================

fastify.get('/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

  const teamId = req.query.teamId;
  const q = req.query.q;

  if (!teamId || !isValidUUID(teamId)) {
    return reply.code(400).send({ error: 'Valid teamId is required' });
  }

  return withClient(sess.id, async (client) => {
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
      sql += ` and (q.title ilike $2 or q.description ilike $3 or q.sql_content ilike $4)`;
    }
    sql += ' order by q.updated_at desc nulls last';
    const { rows } = await client.query(sql, params);
    return rows;
  });
});

fastify.get('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }

  return withClient(sess.id, async (client) => {
    const { rows } = await client.query(`select * from public.sql_queries where id = $1`, [id]);
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

fastify.post('/queries', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });

  const Body = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
    sql_content: z.string().min(1).max(100000),
    status: z.enum(['draft', 'pending_approval', 'approved', 'rejected']).optional(),
    team_id: z.string().uuid(),
    folder_id: z.string().uuid().nullable().optional(),
    created_by_email: z.string().email().nullable().optional(),
    last_modified_by_email: z.string().email().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }

  const body = parsed.data;

  return withClient(sess.id, async (client) => {
    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, body.team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // If folder_id is provided, verify it belongs to the same team
    if (body.folder_id) {
      const { rows: folderRows } = await client.query(
        `select team_id from public.folders where id = $1`,
        [body.folder_id]
      );
      if (!folderRows[0] || folderRows[0].team_id !== body.team_id) {
        return reply.code(400).send({ error: 'Folder must belong to the same team' });
      }
    }

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
    const { rows } = await client.query(sql, params);
    return rows[0];
  });
});

fastify.patch('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }

  const Body = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    sql_content: z.string().max(100000).optional(),
    status: z.enum(['draft', 'pending_approval', 'approved', 'rejected']).optional(),
    folder_id: z.string().uuid().nullable().optional(),
    last_modified_by_email: z.string().email().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }

  const body = parsed.data;

  return withClient(sess.id, async (client) => {
    // Get the query to check team membership
    const { rows: queryRows } = await client.query(`select team_id from public.sql_queries where id = $1`, [id]);
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
        `select team_id from public.folders where id = $1`,
        [body.folder_id]
      );
      if (!folderRows[0] || folderRows[0].team_id !== queryRows[0].team_id) {
        return reply.code(400).send({ error: 'Folder must belong to the same team' });
      }
    }

    const sets = [];
    const params = [];
    let i = 1;

    for (const [k, v] of Object.entries(body)) {
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

fastify.delete('/queries/:id', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }

  return withClient(sess.id, async (client) => {
    // Get the query to check team membership
    const { rows: queryRows } = await client.query(`select team_id from public.sql_queries where id = $1`, [id]);
    if (!queryRows[0]) {
      return reply.code(404).send({ error: 'Query not found' });
    }

    // Validate team membership
    const isMember = await requireTeamMember(client, sess.id, queryRows[0].team_id, req);
    if (!isMember) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    await client.query(`delete from public.sql_queries where id = $1`, [id]);
    return { ok: true };
  });
});

// ============================================
// QUERY HISTORY & APPROVALS
// ============================================

fastify.get('/queries/:id/history', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }
  
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
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }
  
  return withClient(sess.id, async (client) => {
    const quotaRes = await client.query(
      `select q.team_id, t.approval_quota 
       from public.sql_queries q 
       join public.teams t on t.id = q.team_id 
       where q.id = $1`,
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

fastify.get('/approvals', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  
  const teamId = req.query.teamId;
  const excludeEmail = req.query.excludeEmail || '';
  
  if (!teamId || !isValidUUID(teamId)) {
    return reply.code(400).send({ error: 'Valid teamId is required' });
  }
  
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
       where q.team_id = $1 and q.status = 'pending_approval' 
         and (q.last_modified_by_email is null or q.last_modified_by_email <> $2)
       order by q.updated_at desc`,
      [teamId, excludeEmail]
    );
    return rows;
  });
});

fastify.post('/queries/:id/submit', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }
  
  const Body = z.object({
    sql: z.string().max(100000).optional().nullable(),
    modified_by_email: z.string().email().nullable().optional(),
    change_reason: z.string().max(500).nullable().optional(),
    team_id: z.string().uuid().nullable().optional(),
    user_id: z.string().uuid().nullable().optional(),
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { sql, modified_by_email = null, change_reason = null, team_id = null, user_id = null } = parsed.data;
  
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
      // Fallback for older function signature
      await client.query('select public.submit_query_for_approval($1, $2)', [id, sql || null]);
      return { ok: true };
    }
  });
});

fastify.post('/queries/:id/approve', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }
  
  const Body = z.object({ historyId: z.string().uuid() });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { historyId } = parsed.data;
  
  return withClient(sess.id, async (client) => {
    // Get approver email for the RPC call
    const { rows: userRows } = await client.query(
      'select email from auth.users where id = $1',
      [sess.id]
    );
    const approverEmail = userRows[0]?.email;

    await client.query('select public.approve_query_with_quota($1, $2, $3)', [historyId, sess.id, approverEmail]);
    req.log.info({ queryId: id, historyId, userId: sess.id }, 'Query approved');
    return { ok: true };
  });
});

fastify.post('/queries/:id/reject', async (req, reply) => {
  const sess = await getSessionUser(req);
  if (!sess) return reply.code(401).send({ error: 'Unauthorized' });
  const { id } = req.params;
  
  if (!isValidUUID(id)) {
    return reply.code(400).send({ error: 'Invalid query ID' });
  }
  
  const Body = z.object({ 
    historyId: z.string().uuid(), 
    reason: z.string().max(500).nullable().optional() 
  });
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
  }
  
  const { historyId, reason = null } = parsed.data;

  return withClient(sess.id, async (client) => {
    // Pass rejecter user ID (not reason) as the function expects
    await client.query('select public.reject_query_with_authorization($1, $2, $3)', [historyId, sess.id, reason]);
    req.log.info({ queryId: id, historyId, reason, userId: sess.id }, 'Query rejected');
    return { ok: true };
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal) {
  fastify.log.info({ signal }, 'Received shutdown signal');
  
  try {
    await fastify.close();
    fastify.log.info('HTTP server closed');
    
    await pool.end();
    fastify.log.info('Database pool closed');
    
    process.exit(0);
  } catch (err) {
    fastify.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// START SERVER
// ============================================

const port = serverConfig.port;
fastify.listen({ port, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
