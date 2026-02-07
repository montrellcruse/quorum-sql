import 'fastify';
import type { Pool } from 'pg';
import type { WithClient } from '../lib/db-helpers.js';

export type AuthSource = 'supabase' | 'session' | 'dev-header' | 'dev-fake';

export interface SessionUser {
  id: string;
  email?: string;
  role?: string;
  source: AuthSource;
}

declare module 'fastify' {
  interface FastifyInstance {
    pool: Pool;
    withClient: WithClient;
  }

  interface FastifyRequest {
    user?: SessionUser;
    teamRoleCache?: Map<string, string | null>;
    requestId?: string;
  }

  interface FastifyReply {
    getResponseTime(): number;
  }
}
