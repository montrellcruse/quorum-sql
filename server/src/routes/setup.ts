import type { FastifyInstance } from 'fastify';

import { SetupSupabaseBodySchema, type SetupSupabaseBody } from '../schemas.js';

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

    // Validate URL is a legitimate Supabase URL to prevent SSRF
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.code(400).send({ error: 'Invalid URL format' });
    }

    // Only allow Supabase domains
    const allowedDomains = ['.supabase.co', '.supabase.com'];
    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain));
    if (!isAllowed) {
      return reply.code(400).send({ error: 'URL must be a Supabase project URL (*.supabase.co)' });
    }

    // Ensure HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return reply.code(400).send({ error: 'URL must use HTTPS' });
    }

    try {
      // Test the Supabase REST API endpoint
      const response = await fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
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
      const message = err instanceof Error ? err.message : 'Connection failed';
      return { ok: false, error: message };
    }
  });

  // Test Docker PostgreSQL connection (alias for health/ready)
  fastify.get('/setup/test-db', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async () => {
    try {
      const result = await fastify.withClient(null, async (client) => {
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
