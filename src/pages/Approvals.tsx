import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePendingApprovalQueries } from '@/hooks/usePendingApprovals';
import { getErrorMessage } from '@/utils/errors';

const Approvals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTeam } = useTeam();
  const pendingQueriesQuery = usePendingApprovalQueries(activeTeam?.id, user?.email, {
    enabled: Boolean(user?.email && activeTeam),
  });
  const pendingQueries = pendingQueriesQuery.data ?? [];
  const loadingQueries = pendingQueriesQuery.isLoading;

  useEffect(() => {
    if (pendingQueriesQuery.isError && import.meta.env.DEV) {
      console.error(
        'Error fetching pending queries:',
        getErrorMessage(pendingQueriesQuery.error, 'Unknown error')
      );
    }
  }, [pendingQueriesQuery.isError, pendingQueriesQuery.error]);

  if (loadingQueries) {
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
              className="self-start sm:self-auto"
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
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
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
