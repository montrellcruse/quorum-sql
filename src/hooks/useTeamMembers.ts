import { useQuery } from '@tanstack/react-query';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import type { TeamInvitation, TeamMember } from '@/lib/provider/types';

interface BaseOptions {
  enabled?: boolean;
}

export function useTeamDetails(teamId?: string, options: BaseOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.teams.detail(teamId ?? ''),
    enabled: Boolean(teamId) && enabled,
    queryFn: async () => {
      if (!teamId) return null;
      return adapter.teams.getById(teamId);
    },
  });
}

export function useTeamMembers(teamId: string | undefined, sessionScope: number) {
  const { adapter } = useDbProvider();

  return useQuery({
    queryKey: queryKeys.teams.members(teamId ?? '', sessionScope),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<TeamMember[]> => {
      if (!teamId) return [];
      return adapter.members.list(teamId);
    },
  });
}

export function useTeamInvitations(teamId?: string, options: BaseOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.teams.invitations(teamId ?? ''),
    enabled: Boolean(teamId) && enabled,
    queryFn: async (): Promise<TeamInvitation[]> => {
      if (!teamId) return [];
      return adapter.invitations.listByTeam(teamId);
    },
  });
}
