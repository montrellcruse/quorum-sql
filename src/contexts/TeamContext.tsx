import { createContext, useContext, useEffect, useState } from 'react';
import { getDbAdapter } from '@/lib/provider';
import { useAuth } from '@/contexts/AuthContext';

interface Team {
  id: string;
  name: string;
  role: 'admin' | 'member';
}

interface TeamContextType {
  activeTeam: Team | null;
  userTeams: Team[];
  setActiveTeam: (team: Team) => void;
  refreshTeams: () => Promise<void>;
  loading: boolean;
}

const TeamContext = createContext<TeamContextType>({
  activeTeam: null,
  userTeams: [],
  setActiveTeam: () => {},
  refreshTeams: async () => {},
  loading: true,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

export const TeamProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [activeTeam, setActiveTeamState] = useState<Team | null>(null);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserTeams();
    } else {
      setUserTeams([]);
      setActiveTeamState(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserTeams = async () => {
    try {
      const adapter = getDbAdapter();
      const data = await adapter.teams.listForUser();
      const items: Team[] = (data || []).map((t) => ({ id: t.id, name: t.name, role: (t as any).role || 'member' }));
      // Dedupe by team id; prefer 'admin' role if duplicates present
      const dedupMap = new Map<string, Team>();
      for (const t of items) {
        const prev = dedupMap.get(t.id);
        if (!prev) dedupMap.set(t.id, t);
        else if (prev.role !== 'admin' && t.role === 'admin') dedupMap.set(t.id, t);
      }
      const unique = Array.from(dedupMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      setUserTeams(unique);

      // Set active team
      if (unique.length > 0) {
        // Check localStorage for previously selected team
        const storedTeamId = localStorage.getItem('activeTeamId');
        const storedTeam = unique.find(t => t.id === storedTeamId);
        
        // If stored team exists and user is still a member, use it
        // Otherwise default to first team
        const teamToActivate = storedTeam || unique[0];
        setActiveTeamState(teamToActivate);
      } else {
        setActiveTeamState(null);
      }
    } catch (error: any) {
      console.error('Error fetching user teams:', { message: error?.message });
      setUserTeams([]);
      setActiveTeamState(null);
    } finally {
      setLoading(false);
    }
  };

  const setActiveTeam = (team: Team) => {
    setActiveTeamState(team);
    localStorage.setItem('activeTeamId', team.id);
  };

  return (
    <TeamContext.Provider value={{ activeTeam, userTeams, setActiveTeam, refreshTeams: fetchUserTeams, loading }}>
      {children}
    </TeamContext.Provider>
  );
};
