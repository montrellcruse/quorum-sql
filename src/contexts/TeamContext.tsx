import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getDbAdapter } from '@/lib/provider';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamWithRole } from '@/integrations/supabase/types';
import { getErrorMessage } from '@/utils/errors';

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
  const fetchSeq = useRef(0);
  const retryRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);

  const fetchUserTeams = useCallback(async () => {
    const seq = ++fetchSeq.current;
    let shouldRetry = false;
    setLoading(true);
    try {
      const adapter = getDbAdapter();
      const data = await adapter.teams.listForUser();
      const items: Team[] = (data || []).map((t) => ({
        id: t.id,
        name: t.name,
        role: (t as TeamWithRole).role || 'member',
        isPersonal: t.is_personal ?? false,
      }));
      // Dedupe by team id; prefer 'admin' role if duplicates present
      const dedupMap = new Map<string, Team>();
      for (const t of items) {
        const prev = dedupMap.get(t.id);
        if (!prev) dedupMap.set(t.id, t);
        else if (prev.role !== 'admin' && t.role === 'admin') dedupMap.set(t.id, t);
      }
      const unique = Array.from(dedupMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      if (seq !== fetchSeq.current) return;
      setUserTeams(unique);

      // Set active team
      if (unique.length > 0) {
        retryRef.current = 0;
        // Check localStorage for previously selected team
        const storedTeamId = localStorage.getItem('activeTeamId');
        const storedTeam = unique.find(t => t.id === storedTeamId);
        
        // If stored team exists and user is still a member, use it
        // Otherwise default to first team
        const teamToActivate = storedTeam || unique[0];
        if (seq !== fetchSeq.current) return;
        setActiveTeamState(teamToActivate);
      } else {
        if (seq !== fetchSeq.current) return;
        setActiveTeamState(null);
        if (user && retryRef.current < 1) {
          shouldRetry = true;
          retryRef.current += 1;
          if (retryTimeoutRef.current !== null) {
            window.clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = window.setTimeout(() => {
            fetchUserTeams();
          }, 800);
        }
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error('Error fetching user teams:', getErrorMessage(error, 'Unknown error'));
      }
      if (seq !== fetchSeq.current) return;
      setUserTeams([]);
      setActiveTeamState(null);
    } finally {
      if (seq === fetchSeq.current && !shouldRetry) {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      retryRef.current = 0;
      fetchUserTeams();
    } else {
      fetchSeq.current += 1;
      retryRef.current = 0;
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      setUserTeams([]);
      setActiveTeamState(null);
      setLoading(false);
    }
  }, [user, fetchUserTeams]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

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
