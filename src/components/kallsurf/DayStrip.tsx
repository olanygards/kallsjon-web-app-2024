import { WIND_SCALE_LEVELS } from '../../config/windScale';
import { DayBest } from '../../utils/bestWindPerDay';

interface DayStripProps {
  days: DayBest[];
  selectedDateKey?: string | null;
  onDayClick?: (day: DayBest) => void;
}

/**
 * Dagremsa med bästa vindtillfället per dag (BESLUT 01).
 * Delad mellan Läget (Kommande 7 dagar) och Prognos (dagval).
 */
export function DayStrip({ days, selectedDateKey, onDayClick }: DayStripProps) {
  if (days.length === 0) return null;

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map(day => {
        const level = WIND_SCALE_LEVELS[day.levelIndex];
        const isSelected = selectedDateKey === day.dateKey;

        return (
          <button
            key={day.dateKey}
            onClick={() => onDayClick?.(day)}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2 px-0.5 transition-all cursor-pointer active:scale-95 ${isSelected
              ? 'border-white ring-1 ring-white/60'
              : 'border-emerald-800/60 hover:border-emerald-500'
              } bg-emerald-900/40`}
          >
            <span className="text-[10px] font-bold text-emerald-300 capitalize leading-none">
              {day.label}
            </span>
            <span
              className="w-full max-w-[34px] h-2 rounded-sm border border-black/10"
              style={{ backgroundColor: level.colors.bg }}
            />
            <span className="text-[11px] font-bold text-white leading-none">
              {Math.round(day.slot.avg)}
              {day.gustDriven && <span className="text-emerald-400" title="Byvind gör dagen surfbar">*</span>}
            </span>
            <span className="text-[8px] text-emerald-500 leading-none">
              kl {String(day.slot.time.getHours()).padStart(2, '0')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
