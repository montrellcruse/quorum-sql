import { useMutation, useQuery } from '@tanstack/react-query';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import type { QueryApproval, QueryHistory, SqlQuery } from '@/lib/provider/types';

type QueryWithFolderName = SqlQuery & { folder_name?: string | null };

export interface QuerySearchResult {
  id: string;
  title: string;
  description: string | null;
  folder_id: string;
  folder_name: string;
}

interface UseQueryByIdOptions {
  enabled?: boolean;
}

interface UseQueryHistoryOptions {
  enabled?: boolean;
}

interface UseQueryApprovalsOptions {
  enabled?: boolean;
}

export function useQueryById(queryId?: string, options: UseQueryByIdOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.queries.detail(queryId ?? ''),
    enabled: Boolean(queryId) && enabled,
    queryFn: async () => {
      if (!queryId) return null;
      return adapter.queries.getById(queryId);
    },
  });
}

export function useQueryHistory(queryId?: string, options: UseQueryHistoryOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.queries.history(queryId ?? ''),
    enabled: Boolean(queryId) && enabled,
    queryFn: async (): Promise<QueryHistory[]> => {
      if (!queryId) return [];
      return adapter.queries.getHistory(queryId);
    },
  });
}

export interface QueryApprovalsData {
  approval_quota: number;
  approvals: QueryApproval[];
  latest_history_id: string | null;
}

export function useQueryApprovals(queryId?: string, options: UseQueryApprovalsOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.queries.approvals(queryId ?? ''),
    enabled: Boolean(queryId) && enabled,
    queryFn: async (): Promise<QueryApprovalsData> => {
      if (!queryId) {
        return { approval_quota: 1, approvals: [], latest_history_id: null };
      }
      const data = await adapter.queries.getApprovals(queryId);
      return {
        approval_quota: data.approval_quota || 1,
        approvals: data.approvals || [],
        latest_history_id: data.latest_history_id ?? null,
      };
    },
  });
}

export function useSearchQueriesMutation(teamId?: string) {
  const { adapter } = useDbProvider();

  return useMutation({
    mutationFn: async (searchTerm: string): Promise<QuerySearchResult[]> => {
      const trimmed = searchTerm.trim();
      if (!teamId || !trimmed) return [];

      const rows = await adapter.queries.search({ teamId, q: trimmed });
      return (rows || []).map((query: QueryWithFolderName) => ({
        id: query.id,
        title: query.title,
        description: query.description ?? null,
        folder_id: query.folder_id || '',
        folder_name: query.folder_name || 'Unknown Folder',
      }));
    },
  });
}
