import { jwtVerify, createRemoteJWKSet } from 'jose';
import bcrypt from 'bcrypt';
import { securityConfig, supabaseConfig } from '../config.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let supabaseJWKS = null;

function getSupabaseJWKS() {
  if (!supabaseConfig.jwksUrl) return null;
  if (!supabaseJWKS) {
    try {
      supabaseJWKS = createRemoteJWKSet(new URL(supabaseConfig.jwksUrl));
    } catch {
      supabaseJWKS = null;
    }
  }
  return supabaseJWKS;
}

export function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

export async function hashPassword(plainPassword) {
  const saltRounds = 12;
  return bcrypt.hash(plainPassword, saltRounds);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function verifySupabaseToken(token) {
  const JWKS = getSupabaseJWKS();
  if (!JWKS) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['RS256'],
    });
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'authenticated',
    };
  } catch {
    return null;
  }
}

async function verifySessionToken(token) {
  try {
    const secretKey = new TextEncoder().encode(securityConfig.sessionSecret);
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });
    if (!payload.sub || !payload.email) {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(req) {
  // 1. Try Supabase JWT from Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const user = await verifySupabaseToken(token);
    if (user) {
      return { ...user, source: 'supabase' };
    }
    // Invalid Supabase token - do NOT fall through to other auth methods
    // This prevents token forgery attacks
    req.log.warn('Invalid Supabase token provided');
  }

  // 2. Try session cookie
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    const user = await verifySessionToken(sessionToken);
    if (user) {
      return { ...user, source: 'session' };
    }
    // Invalid session token - do NOT fall through to dev auth
    req.log.warn('Invalid session token provided');
    return null;
  }

  // 3. Dev-only authentication (explicit opt-in required, never in production)
  if (securityConfig.devAuthEnabled) {
    const devUserId = req.headers['x-dev-user-id'];
    if (devUserId) {
      if (!isValidUUID(devUserId)) {
        req.log.warn({ devUserId }, 'DEV AUTH: Invalid UUID format');
        return null;
      }
      req.log.warn({ devUserId }, 'DEV AUTH: Impersonating user via header');
      return { id: devUserId, source: 'dev-header' };
    }
    
    // Use fake user ID only if configured and no other auth provided
    if (securityConfig.devFakeUserId) {
      req.log.warn({ userId: securityConfig.devFakeUserId }, 'DEV AUTH: Using fake user');
      return { id: securityConfig.devFakeUserId, source: 'dev-fake' };
    }
  }

  return null;
}

function getTeamRoleCache(req) {
  if (!req) return null;
  if (!req.teamRoleCache) {
    req.teamRoleCache = new Map();
  }
  return req.teamRoleCache;
}

async function getTeamRole(client, userId, teamId, req) {
  const cache = getTeamRoleCache(req);
  const cacheKey = `${userId}:${teamId}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  const { rows } = await client.query(
    `SELECT role FROM public.team_members WHERE user_id = $1 AND team_id = $2`,
    [userId, teamId]
  );
  const role = rows[0]?.role || null;
  cache?.set(cacheKey, role);
  return role;
}

export function requireAuth(handler) {
  return async (req, reply) => {
    const user = await getSessionUser(req);
    if (!user) {
      req.log.info({ path: req.url, method: req.method }, 'AUTH FAILURE: No valid session');
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    req.user = user;
    return handler(req, reply);
  };
}

export async function requireTeamAdmin(client, userId, teamId, req) {
  const role = await getTeamRole(client, userId, teamId, req);
  if (role !== 'admin') {
    req?.log?.warn({ userId, teamId }, 'AUTH FAILURE: User is not team admin');
    return false;
  }
  return true;
}

export async function requireTeamMember(client, userId, teamId, req) {
  const role = await getTeamRole(client, userId, teamId, req);
  if (!role) {
    req?.log?.warn({ userId, teamId }, 'AUTH FAILURE: User is not team member');
    return false;
  }
  return true;
}
