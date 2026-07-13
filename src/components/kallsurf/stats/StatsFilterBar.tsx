import { X, SlidersHorizontal } from 'lucide-react';
import { MIN_LEVEL_PRESETS, DEFAULT_STATS_FILTERS, countActiveSheetFilters, type StatsFilters } from '../../../utils/statsFilters';
import { getDefaultIcePeriodLabel } from '../../../config/iceConfig';

interface StatsFilterPillsProps {
  filters: StatsFilters;
  onOpenSheet: () => void;
  onToggleIce: () => void;
  onToggleDaylight: () => void;
  onCycleMinLevel: () => void;
}

export function StatsFilterPills({
  filters,
  onOpenSheet,
  onToggleIce,
  onToggleDaylight,
  onCycleMinLevel,
}: StatsFilterPillsProps) {
  const sheetCount = countActiveSheetFilters(filters);
  const minPreset =
    MIN_LEVEL_PRESETS.find((p) => p.index === filters.minLevelIndex) ?? MIN_LEVEL_PRESETS[0];

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onToggleIce}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          filters.excludeIce
            ? 'bg-app-text text-white border-app-text'
            : 'bg-app-surface border-app-border text-app-text'
        }`}
      >
        Exkl. is{filters.excludeIce ? ' ✓' : ''}
      </button>
      <button
        type="button"
        onClick={onToggleDaylight}
        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          filters.daylightOnly
            ? 'bg-app-text text-white border-app-text'
            : 'bg-app-surface border-app-border text-app-text'
        }`}
      >
        Dagsljus{filters.daylightOnly ? ' ✓' : ''}
      </button>
      <button
        type="button"
        onClick={onCycleMinLevel}
        className="px-3 py-1.5 rounded-full text-xs font-medium border bg-app-surface border-app-border text-app-text"
      >
        {minPreset.label} ▾
      </button>
      <button
        type="button"
        onClick={onOpenSheet}
        className="px-3 py-1.5 rounded-full text-xs font-medium border bg-app-surface border-app-border text-app-text inline-flex items-center gap-1"
      >
        <SlidersHorizontal size={12} />
        Filter{sheetCount > 0 ? ` (${sheetCount})` : ''}
      </button>
    </div>
  );
}

interface ActiveFilterChipsProps {
  filters: StatsFilters;
  onChange: (patch: Partial<StatsFilters>) => void;
}

export function ActiveFilterChips({ filters, onChange }: ActiveFilterChipsProps) {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (!filters.excludeIce) {
    chips.push({
      key: 'ice',
      label: 'Inkl. isperiod',
      onRemove: () => onChange({ excludeIce: true }),
    });
  }
  if (!filters.daylightOnly) {
    chips.push({
      key: 'daylight',
      label: 'Alla tider',
      onRemove: () => onChange({ daylightOnly: true }),
    });
  }
  if (filters.minLevelIndex !== DEFAULT_STATS_FILTERS.minLevelIndex) {
    const preset = MIN_LEVEL_PRESETS.find((p) => p.index === filters.minLevelIndex);
    chips.push({
      key: 'level',
      label: preset?.label ?? 'Miniminivå',
      onRemove: () => onChange({ minLevelIndex: DEFAULT_STATS_FILTERS.minLevelIndex }),
    });
  }
  filters.directions.forEach((dir) => {
    chips.push({
      key: `dir-${dir}`,
      label: dir,
      onRemove: () =>
        onChange({ directions: filters.directions.filter((d) => d !== dir) }),
    });
  });
  if (filters.year !== 'all') {
    chips.push({
      key: 'year',
      label: String(filters.year),
      onRemove: () => onChange({ year: 'all' }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-app-surface-elevated border border-app-border text-app-text"
        >
          {chip.label}
          <X size={12} />
        </button>
      ))}
    </div>
  );
}

export function StatsResultCounter({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="text-xs text-app-muted">
      Visar <span className="font-semibold text-app-text">{shown}</span> av {total} dagar
    </p>
  );
}

export function icePeriodHint(): string {
  return getDefaultIcePeriodLabel();
}
