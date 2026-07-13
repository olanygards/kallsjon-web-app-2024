import { MIN_LEVEL_PRESETS, type StatsFilters } from '../../../utils/statsFilters';
import { getDefaultIcePeriodLabel } from '../../../config/iceConfig';
import { WindCompass8 } from './WindCompass8';
import type { WindSector8 } from '../../../utils/windDirection8';

interface StatsFilterSheetProps {
  open: boolean;
  filters: StatsFilters;
  matchCount: number;
  availableYears: number[];
  onChange: (patch: Partial<StatsFilters>) => void;
  onClose: () => void;
  onReset: () => void;
}

function TogglePair({
  left,
  right,
  activeLeft,
  onLeft,
  onRight,
}: {
  left: string;
  right: string;
  activeLeft: boolean;
  onLeft: () => void;
  onRight: () => void;
}) {
  return (
    <div className="flex rounded-lg border border-app-border overflow-hidden">
      <button
        type="button"
        onClick={onLeft}
        className={`flex-1 py-2 text-xs font-medium ${activeLeft ? 'bg-app-text text-white' : 'bg-app-surface text-app-text'}`}
      >
        {left}
      </button>
      <button
        type="button"
        onClick={onRight}
        className={`flex-1 py-2 text-xs font-medium ${!activeLeft ? 'bg-app-text text-white' : 'bg-app-surface text-app-text'}`}
      >
        {right}
      </button>
    </div>
  );
}

export function StatsFilterSheet({
  open,
  filters,
  matchCount,
  availableYears,
  onChange,
  onClose,
  onReset,
}: StatsFilterSheetProps) {
  if (!open) return null;

  const toggleDirection = (sector: WindSector8) => {
    const next = filters.directions.includes(sector)
      ? filters.directions.filter((d) => d !== sector)
      : [...filters.directions, sector];
    onChange({ directions: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-app-surface rounded-t-2xl border border-app-border shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-app-text">Filter</h3>
            <button type="button" onClick={onClose} className="text-xs text-app-muted">
              Stäng
            </button>
          </div>

          <div>
            <p className="text-xs font-medium text-app-muted mb-2">Isperiod ({getDefaultIcePeriodLabel()})</p>
            <TogglePair
              left="Exkludera"
              right="Inkludera"
              activeLeft={filters.excludeIce}
              onLeft={() => onChange({ excludeIce: true })}
              onRight={() => onChange({ excludeIce: false })}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-app-muted mb-2">Dagsljus</p>
            <TogglePair
              left="Endast"
              right="Alla"
              activeLeft={filters.daylightOnly}
              onLeft={() => onChange({ daylightOnly: true })}
              onRight={() => onChange({ daylightOnly: false })}
            />
          </div>

          <div>
            <p className="text-xs font-medium text-app-muted mb-2">Miniminivå</p>
            <div className="flex flex-wrap gap-2">
              {MIN_LEVEL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ minLevelIndex: preset.index })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filters.minLevelIndex === preset.index
                      ? 'bg-app-text text-white border-app-text'
                      : 'bg-app-surface border-app-border text-app-text'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-app-muted mb-2">Riktning</p>
            <WindCompass8 selected={filters.directions} onToggle={toggleDirection} />
            {filters.directions.length > 0 && (
              <p className="text-center text-xs text-app-muted mt-2">{filters.directions.join(', ')}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-app-muted mb-2">År</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChange({ year: 'all' })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  filters.year === 'all' ? 'bg-app-text text-white border-app-text' : 'bg-app-surface border-app-border'
                }`}
              >
                Alla
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => onChange({ year })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                    filters.year === year ? 'bg-app-text text-white border-app-text' : 'bg-app-surface border-app-border'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-app-border flex items-center justify-between gap-3">
            <p className="text-sm text-app-text">
              <span className="font-bold">{matchCount}</span> dagar matchar
            </p>
            <button type="button" onClick={onReset} className="text-xs text-red-600 font-medium">
              Rensa alla
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-app-text text-white text-sm font-semibold"
          >
            Visa resultat
          </button>
        </div>
      </div>
    </div>
  );
}
