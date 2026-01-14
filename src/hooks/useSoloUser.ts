import { useEffect, useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { getDbAdapter } from '@/lib/provider';

export interface SoloUserContext {
  isSoloUser: boolean;
  isPersonalTeam: boolean;
  teamMemberCount: number;
  loading: boolean;
}

export interface UseSoloUserOptions {
  teamId?: string | null;
  isPersonalTeam?: boolean;
}

export function useSoloUser(options: UseSoloUserOptions = {}): SoloUserContext {
  const { activeTeam } = useTeam();
  const teamId = options.teamId === undefined ? activeTeam?.id : options.teamId;
  const personalFlag = options.isPersonalTeam ?? activeTeam?.isPersonal ?? false;
  const [memberCount, setMemberCount] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function fetchMemberCount() {
      if (!teamId) {
        if (isActive) {
          setMemberCount(1);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const adapter = getDbAdapter();
        const members = await adapter.members.list(teamId);
        if (isActive) {
          setMemberCount(members?.length || 1);
        }
      } catch {
        if (isActive) {
          setMemberCount(1);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    fetchMemberCount();

    return () => {
      isActive = false;
    };
  }, [teamId]);

  const isSoloUser = memberCount === 1;

  return {
    isSoloUser,
    isPersonalTeam: personalFlag,
    teamMemberCount: memberCount,
    loading,
  };
}
