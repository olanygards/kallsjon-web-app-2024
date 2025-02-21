import { useState } from 'react';
import { format } from 'date-fns';
import { WindData } from '../types/WindData';
import { WindRating } from './WindRating';

interface WindDataGroupProps {
  bestWind: WindData;
  hourData: WindData[];
  isForecast?: boolean;
}

export const WindDataGroup = ({ bestWind, hourData, isForecast = false }: WindDataGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hourLabel = format(bestWind.time, 'HH:00');

  // Function to get arrow direction
  const getDirectionArrow = (direction: number): string => {
    const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return directions[Math.round(((direction % 360) / 45)) % 8];
  };

  // Sorting Observations:
  // - Observed: Latest first (descending)
  // - Forecast: Oldest first (ascending)
  const sortedHourData = [...hourData].sort((a, b) =>
    isForecast ? a.time.getTime() - b.time.getTime() : b.time.getTime() - a.time.getTime()
  );

  return (
    <div className="mb-2">
      {/* Hour header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsExpanded(!isExpanded);
        }}
        aria-expanded={isExpanded}
        className={`w-full text-left p-3 rounded-lg transition-colors ${
          isForecast ? 'bg-gray-100 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{hourLabel}</span>
          <div className="flex items-center gap-4">
            <span>
              {bestWind.windSpeed.toFixed(1)} ({bestWind.windGust.toFixed(1)}) m/s
            </span>
            <span>{bestWind.windDirection}° {getDirectionArrow(bestWind.windDirection)}</span>
            <WindRating avgWind={bestWind.windSpeed} gustWind={bestWind.windGust} />
            <span
              className="transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▼
            </span>
          </div>
        </div>
      </button>

      {/* Expanded details with animation */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-6 mt-2 space-y-2">
          {sortedHourData.map((data) => (
            <div
              key={data.time.getTime()}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
            >
              <span className="text-sm">{format(data.time, 'HH:mm')}</span>
              <div className="flex items-center gap-4">
                <span>
                  {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s
                </span>
                <span>
                  {data.windDirection}° {getDirectionArrow(data.windDirection)}
                </span>
                <WindRating avgWind={data.windSpeed} gustWind={data.windGust} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 