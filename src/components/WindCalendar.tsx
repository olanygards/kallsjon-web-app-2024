import { useWindCalendarDays } from '../hooks/useWindCalendarDays';
import { ForecastDataset } from '../types/WindData';
import { format, isSameDay } from 'date-fns';
import { sv } from 'date-fns/locale';

interface WindCalendarProps {
  forecastDatasets: ForecastDataset[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  daysToShow?: number;
  modelSpread?: Record<string, number>;
}

export function WindCalendar({
  forecastDatasets,
  selectedDate,
  onDateSelect,
  daysToShow = 10,
  modelSpread = {}
}: WindCalendarProps) {
  const windyDays = useWindCalendarDays(forecastDatasets, modelSpread, daysToShow);

  const handleKeyDown = (e: React.KeyboardEvent, date: Date) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDateSelect(date);
    }
  };

  if (windyDays.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <p className="text-gray-500 dark:text-gray-400">Ingen prognosdata tillgänglig</p>
      </div>
    );
  }

  return (
    <div 
      role="grid" 
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      aria-label="Vindkalender - välj dag för att se detaljerad prognos"
    >
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
        Dagar
      </h3>
      
      <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
        {windyDays.map((day) => {
          const isSelected = isSameDay(day.dateObj, selectedDate);
          const hasHighSpread = day.spread > 3;
          
          // Använd vit text på mörkare bakgrunder (allt utom grå)
          const isDarkBackground = day.color !== '#e5e7eb';
          const textColor = isDarkBackground ? 'text-white' : 'text-gray-900 dark:text-gray-100';

          return (
            <button
              key={day.date}
              role="gridcell"
              tabIndex={0}
              onClick={() => onDateSelect(day.dateObj)}
              onKeyDown={(e) => handleKeyDown(e, day.dateObj)}
              className={`
                relative flex flex-col items-center justify-center p-2 rounded-lg
                transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2
                ${isSelected 
                  ? 'ring-2 ring-kallsjon-green-dark ring-offset-2 scale-105' 
                  : 'hover:scale-105'
                }
              `}
              style={{
                backgroundColor: day.color,
                borderWidth: '2px',
                borderColor: isSelected ? '#005b2f' : day.color
              }}
              aria-label={`${day.label}, max byvind ${day.maxGust} m/s${hasHighSpread ? ', stor spridning mellan modeller' : ''}${day.modelCount > 1 ? `, ${day.modelCount} modeller` : ''}`}
            >
              {/* Dag */}
              <span className={`text-xs font-medium ${textColor}`}>
                {format(day.dateObj, 'EEE', { locale: sv })}
              </span>
              
              {/* Datum */}
              <span className={`text-sm font-bold ${textColor}`}>
                {format(day.dateObj, 'd', { locale: sv })}
              </span>

              {/* Vindstyrka: medel(max) */}
              <div className={`text-sm font-bold ${textColor} mt-1`}>
                {day.avgWind}
                <span className="text-xs">({day.maxGust})</span>
              </div>

              {/* Vindriktning med pil */}
              {day.windDirection !== null && (
                <div className={`flex items-center gap-1 text-xs ${textColor}`}>
                  <span>{Math.round(day.windDirection)}°</span>
                  <svg 
                    width="12" 
                    height="12" 
                    style={{ transform: `rotate(${day.windDirection + 180}deg)` }}
                  >
                    <line x1="6" y1="2" x2="6" y2="10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="6" y1="2" x2="3" y2="5" stroke="currentColor" strokeWidth="2"/>
                    <line x1="6" y1="2" x2="9" y2="5" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </div>
              )}

              {/* Tid för bästa vinden */}
              <span className={`text-xs ${textColor}`}>
                {day.peakTime}
              </span>

              {/* Spridnings-varning */}
              {hasHighSpread && (
                <span 
                  className="text-xs text-yellow-300 mt-1"
                  title={`Stor spridning mellan modeller: ${day.spread} m/s`}
                >
                  ⚠
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Visar max byvind per dag. Färg indikerar vindstyrka.
      </p>
    </div>
  );
}

