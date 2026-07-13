import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import type { DailyStats } from '../../../hooks/useDailyStats';
import { getWindLevel } from '../../../utils/windColors';
import { formatDirectionLabel } from '../../../utils/windDirection8';
import {
  formatSurfableHours,
  type StatsSortMode,
} from '../../../utils/statsFilters';
import { parseDayDate } from '../../../utils/statsOverviewUtils';

interface StatsTopListProps {
  days: DailyStats[];
  onDayClick?: (date: Date) => void;
}

const SORT_OPTIONS: Array<{ id: StatsSortMode; label: string }> = [
  { id: 'maxForce', label: 'Högsta medel' },
  { id: 'maxGust', label: 'Högsta by' },
  { id: 'surfableMinutes', label: 'Längst fönster' },
];

function primaryValue(day: DailyStats, sortBy: StatsSortMode): string {
  if (sortBy === 'maxGust') return `${day.maxGust} m/s`;
  if (sortBy === 'surfableMinutes') return formatSurfableHours(day.surfableMinutes);
  return `${day.maxForce} m/s`;
}

function sortDays(days: DailyStats[], sortBy: StatsSortMode): DailyStats[] {
  return [...days].sort((a, b) => {
    if (sortBy === 'maxGust') return b.maxGust - a.maxGust;
    if (sortBy === 'surfableMinutes') return (b.surfableMinutes ?? 0) - (a.surfableMinutes ?? 0);
    return b.maxForce - a.maxForce;
  });
}

export function StatsTopList({ days, onDayClick }: StatsTopListProps) {
  const [sortBy, setSortBy] = useState<StatsSortMode>('maxForce');
  const [visibleCount, setVisibleCount] = useState(20);

  const sorted = useMemo(() => sortDays(days, sortBy), [days, sortBy]);
  const visible = sorted.slice(0, visibleCount);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-app-subtle mb-2">
          Sortera (hur listan ordnas, inte vad som filtreras)
        </p>
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSortBy(option.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                sortBy === option.id
                  ? 'bg-app-text text-white border-app-text'
                  : 'bg-app-surface border-app-border text-app-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.map((day, index) => {
          const level = getWindLevel(day.maxForce, day.maxGust);
          const primary = primaryValue(day, sortBy);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onDayClick?.(parseDayDate(day.date))}
              className="w-full flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-3 py-3 text-left hover:bg-app-surface-elevated transition-colors"
            >
              <span className="text-xs font-bold text-app-subtle w-5">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-app-text truncate">
                  {format(parseDayDate(day.date), 'd MMM yyyy', { locale: sv })}
                </p>
                <p className="text-[11px] text-app-muted">{formatDirectionLabel(day.maxForceDirection)}</p>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="text-lg font-bold leading-none" style={{ color: level.colors.bgDeep ?? level.colors.bg }}>
                    {primary}
                  </p>
                  <p className="text-[10px] text-app-muted mt-1">
                    medel {day.maxForce} · by {day.maxGust}
                  </p>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: level.colors.bgDeep ?? level.colors.bg }}
                />
                <ChevronRight size={16} className="text-app-subtle flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {visibleCount < sorted.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + 20)}
          className="w-full py-2.5 rounded-xl border border-app-border text-sm font-medium text-app-text hover:bg-app-surface-elevated"
        >
          Visa fler ({sorted.length - visibleCount} kvar)
        </button>
      )}
    </div>
  );
}
