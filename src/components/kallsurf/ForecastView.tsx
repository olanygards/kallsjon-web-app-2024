import { useState } from 'react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useForecastMatrix } from '../../hooks/useForecastMatrix';
import { ModelComparisonGrid } from './ModelComparisonGrid';
import { DayStrip } from './DayStrip';
import { getScaleLegend } from '../../utils/windColors';
import { GUST_SURFABLE_MS } from '../../config/windScale';

interface ForecastViewProps {
  onDayDetailsClick?: (date: Date) => void;
}

/**
 * Prognos-fliken: modelljämförelse en dag i taget (BESLUT 03 i docs/ux/BESLUT.md).
 * Dagremsa väljer dag; gridden visar 8 tidsluckor × modellrader.
 */
export function ForecastView({ onDayDetailsClick }: ForecastViewProps) {
  const { days, dayBests, selectedDayKey, setSelectedDayKey, rows, loading } = useForecastMatrix();
  const [legendOpen, setLegendOpen] = useState(false);

  const selectedDay = days.find(d => d.dateKey === selectedDayKey);
  const legend = getScaleLegend();

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-app-muted text-xs font-bold uppercase tracking-wider">
            Prognosmodeller
          </h3>
          <span className="text-[10px] text-app-subtle">Kallsjön · 7 dygn</span>
        </div>

        {dayBests.length > 0 ? (
          <DayStrip
            days={dayBests}
            selectedDateKey={selectedDayKey}
            onDayClick={(day) => setSelectedDayKey(day.dateKey)}
          />
        ) : loading ? (
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-app-surface/60 animate-pulse" />
            ))}
          </div>
        ) : null}

        <div className="mt-4 mb-2 flex items-baseline justify-between">
          <span className="text-[11px] text-app-text font-medium capitalize">
            {selectedDay ? format(selectedDay.date, 'EEEE d MMMM', { locale: sv }) : ''}
          </span>
          <span className="text-[9px] text-app-subtle">medel (by) m/s · pil = vindriktning</span>
        </div>

        <ModelComparisonGrid rows={rows} selectedDayKey={selectedDayKey} />

        {selectedDay && onDayDetailsClick && (
          <button
            onClick={() => onDayDetailsClick(selectedDay.date)}
            className="mt-3 w-full text-center text-[11px] text-app-muted hover:text-app-text underline underline-offset-2"
          >
            Visa dagen i Detaljer ›
          </button>
        )}
      </div>

      {/* Vindskala — expanderbar förklaring */}
      <div className="bg-app-surface border border-app-border rounded-xl shadow-sm">
        <button
          onClick={() => setLegendOpen(o => !o)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <span className="text-xs text-app-text font-bold">
            Vindskala &amp; trösklar — vad krävs för surf?
          </span>
          {legendOpen ? <ChevronUp size={14} className="text-app-subtle" /> : <ChevronDown size={14} className="text-app-subtle" />}
        </button>

        {legendOpen && (
          <div className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-7 gap-1">
              {legend.map(item => (
                <div key={item.label} className="text-center">
                  <div
                    className="h-3 rounded-sm border border-black/10 mb-1"
                    style={{ backgroundColor: item.bg }}
                  />
                  <span className="block text-[8px] text-app-text font-bold leading-tight">{item.label}</span>
                  <span className="block text-[8px] text-app-subtle leading-tight">{item.threshold}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-app-subtle leading-snug">
              Trösklar i medelvind (m/s). Byvind ≥ {GUST_SURFABLE_MS} m/s räknas som surfbart även om
              medelvinden är lägre. Nedtonade celler har passerat.
            </p>
          </div>
        )}
      </div>

      <p className="text-[9px] text-app-subtle text-center">
        Weather data by Open-Meteo.com · MET Norway
      </p>
    </div>
  );
}
