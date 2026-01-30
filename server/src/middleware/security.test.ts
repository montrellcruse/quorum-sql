import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

describe('Security Middleware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCsrfToken', () => {
    it('generates a 64-character hex string', async () => {
      const { generateCsrfToken } = await import('./security.js');

      const token = generateCsrfToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates unique tokens each time', async () => {
      const { generateCsrfToken } = await import('./security.js');

      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('csrfProtection', () => {
    it('skips CSRF check for GET requests', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      expect(addHook).toHaveBeenCalledWith('preHandler', expect.any(Function));

      // Get the hook function
      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'GET',
        url: '/api/test',
        cookies: { csrf: 'token123' },
        headers: {},
      } as unknown as FastifyRequest;

      const mockReply = {} as FastifyReply;

      hookFn(mockReq, mockReply, done);

      expect(done).toHaveBeenCalled();
    });

    it('skips CSRF check for HEAD requests', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'HEAD',
        url: '/api/test',
        cookies: { csrf: 'token123' },
        headers: {},
      } as unknown as FastifyRequest;

      hookFn(mockReq, {}, done);

      expect(done).toHaveBeenCalled();
    });

    it('skips CSRF check for OPTIONS requests', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'OPTIONS',
        url: '/api/test',
        cookies: { csrf: 'token123' },
        headers: {},
      } as unknown as FastifyRequest;

      hookFn(mockReq, {}, done);

      expect(done).toHaveBeenCalled();
    });

    it('skips CSRF check for login endpoint', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'POST',
        url: '/auth/login',
        cookies: { csrf: 'token123' },
        headers: {},
      } as unknown as FastifyRequest;

      hookFn(mockReq, {}, done);

      expect(done).toHaveBeenCalled();
    });

    it('skips CSRF check for health endpoints', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      for (const path of ['/health', '/health/live', '/health/ready', '/health/db']) {
        const mockReq = {
          method: 'POST',
          url: path,
          cookies: { csrf: 'token123' },
          headers: {},
        } as unknown as FastifyRequest;

        hookFn(mockReq, {}, done);
      }

      expect(done).toHaveBeenCalledTimes(4);
    });

    it('skips validation when no CSRF cookie is set', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'POST',
        url: '/api/data',
        cookies: {},
        headers: {},
      } as unknown as FastifyRequest;

      hookFn(mockReq, {}, done);

      expect(done).toHaveBeenCalled();
    });

    it('validates CSRF token for POST requests', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'POST',
        url: '/api/data',
        cookies: { csrf: 'valid-token' },
        headers: { 'x-csrf-token': 'valid-token' },
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      hookFn(mockReq, {}, done);

      expect(done).toHaveBeenCalled();
    });

    it('rejects mismatched CSRF token', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'POST',
        url: '/api/data',
        cookies: { csrf: 'cookie-token' },
        headers: { 'x-csrf-token': 'different-token' },
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      hookFn(mockReq, mockReply, done);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'CSRF token validation failed' });
      expect(done).not.toHaveBeenCalled();
    });

    it('rejects missing CSRF header when cookie is present', async () => {
      const { csrfProtection } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      csrfProtection(mockFastify);

      const hookFn = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        method: 'POST',
        url: '/api/data',
        cookies: { csrf: 'cookie-token' },
        headers: {},
        log: { warn: vi.fn() },
      } as unknown as FastifyRequest;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      hookFn(mockReq, mockReply, done);

      expect(mockReply.code).toHaveBeenCalledWith(403);
    });
  });

  describe('securityHeaders', () => {
    it('adds security headers to responses', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { securityHeaders } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      securityHeaders(mockFastify);

      // Should register two hooks: onRequest and onSend
      expect(addHook).toHaveBeenCalledWith('onRequest', expect.any(Function));
      expect(addHook).toHaveBeenCalledWith('onSend', expect.any(Function));
    });

    it('generates request ID on request', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { securityHeaders } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      securityHeaders(mockFastify);

      // Get the onRequest hook
      const onRequestHook = addHook.mock.calls.find((call) => call[0] === 'onRequest')?.[1];
      const done = vi.fn();

      const mockReq = {
        headers: {},
      } as unknown as FastifyRequest;

      onRequestHook(mockReq, {}, done);

      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.requestId).toMatch(/^[a-f0-9-]+$/);
      expect(done).toHaveBeenCalled();
    });

    it('uses existing x-request-id header', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { securityHeaders } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      securityHeaders(mockFastify);

      const onRequestHook = addHook.mock.calls.find((call) => call[0] === 'onRequest')?.[1];
      const done = vi.fn();

      const mockReq = {
        headers: { 'x-request-id': 'custom-request-id' },
      } as unknown as FastifyRequest;

      onRequestHook(mockReq, {}, done);

      expect(mockReq.requestId).toBe('custom-request-id');
    });

    it('sets security headers on send', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { securityHeaders } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      securityHeaders(mockFastify);

      const onSendHook = addHook.mock.calls.find((call) => call[0] === 'onSend')?.[1];
      const done = vi.fn();

      const mockReq = {
        requestId: 'test-request-id',
      } as unknown as FastifyRequest;

      const header = vi.fn();
      const mockReply = { header } as unknown as FastifyReply;

      onSendHook(mockReq, mockReply, null, done);

      expect(header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(header).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(header).toHaveBeenCalledWith('X-Request-Id', 'test-request-id');
      expect(done).toHaveBeenCalled();
    });

    it('adds HSTS in production', async () => {
      vi.doMock('../config.js', () => ({
        isProd: true,
      }));

      const { securityHeaders } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      securityHeaders(mockFastify);

      const onSendHook = addHook.mock.calls.find((call) => call[0] === 'onSend')?.[1];
      const done = vi.fn();

      const mockReq = { requestId: 'test-id' } as unknown as FastifyRequest;
      const header = vi.fn();
      const mockReply = { header } as unknown as FastifyReply;

      onSendHook(mockReq, mockReply, null, done);

      expect(header).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
      expect(header).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; frame-ancestors 'none'"
      );
    });
  });

  describe('sanitizeError', () => {
    it('sanitizes errors in production', async () => {
      vi.doMock('../config.js', () => ({
        isProd: true,
      }));

      const { sanitizeError } = await import('./security.js');

      const error = new Error('Internal database error') as Error & {
        requestId?: string;
        expose?: boolean;
      };
      error.requestId = 'req-123';

      const result = sanitizeError(error);

      expect(result).toEqual({
        error: 'An error occurred',
        message: 'Internal server error',
        requestId: 'req-123',
      });
    });

    it('exposes message when error.expose is true in production', async () => {
      vi.doMock('../config.js', () => ({
        isProd: true,
      }));

      const { sanitizeError } = await import('./security.js');

      const error = new Error('User-facing error') as Error & {
        requestId?: string;
        expose?: boolean;
      };
      error.expose = true;
      error.requestId = 'req-123';

      const result = sanitizeError(error);

      expect(result.message).toBe('User-facing error');
    });

    it('includes full details in development', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { sanitizeError } = await import('./security.js');

      const error = new Error('Detailed error') as Error & {
        requestId?: string;
      };
      error.name = 'ValidationError';
      error.requestId = 'req-456';

      const result = sanitizeError(error);

      expect(result).toEqual({
        error: 'ValidationError',
        message: 'Detailed error',
        requestId: 'req-456',
      });
    });

    it('includes stack trace when requested in development', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { sanitizeError } = await import('./security.js');

      const error = new Error('Error with stack');

      const result = sanitizeError(error, true);

      expect(result.stack).toBeDefined();
    });
  });

  describe('errorHandler', () => {
    it('sets up error handler on fastify instance', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { errorHandler } = await import('./security.js');

      const setErrorHandler = vi.fn();
      const mockFastify = { setErrorHandler } as unknown as FastifyInstance;

      errorHandler(mockFastify);

      expect(setErrorHandler).toHaveBeenCalledWith(expect.any(Function));
    });

    it('logs and responds with sanitized error', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { errorHandler } = await import('./security.js');

      const setErrorHandler = vi.fn();
      const mockFastify = { setErrorHandler } as unknown as FastifyInstance;

      errorHandler(mockFastify);

      const errorHandlerFn = setErrorHandler.mock.calls[0][0];

      const error = new Error('Test error') as Error & { statusCode?: number };
      error.statusCode = 400;

      const mockReq = {
        requestId: 'req-789',
        url: '/test',
        method: 'POST',
        user: { id: 'user-123' },
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      errorHandlerFn(error, mockReq, mockReply);

      expect(mockReq.log.error).toHaveBeenCalled();
      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it('defaults to 500 status code', async () => {
      vi.doMock('../config.js', () => ({
        isProd: false,
      }));

      const { errorHandler } = await import('./security.js');

      const setErrorHandler = vi.fn();
      const mockFastify = { setErrorHandler } as unknown as FastifyInstance;

      errorHandler(mockFastify);

      const errorHandlerFn = setErrorHandler.mock.calls[0][0];

      const error = new Error('Unknown error');

      const mockReq = {
        requestId: 'req-000',
        url: '/test',
        method: 'GET',
        log: { error: vi.fn() },
      } as unknown as FastifyRequest;

      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      } as unknown as FastifyReply;

      errorHandlerFn(error, mockReq, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
    });
  });

  describe('requestLogger', () => {
    it('logs request completion', async () => {
      const { requestLogger } = await import('./security.js');

      const addHook = vi.fn();
      const mockFastify = { addHook } as unknown as FastifyInstance;

      requestLogger(mockFastify);

      expect(addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));

      const onResponseHook = addHook.mock.calls[0][1];
      const done = vi.fn();

      const mockReq = {
        requestId: 'req-log-test',
        method: 'GET',
        url: '/api/test',
        user: { id: 'user-456' },
        log: { info: vi.fn() },
      } as unknown as FastifyRequest;

      const mockReply = {
        statusCode: 200,
        getResponseTime: vi.fn().mockReturnValue(123.456),
      } as unknown as FastifyReply;

      onResponseHook(mockReq, mockReply, done);

      expect(mockReq.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'req-log-test',
          method: 'GET',
          url: '/api/test',
          statusCode: 200,
          duration: 123,
          userId: 'user-456',
        }),
        'Request completed'
      );
      expect(done).toHaveBeenCalled();
    });
  });
});
