import {
  useInfiniteQuery, useQuery, type InfiniteData, type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import type { Folder, FolderPath } from '@/lib/provider/types';

const ROOT_PAGE_SIZE = 50;

interface RootFolderPage {
  folders: Folder[];
  nextOffset?: number;
}

export function useRootFolders(
  teamId: string | undefined, sessionScope: number,
): UseInfiniteQueryResult<InfiniteData<RootFolderPage, number>> {
  const { adapter } = useDbProvider();

  return useInfiniteQuery({
    queryKey: queryKeys.folders.roots(teamId ?? '', sessionScope),
    enabled: Boolean(teamId),
    initialPageParam: 0,
    queryFn: async ({ pageParam: offset }) => {
      if (!teamId) throw new Error('Missing team for folder list');
      const folders = await adapter.folders.listRoots(teamId, { limit: ROOT_PAGE_SIZE + 1, offset });
      return {
        folders: folders.slice(0, ROOT_PAGE_SIZE),
        nextOffset: folders.length > ROOT_PAGE_SIZE ? offset + ROOT_PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (page) => page.nextOffset,
  });
}

export function useTeamFolderPaths(teamId?: string, options: { enabled?: boolean } = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.folders.paths(teamId ?? ''),
    enabled: Boolean(teamId) && enabled,
    queryFn: async (): Promise<FolderPath[]> => {
      if (!teamId) return [];
      return adapter.folders.listPaths(teamId);
    },
  });
}
