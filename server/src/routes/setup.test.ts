import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import setupRoutes from './setup.js';

describe('Supabase connectivity probe', () => {
  let app: FastifyInstance;
  const fetchProbe = vi.fn<typeof fetch>();

  beforeEach(async () => {
    fetchProbe.mockReset();
    vi.stubGlobal('fetch', fetchProbe);
    app = Fastify();
    await app.register(setupRoutes);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  function probe(url: string) {
    return app.inject({
      method: 'POST',
      url: '/setup/test-supabase',
      payload: { url, anonKey: 'test-project-key' },
    });
  }

  it.each(['co', 'com'])('probes the fixed HTTPS REST path on supabase.%s', async (suffix) => {
    fetchProbe.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const response = await probe(`https://test-project.supabase.${suffix}/`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, message: 'Connection successful' });
    expect(fetchProbe).toHaveBeenCalledExactlyOnceWith(
      `https://test-project.supabase.${suffix}/rest/v1/`,
      {
        method: 'GET',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: { apikey: 'test-project-key', Authorization: 'Bearer test-project-key' },
      },
    );
  });

  it.each([
    'https://example.test',
    'http://test-project.supabase.co',
    'https://test-project.supabase.co:8443',
    'https://test-project.supabase.co/dashboard',
  ])('does not make an outbound request for unsupported origin %s', async (url) => {
    expect((await probe(url)).statusCode).toBe(400);
    expect(fetchProbe).not.toHaveBeenCalled();
  });

  it('reports a rejected API key without returning the upstream response body', async () => {
    fetchProbe.mockResolvedValueOnce(new Response('upstream details', { status: 401 }));

    expect((await probe('https://test-project.supabase.co')).json())
      .toEqual({ ok: false, error: 'Invalid API key' });
  });

  it('does not return raw fetch errors', async () => {
    fetchProbe.mockRejectedValueOnce(new Error('upstream details'));

    expect((await probe('https://test-project.supabase.co')).json())
      .toEqual({ ok: false, error: 'Connection failed' });
  });
});
