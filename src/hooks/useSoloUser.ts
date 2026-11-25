import { useTeam } from '@/contexts/TeamContext';
import { useTeamMembers } from '@/hooks/useTeamMembers';

export interface SoloUserContext {
  isSoloUser: boolean;
  isPersonalTeam: boolean;
  teamMemberCount: number | null;
  loading: boolean;
  error: boolean;
}

export interface UseSoloUserOptions {
  teamId?: string | null;
  isPersonalTeam?: boolean;
}

export function useSoloUser(options: UseSoloUserOptions = {}): SoloUserContext {
  const { activeTeam, sessionScope } = useTeam();
  const teamId = options.teamId === undefined ? activeTeam?.id : options.teamId;
  const roster = useTeamMembers(activeTeam ? teamId ?? undefined : undefined, sessionScope);
  const teamMemberCount = roster.isSuccess && !roster.isFetching ? roster.data.length : null;

  return {
    isSoloUser: teamMemberCount === 1,
    isPersonalTeam: options.isPersonalTeam ?? activeTeam?.isPersonal ?? false,
    teamMemberCount,
    loading: roster.isFetching,
    error: roster.isError,
  };
}
