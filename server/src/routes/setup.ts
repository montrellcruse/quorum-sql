import type { FastifyInstance } from 'fastify';

import { SetupSupabaseBodySchema, type SetupSupabaseBody } from '../schemas.js';

const SUPABASE_PROJECT_HOST = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.supabase\.(co|com)$/;
const SUPABASE_PROBE_TIMEOUT_MS = 5_000;

export default async function setupRoutes(fastify: FastifyInstance) {
  // Test Supabase connection from frontend
  fastify.post<{ Body: SetupSupabaseBody }>('/setup/test-supabase', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const parsed = SetupSupabaseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Missing URL or anon key' });
    }
    const { url, anonKey } = parsed.data;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL format' });
    }

    const projectHost = SUPABASE_PROJECT_HOST.exec(parsedUrl.hostname);
    if (!projectHost) {
      return reply.code(400).send({ error: 'URL must be a Supabase project URL (*.supabase.co or *.supabase.com)' });
    }

    if (parsedUrl.protocol !== 'https:') {
      return reply.code(400).send({ error: 'URL must use HTTPS' });
    }

    // Require the origin itself, with no credentials, path, query, or fragment.
    if (parsedUrl.port || parsedUrl.href !== `${parsedUrl.origin}/`) {
      return reply.code(400).send({ error: 'URL must be a Supabase project origin' });
    }

    // Only the validated project label varies; rebuild the destination from trusted components.
    const project = encodeURIComponent(projectHost[1]);
    const domain = projectHost[2] === 'com' ? 'supabase.com' : 'supabase.co';
    try {
      const response = await fetch(`https://${project}.${domain}/rest/v1/`, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(SUPABASE_PROBE_TIMEOUT_MS),
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      await response.body?.cancel();
      if (response.ok) {
        return { ok: true, message: 'Connection successful' };
      } else if (response.status === 401) {
        return { ok: false, error: 'Invalid API key' };
      } else {
        return { ok: false, error: `HTTP ${response.status}` };
      }
    } catch {
      return { ok: false, error: 'Connection failed' };
    }
  });

  // Test Docker PostgreSQL connection (alias for health/ready)
  fastify.get('/setup/test-db', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async () => {
    try {
      const result = await fastify.withReadClient(null, async (client) => {
        await client.query('SELECT 1 as connected');
        return { ok: true, message: 'Database connected' };
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Database connection failed';
      return { ok: false, error: message };
    }
  });
}
