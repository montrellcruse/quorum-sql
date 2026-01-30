import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';

// Mock dependencies before importing the module
vi.mock('jose', () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((plain: string, hashed: string) => Promise.resolve(hashed === `hashed_${plain}`)),
  },
}));

vi.mock('../config.js', () => ({
  securityConfig: {
    sessionSecret: 'test-secret-key-that-is-at-least-32-chars',
    devAuthEnabled: false,
    devFakeUserId: undefined,
  },
  supabaseConfig: {
    jwksUrl: null,
  },
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidUUID', () => {
    it('returns true for valid UUIDs', async () => {
      const { isValidUUID } = await import('./auth.js');

      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('returns false for invalid UUIDs', async () => {
      const { isValidUUID } = await import('./auth.js');

      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(123)).toBe(false);
      expect(isValidUUID({})).toBe(false);
    });

    it('is case-insensitive', async () => {
      const { isValidUUID } = await import('./auth.js');

      expect(isValidUUID('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
      expect(isValidUUID('550e8400-E29B-41d4-A716-446655440000')).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('hashes a password', async () => {
      const { hashPassword } = await import('./auth.js');

      const result = await hashPassword('mypassword');
      expect(result).toBe('hashed_mypassword');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching passwords', async () => {
      const { verifyPassword } = await import('./auth.js');

      const result = await verifyPassword('mypassword', 'hashed_mypassword');
      expect(result).toBe(true);
    });

    it('returns false for non-matching passwords', async () => {
      const { verifyPassword } = await import('./auth.js');

      const result = await verifyPassword('wrongpassword', 'hashed_mypassword');
      expect(result).toBe(false);
    });

    it('returns false for empty passwords', async () => {
      const { verifyPassword } = await import('./auth.js');

      expect(await verifyPassword('', 'hashed_password')).toBe(false);
      expect(await verifyPassword('password', '')).toBe(false);
      expect(await verifyPassword('', '')).toBe(false);
    });
  });

  describe('getSessionUser', () => {
    it('returns null when no auth is provided', async () => {
      const { getSessionUser } = await import('./auth.js');

      const mockReq = {
        headers: {},
        cookies: {},
        log: { warn: vi.fn(), info: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await getSessionUser(mockReq);
      expect(result).toBe(null);
    });

    it('logs warning for invalid Bearer token', async () => {
      const { jwtVerify } = await import('jose');
      vi.mocked(jwtVerify).mockRejectedValue(new Error('Invalid token'));

      const { getSessionUser } = await import('./auth.js');

      const mockReq = {
        headers: { authorization: 'Bearer invalid-token' },
        cookies: {},
        log: { warn: vi.fn(), info: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await getSessionUser(mockReq);
      // Should return null since JWKS is not configured
      expect(result).toBe(null);
    });
  });

  describe('requireAuth', () => {
    it('returns 401 when user is not authenticated', async () => {
      const { requireAuth } = await import('./auth.js');

      const handler = vi.fn();
      const wrappedHandler = requireAuth(handler);

      const mockReq = {
        headers: {},
        cookies: {},
        log: { warn: vi.fn(), info: vi.fn() },
        url: '/test',
        method: 'GET',
      } as unknown as FastifyRequest;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      await wrappedHandler(mockReq, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('requireTeamAdmin', () => {
    it('returns false when user is not admin', async () => {
      const { requireTeamAdmin } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ role: 'member' }] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await requireTeamAdmin(
        mockClient as unknown as PoolClient,
        'user-123',
        'team-456',
        mockReq
      );

      expect(result).toBe(false);
    });

    it('returns true when user is admin', async () => {
      const { requireTeamAdmin } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ role: 'admin' }] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await requireTeamAdmin(
        mockClient as unknown as PoolClient,
        'user-123',
        'team-456',
        mockReq
      );

      expect(result).toBe(true);
    });

    it('caches team role lookups', async () => {
      const { requireTeamAdmin } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ role: 'admin' }] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      // First call
      await requireTeamAdmin(mockClient as unknown as PoolClient, 'user-123', 'team-456', mockReq);
      // Second call should use cache
      await requireTeamAdmin(mockClient as unknown as PoolClient, 'user-123', 'team-456', mockReq);

      // Query should only be called once
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireTeamMember', () => {
    it('returns false when user is not a member', async () => {
      const { requireTeamMember } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await requireTeamMember(
        mockClient as unknown as PoolClient,
        'user-123',
        'team-456',
        mockReq
      );

      expect(result).toBe(false);
    });

    it('returns true when user is a member', async () => {
      const { requireTeamMember } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ role: 'member' }] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await requireTeamMember(
        mockClient as unknown as PoolClient,
        'user-123',
        'team-456',
        mockReq
      );

      expect(result).toBe(true);
    });

    it('returns true when user is an admin (admins are also members)', async () => {
      const { requireTeamMember } = await import('./auth.js');

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [{ role: 'admin' }] }),
      };

      const mockReq = {
        teamRoleCache: new Map(),
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const result = await requireTeamMember(
        mockClient as unknown as PoolClient,
        'user-123',
        'team-456',
        mockReq
      );

      expect(result).toBe(true);
    });
  });
});

describe('Auth Middleware with Dev Auth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows dev header auth when enabled', async () => {
    vi.doMock('../config.js', () => ({
      securityConfig: {
        sessionSecret: 'test-secret-key-that-is-at-least-32-chars',
        devAuthEnabled: true,
        devFakeUserId: undefined,
      },
      supabaseConfig: {
        jwksUrl: null,
      },
    }));

    const { getSessionUser } = await import('./auth.js');

    const validUuid = '550e8400-e29b-41d4-a716-446655440000';
    const mockReq = {
      headers: { 'x-dev-user-id': validUuid },
      cookies: {},
      log: { warn: vi.fn(), info: vi.fn() },
    } as unknown as FastifyRequest;

    const result = await getSessionUser(mockReq);

    expect(result).toEqual({
      id: validUuid,
      source: 'dev-header',
    });
  });

  it('rejects invalid UUID in dev header', async () => {
    vi.doMock('../config.js', () => ({
      securityConfig: {
        sessionSecret: 'test-secret-key-that-is-at-least-32-chars',
        devAuthEnabled: true,
        devFakeUserId: undefined,
      },
      supabaseConfig: {
        jwksUrl: null,
      },
    }));

    const { getSessionUser } = await import('./auth.js');

    const mockReq = {
      headers: { 'x-dev-user-id': 'not-a-valid-uuid' },
      cookies: {},
      log: { warn: vi.fn(), info: vi.fn() },
    } as unknown as FastifyRequest;

    const result = await getSessionUser(mockReq);

    expect(result).toBe(null);
    expect(mockReq.log.warn).toHaveBeenCalled();
  });

  it('uses fake user when configured and no other auth', async () => {
    const fakeUserId = '550e8400-e29b-41d4-a716-446655440000';

    vi.doMock('../config.js', () => ({
      securityConfig: {
        sessionSecret: 'test-secret-key-that-is-at-least-32-chars',
        devAuthEnabled: true,
        devFakeUserId: fakeUserId,
      },
      supabaseConfig: {
        jwksUrl: null,
      },
    }));

    const { getSessionUser } = await import('./auth.js');

    const mockReq = {
      headers: {},
      cookies: {},
      log: { warn: vi.fn(), info: vi.fn() },
    } as unknown as FastifyRequest;

    const result = await getSessionUser(mockReq);

    expect(result).toEqual({
      id: fakeUserId,
      source: 'dev-fake',
    });
  });
});
