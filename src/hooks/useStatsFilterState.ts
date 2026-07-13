import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_STATS_FILTERS,
  STATS_FILTERS_STORAGE_KEY,
  type StatsFilters,
} from '../utils/statsFilters';

function loadFilters(): StatsFilters {
  try {
    const raw = localStorage.getItem(STATS_FILTERS_STORAGE_KEY);
    if (!raw) return DEFAULT_STATS_FILTERS;
    const parsed = JSON.parse(raw) as Partial<StatsFilters>;
    return { ...DEFAULT_STATS_FILTERS, ...parsed };
  } catch {
    return DEFAULT_STATS_FILTERS;
  }
}

export function useStatsFilterState() {
  const [filters, setFiltersState] = useState<StatsFilters>(loadFilters);

  useEffect(() => {
    localStorage.setItem(STATS_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const setFilters = useCallback((patch: Partial<StatsFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_STATS_FILTERS);
    localStorage.removeItem(STATS_FILTERS_STORAGE_KEY);
  }, []);

  return { filters, setFilters, resetFilters, setFiltersState };
}
