import { useQuery } from '@tanstack/react-query';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import { checkPendingInvitationsCount, getPendingApprovalsCount } from '@/utils/teamUtils';
import type { PendingApprovalQuery } from '@/lib/provider/types';

interface PendingCountOptions {
  enabled?: boolean;
  refetchIntervalMs?: number;
}

interface PendingQueriesOptions {
  enabled?: boolean;
  refetchIntervalMs?: number;
}

export function usePendingInvitesCount(email?: string, options: PendingCountOptions = {}) {
  const { enabled = true, refetchIntervalMs = 60000 } = options;

  return useQuery({
    queryKey: queryKeys.dashboard.pendingInvites(email ?? ''),
    enabled: Boolean(email) && enabled,
    queryFn: async () => {
      if (!email) return 0;
      return checkPendingInvitationsCount(email);
    },
    refetchInterval: refetchIntervalMs,
  });
}

export function usePendingApprovalsCount(
  teamId?: string,
  email?: string,
  options: PendingCountOptions = {}
) {
  const { enabled = true, refetchIntervalMs = 60000 } = options;

  return useQuery({
    queryKey: queryKeys.dashboard.pendingApprovals(teamId ?? '', email ?? ''),
    enabled: Boolean(teamId && email) && enabled,
    queryFn: async () => {
      if (!teamId || !email) return 0;
      return getPendingApprovalsCount(teamId, email);
    },
    refetchInterval: refetchIntervalMs,
  });
}

export function usePendingApprovalQueries(
  teamId?: string,
  excludeEmail?: string,
  options: PendingQueriesOptions = {}
) {
  const { adapter } = useDbProvider();
  const { enabled = true, refetchIntervalMs = 60000 } = options;

  return useQuery({
    queryKey: queryKeys.queries.pendingByTeam(teamId ?? '', excludeEmail ?? ''),
    enabled: Boolean(teamId && excludeEmail) && enabled,
    queryFn: async (): Promise<PendingApprovalQuery[]> => {
      if (!teamId || !excludeEmail) return [];
      return adapter.queries.getPendingForApproval(teamId, excludeEmail);
    },
    refetchInterval: refetchIntervalMs,
  });
}
