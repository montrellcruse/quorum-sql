import 'fastify';

export type AuthSource = 'supabase' | 'session' | 'dev-header' | 'dev-fake';

export interface SessionUser {
  id: string;
  email?: string;
  role?: string;
  source: AuthSource;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: SessionUser;
    teamRoleCache?: Map<string, string | null>;
    requestId?: string;
  }

  interface FastifyReply {
    getResponseTime(): number;
  }
}
