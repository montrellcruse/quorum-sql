import type { FastifyInstance } from 'fastify';
import { SignJWT } from 'jose';

import { isProd, securityConfig } from '../config.js';
import { getSessionUser, hashPassword, verifyPassword } from '../middleware/auth.js';
import { generateCsrfToken } from '../middleware/security.js';
import {
  LoginBodySchema,
  RegisterBodySchema,
  type LoginBody,
  type RegisterBody,
} from '../schemas.js';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/auth/me', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const sess = await getSessionUser(req);
    if (!sess) return null;

    return fastify.withClient(sess.id, async (client) => {
      const { rows } = await client.query(
        'select id, email, full_name from auth.users where id = $1',
        [sess.id],
      );
      return rows[0] || null;
    });
  });

  fastify.post<{ Body: LoginBody }>('/auth/login', {
    config: {
      // Strict rate limit: 5 attempts per 15 minutes per IP to mitigate brute-force
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
      },
    },
  }, async (req, reply) => {
    const parsed = LoginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    req.log.info({ email: normalizedEmail }, 'Login attempt');

    const row = await fastify.withClient(null, async (client) => {
      const { rows } = await client.query(
        'select id, email, encrypted_password from auth.users where lower(email) = $1',
        [normalizedEmail],
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

    // Issue session token (1h expiry to limit exposure window)
    const secretKey = new TextEncoder().encode(securityConfig.sessionSecret);
    const token = await new SignJWT({ email: row.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(row.id)
      .setIssuer('quorum-sql')
      .setAudience('quorum-sql')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    reply.setCookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 60 * 60, // 1 hour
    });

    // Set CSRF token cookie (readable by JavaScript for double-submit pattern)
    const csrfToken = generateCsrfToken();
    reply.setCookie('csrf', csrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 60 * 60, // 1 hour
    });

    // Return CSRF token in body for cross-origin setups where JS can't read cookie
    return { ok: true, csrfToken };
  });

  fastify.post<{ Body: RegisterBody }>('/auth/register', {
    config: {
      // Stricter rate limit in production, relaxed for development/testing
      rateLimit: isProd ? {
        max: 10,
        timeWindow: '1 minute',
      } : {
        max: 1000,
        timeWindow: '1 minute',
      },
    },
  }, async (req, reply) => {
    const parsed = RegisterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message || 'Invalid body' });
    }

    const { email, password, fullName } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    req.log.info({ email: normalizedEmail }, 'Registration attempt');

    // Check if user already exists
    const existing = await fastify.withClient(null, async (client) => {
      const { rows } = await client.query(
        'select id from auth.users where lower(email) = $1',
        [normalizedEmail],
      );
      return rows[0];
    });

    if (existing) {
      req.log.warn({ email: normalizedEmail }, 'Registration failed: email already exists');
      return reply.code(409).send({ error: 'An account with this email already exists' });
    }

    // Hash password and create user
    // Note: raw_user_meta_data is set so the on_auth_user_created trigger can read full_name
    const hashedPassword = await hashPassword(password);
    const trimmedFullName = fullName?.trim() || null;
    const rawUserMetaData = trimmedFullName ? JSON.stringify({ full_name: trimmedFullName }) : '{}';
    const newUser = await fastify.withClient(null, async (client) => {
      const { rows } = await client.query(
        `insert into auth.users (id, email, encrypted_password, full_name, raw_user_meta_data)
         values (gen_random_uuid(), $1, $2, $3, $4::jsonb)
         returning id, email`,
        [normalizedEmail, hashedPassword, trimmedFullName, rawUserMetaData],
      );
      return rows[0];
    });

    req.log.info({ email: normalizedEmail, userId: newUser.id }, 'Registration successful');

    // Issue session token (1h expiry to limit exposure window)
    const secretKey = new TextEncoder().encode(securityConfig.sessionSecret);
    const token = await new SignJWT({ email: newUser.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(newUser.id)
      .setIssuer('quorum-sql')
      .setAudience('quorum-sql')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secretKey);

    reply.setCookie('session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 60 * 60, // 1 hour
    });

    const csrfToken = generateCsrfToken();
    reply.setCookie('csrf', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 60 * 60, // 1 hour
    });

    // Return CSRF token in body for cross-origin setups where JS can't read cookie
    return { ok: true, csrfToken };
  });

  fastify.post('/auth/logout', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const sess = await getSessionUser(req);
    if (sess) {
      req.log.info({ userId: sess.id }, 'User logged out');
    }
    reply.clearCookie('session', { path: '/', sameSite: 'lax', secure: isProd });
    reply.clearCookie('csrf', { path: '/', sameSite: 'lax', secure: isProd });
    return { ok: true };
  });
}
