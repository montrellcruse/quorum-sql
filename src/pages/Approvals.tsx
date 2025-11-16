import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingQuery {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  last_modified_by_email: string;
  updated_at: string;
  folder_name: string;
  approval_count: number;
  approval_quota: number;
}

const Approvals = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { activeTeam } = useTeam();
  const [pendingQueries, setPendingQueries] = useState<PendingQuery[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && activeTeam) {
      fetchPendingQueries();
    }
  }, [user, activeTeam]);

  const fetchPendingQueries = async () => {
    if (!user?.email || !activeTeam) return;

    setLoadingQueries(true);
    try {
      const provider = (import.meta.env.VITE_DB_PROVIDER || 'supabase').toLowerCase();
      if (provider === 'rest') {
        const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
        if (!API_BASE) throw new Error('VITE_API_BASE_URL is not set');
        const params = new URLSearchParams({ teamId: activeTeam.id, excludeEmail: user.email });
        const res = await fetch(`${API_BASE.replace(/\/$/, '')}/approvals?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) throw new Error(await res.text());
        const rows = await res.json();
        setPendingQueries(rows || []);
      } else {
        // Supabase path
        const { data: queries, error: queriesError } = await supabase
          .from('sql_queries')
          .select(`
            id,
            title,
            description,
            folder_id,
            last_modified_by_email,
            updated_at,
            folders!inner(name)
          `)
          .eq('team_id', activeTeam.id)
          .eq('status', 'pending_approval')
          .neq('last_modified_by_email', user.email)
          .order('updated_at', { ascending: false });
        if (queriesError) throw queriesError;
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('approval_quota')
          .eq('id', activeTeam.id)
          .single();
        if (teamError) throw teamError;
        const queriesWithCounts = await Promise.all(
          (queries || []).map(async (query) => {
            const { data: historyData } = await supabase
              .from('query_history')
              .select('id')
              .eq('query_id', query.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (historyData) {
              const { count } = await supabase
                .from('query_approvals')
                .select('*', { count: 'exact', head: true })
                .eq('query_history_id', historyData.id);
              return {
                id: query.id,
                title: query.title,
                description: query.description,
                folder_id: query.folder_id,
                last_modified_by_email: query.last_modified_by_email,
                updated_at: query.updated_at,
                folder_name: (query.folders as any).name,
                approval_count: count || 0,
                approval_quota: teamData.approval_quota,
              };
            }
            return {
              id: query.id,
              title: query.title,
              description: query.description,
              folder_id: query.folder_id,
              last_modified_by_email: query.last_modified_by_email,
              updated_at: query.updated_at,
              folder_name: (query.folders as any).name,
              approval_count: 0,
              approval_quota: teamData.approval_quota,
            };
          })
        );
        setPendingQueries(queriesWithCounts);
      }
    } catch (error: any) {
      console.error('Error fetching pending queries:', error);
    } finally {
      setLoadingQueries(false);
    }
  };

  if (loading || loadingQueries) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Approval Queue</CardTitle>
              <CardDescription>
                {pendingQueries.length > 0
                  ? `${pendingQueries.length} ${pendingQueries.length === 1 ? 'query needs' : 'queries need'} your review`
                  : 'No queries awaiting approval'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pendingQueries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                There are no queries awaiting your approval at the moment.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Approvals</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingQueries.map((query) => (
                    <TableRow
                      key={query.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/query/view/${query.id}`, { state: { from: 'approvals' } })}
                    >
                      <TableCell>
                        <div className="font-medium">{query.title}</div>
                        {query.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {query.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{query.folder_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{query.last_modified_by_email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {formatDistanceToNow(new Date(query.updated_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={query.approval_count >= query.approval_quota ? "default" : "secondary"}>
                          {query.approval_count}/{query.approval_quota}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/query/view/${query.id}`, { state: { from: 'approvals' } });
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Approvals;
