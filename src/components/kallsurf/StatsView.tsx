import { useMemo, useState } from 'react';
import { useDailyStats } from '../../hooks/useDailyStats';
import { useStatsFilterState } from '../../hooks/useStatsFilterState';
import { STATS_DATA_START_YEAR } from '../../config/constants';
import {
  applyStatsFilters,
  describeEmptyFilters,
  MIN_LEVEL_PRESETS,
} from '../../utils/statsFilters';
import {
  ActiveFilterChips,
  StatsFilterPills,
  StatsResultCounter,
} from './stats/StatsFilterBar';
import { StatsFilterSheet } from './stats/StatsFilterSheet';
import { StatsOverview } from './stats/StatsOverview';
import { StatsTopList } from './stats/StatsTopList';

type StatsViewMode = 'overview' | 'toplist';

interface StatsViewProps {
  onDayClick?: (date: Date) => void;
  onMonthClick?: (monthDate: Date) => void;
}

export function StatsView({ onDayClick, onMonthClick }: StatsViewProps) {
  const currentYear = new Date().getFullYear();
  const { data: allDailyStats, loading, error } = useDailyStats({ endYear: currentYear });
  const { filters, setFilters, resetFilters } = useStatsFilterState();
  const [viewMode, setViewMode] = useState<StatsViewMode>('overview');
  const [sheetOpen, setSheetOpen] = useState(false);

  const { days: filteredDays, total } = useMemo(
    () => applyStatsFilters(allDailyStats, filters),
    [allDailyStats, filters]
  );

  const availableYears = useMemo(
    () => [...new Set(allDailyStats.map((d) => d.year))].sort((a, b) => b - a),
    [allDailyStats]
  );

  const allYears = useMemo(
    () => [...new Set(allDailyStats.map((d) => d.year))].sort((a, b) => a - b),
    [allDailyStats]
  );

  const overviewYear = filters.year === 'all' ? currentYear : filters.year;

  const cycleMinLevel = () => {
    const currentIndex = MIN_LEVEL_PRESETS.findIndex((p) => p.index === filters.minLevelIndex);
    const next = MIN_LEVEL_PRESETS[(currentIndex + 1) % MIN_LEVEL_PRESETS.length];
    setFilters({ minLevelIndex: next.index });
  };

  const isInitialLoading = loading && allDailyStats.length === 0;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
        <p className="font-bold mb-1">Fel vid hämtning</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (isInitialLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-app-subtle">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs uppercase tracking-widest font-medium">Hämtar statistik...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
      <p className="text-[10px] uppercase tracking-wider text-app-subtle text-right">
        Data sedan {STATS_DATA_START_YEAR}
      </p>

      <div className="flex rounded-xl border border-app-border p-1 bg-app-surface">
        {([
          { id: 'overview' as const, label: 'Översikt' },
          { id: 'toplist' as const, label: 'Topplista' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setViewMode(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              viewMode === tab.id ? 'bg-app-text text-white' : 'text-app-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <StatsFilterPills
        filters={filters}
        onOpenSheet={() => setSheetOpen(true)}
        onToggleIce={() => setFilters({ excludeIce: !filters.excludeIce })}
        onToggleDaylight={() => setFilters({ daylightOnly: !filters.daylightOnly })}
        onCycleMinLevel={cycleMinLevel}
      />

      <ActiveFilterChips filters={filters} onChange={setFilters} />
      <StatsResultCounter shown={filteredDays.length} total={total} />

      {filteredDays.length === 0 ? (
        <div className="bg-app-surface border border-app-border rounded-2xl p-4 text-sm text-app-text">
          <p className="font-semibold mb-1">Inga dagar matchar</p>
          <p className="text-app-muted mb-3">
            Inga dagar matchar {describeEmptyFilters(filters)}. Prova en lägre nivå eller fler riktningar.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-semibold text-app-text underline"
          >
            Rensa filter
          </button>
        </div>
      ) : viewMode === 'overview' ? (
        <StatsOverview
          days={filteredDays}
          allYears={allYears}
          overviewYear={overviewYear}
          onDayClick={onDayClick}
          onMonthClick={onMonthClick}
        />
      ) : (
        <StatsTopList days={filteredDays} onDayClick={onDayClick} />
      )}

      {loading && (
        <p className="text-center text-xs text-app-subtle">Uppdaterar...</p>
      )}

      <StatsFilterSheet
        open={sheetOpen}
        filters={filters}
        matchCount={filteredDays.length}
        availableYears={availableYears}
        onChange={setFilters}
        onClose={() => setSheetOpen(false)}
        onReset={resetFilters}
      />
    </div>
  );
}
