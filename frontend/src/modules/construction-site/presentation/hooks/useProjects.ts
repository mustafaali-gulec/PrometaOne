/**
 * useProjects — bir şirketin projelerini (filtreli) çeker.
 */
import { useCallback, useEffect, useState } from 'react';

import type {
  ProjectDto,
  ProjectStatus,
  ProjectType,
} from '../../application/dto/ConstructionDtos';
import type { ConstructionApi } from '../../application/ports/ConstructionApi';

export interface UseProjectsOptions {
  includeInactive?: boolean;
  status?: ProjectStatus;
  projectType?: ProjectType;
  search?: string;
  autoFetch?: boolean;
}

export interface UseProjectsResult {
  projects: ReadonlyArray<ProjectDto>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProjects(
  api: ConstructionApi,
  companyId: number,
  options: UseProjectsOptions = {},
): UseProjectsResult {
  const [projects, setProjects] = useState<ReadonlyArray<ProjectDto>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const opts: {
        includeInactive?: boolean;
        status?: ProjectStatus;
        projectType?: ProjectType;
        search?: string;
      } = {};
      if (options.includeInactive !== undefined) opts.includeInactive = options.includeInactive;
      if (options.status !== undefined) opts.status = options.status;
      if (options.projectType !== undefined) opts.projectType = options.projectType;
      if (options.search !== undefined) opts.search = options.search;
      const res = await api.listProjects(companyId, opts);
      setProjects(res.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    api,
    companyId,
    options.includeInactive,
    options.status,
    options.projectType,
    options.search,
  ]);

  useEffect(() => {
    if (options.autoFetch === false) return;
    void refetch();
  }, [refetch, options.autoFetch]);

  return { projects, loading, error, refetch };
}
