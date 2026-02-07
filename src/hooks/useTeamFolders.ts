import { useQuery } from '@tanstack/react-query';
import { useDbProvider } from '@/hooks/useDbProvider';
import { queryKeys } from '@/hooks/queryKeys';
import type { Folder, FolderPath } from '@/lib/provider/types';

interface UseTeamFoldersOptions {
  enabled?: boolean;
  rootOnly?: boolean;
}

interface UseTeamFolderPathsOptions {
  enabled?: boolean;
}

export function useTeamFolders(teamId?: string, options: UseTeamFoldersOptions = {}) {
  const { adapter } = useDbProvider();
  const { enabled = true, rootOnly = false } = options;

  return useQuery({
    queryKey: queryKeys.folders.byTeam(teamId ?? ''),
    enabled: Boolean(teamId) && enabled,
    queryFn: async (): Promise<Folder[]> => {
      if (!teamId) return [];
      const folders = await adapter.folders.listByTeam(teamId);
      if (!rootOnly) return folders;
      return folders
        .filter((folder) => folder.parent_folder_id == null)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useTeamFolderPaths(teamId?: string, options: UseTeamFolderPathsOptions = {}) {
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
