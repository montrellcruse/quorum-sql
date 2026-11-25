import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getDbAdapter } from '@/lib/provider';

interface Team {
  id: string;
  name: string;
  role: 'admin' | 'member';
  isPersonal?: boolean;
}

interface TeamContextType {
  activeTeam: Team | null;
  userTeams: Team[];
  setActiveTeam: (team: Team) => void;
  refreshTeams: () => Promise<void>;
  loading: boolean;
  error: Error | null;
  sessionScope: number;
}

const TeamContext = createContext<TeamContextType>({
  activeTeam: null,
  userTeams: [],
  setActiveTeam: () => {},
  refreshTeams: async () => {},
  loading: true,
  error: null,
  sessionScope: 0,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useTeam = () => useContext(TeamContext);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const { user, sessionScope } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState(() => localStorage.getItem('activeTeamId'));
  const key = ['teams', 'list', sessionScope] as const;
  const teamsQuery = useQuery({
    queryKey: key,
    enabled: Boolean(user),
    queryFn: async () => {
      const teams = await getDbAdapter().teams.listForUser();
      return teams.map((team): Team => ({
        id: team.id,
        name: team.name,
        role: team.role ?? 'member',
        isPersonal: team.is_personal ?? false,
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const userTeams = user ? teamsQuery.data ?? [] : [];
  const activeTeam = userTeams.find((team) => team.id === selectedTeamId) ?? userTeams[0] ?? null;

  const activeTeamId = activeTeam?.id;
  useEffect(() => {
    if (activeTeamId) {
      setSelectedTeamId(activeTeamId);
      localStorage.setItem('activeTeamId', activeTeamId);
    }
  }, [activeTeamId]);

  const setActiveTeam = (team: Team) => {
    setSelectedTeamId(team.id);
  };

  const refreshTeams = async () => {
    if (!user) return;
    await queryClient.cancelQueries({ queryKey: key, exact: true });
    await queryClient.invalidateQueries({ queryKey: key, exact: true });
  };

  return (
    <TeamContext.Provider value={{
      activeTeam, userTeams, setActiveTeam, refreshTeams, sessionScope,
      loading: teamsQuery.isLoading, error: teamsQuery.error,
    }}>
      {children}
    </TeamContext.Provider>
  );
};
