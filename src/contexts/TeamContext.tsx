import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          role,
          teams (
            id,
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('teams(name)', { ascending: true });

      if (error) throw error;

      const teams: Team[] = (data || [])
        .filter((item: any) => item.teams)
        .map((item: any) => ({
          id: item.teams.id,
          name: item.teams.name,
          role: item.role as 'admin' | 'member',
        }));

      setUserTeams(teams);

      // Set active team
      if (teams.length > 0) {
        // Check localStorage for previously selected team
        const storedTeamId = localStorage.getItem('activeTeamId');
        const storedTeam = teams.find(t => t.id === storedTeamId);
        
        // If stored team exists and user is still a member, use it
        // Otherwise default to first team
        const teamToActivate = storedTeam || teams[0];
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
