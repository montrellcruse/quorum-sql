export const queryKeys = {
  teams: {
    detail: (teamId: string) => ['teams', 'detail', teamId] as const,
    members: (teamId: string, sessionScope: number) => ['teams', 'members', teamId, sessionScope] as const,
    invitations: (teamId: string) => ['teams', 'invitations', teamId] as const,
  },
  folders: {
    roots: (teamId: string, sessionScope: number) => ['folders', 'roots', teamId, sessionScope] as const,
    paths: (teamId: string) => ['folders', 'paths', teamId] as const,
  },
  queries: {
    detail: (queryId: string) => ['queries', 'detail', queryId] as const,
    history: (queryId: string) => ['queries', 'history', queryId] as const,
    approvals: (queryId: string) => ['queries', 'approvals', queryId] as const,
    pendingByTeam: (teamId: string, excludeEmail: string) =>
      ['queries', 'pending', teamId, excludeEmail] as const,
  },
  dashboard: {
    pendingInvites: (email: string) => ['dashboard', 'pending-invites', email] as const,
    pendingApprovals: (teamId: string, email: string) =>
      ['dashboard', 'pending-approvals', teamId, email] as const,
  },
};
