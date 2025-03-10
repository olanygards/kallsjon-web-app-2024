import { useState } from 'react';
import { format } from 'date-fns';
import { WindData } from '../types/WindData';
import { WindRating } from './WindRating';

interface WindDataGroupProps {
  bestWind: WindData;
  hourData: WindData[];
  isForecast?: boolean;
  hideDropdown?: boolean;
  initiallyExpanded?: boolean;
}

export const WindDataGroup = ({ 
  bestWind, 
  hourData,  
  hideDropdown = false,
  initiallyExpanded = false
}: WindDataGroupProps) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const hourLabel = format(bestWind.time, 'HH:00');

  // Function to get arrow direction
  const getDirectionArrow = (direction: number): string => {
    const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return directions[Math.round(((direction % 360) / 45)) % 8];
  };

  // Sort data by time descending (newest first)
  const sortedHourData = [...hourData].sort((a, b) => b.time.getTime() - a.time.getTime());
  
  // Remove the forced expansion for current hour
  // const isLatestHour = !isForecast && bestWind.time.getHours() === currentHour;
  
  // Determine if details should be shown - now only based on user interaction
  const showDetails = isExpanded;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartTime(Date.now());
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - touchStartTime;
    const touchDistance = Math.abs(touchEndY - touchStartY);

    // If the touch was short and didn't move much, consider it a tap
    if (touchDuration < 200 && touchDistance < 10) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="mb-2">
      {/* Expanded details - now with touch handlers */}
      {!hideDropdown && (
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden mb-2 ${
            showDetails ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            // Only handle click if it's not from scrolling
            if (e.detail === 1) {  // Single click only
              const target = e.target as HTMLElement;
              // Check if we're not clicking on a scrollable area
              if (!target.closest('.scrollable')) {
                setIsExpanded(false);
              }
            }
          }}
        >
          <div className="pl-6 space-y-2 scrollable">
            {sortedHourData.map((data) => (
              <div
                key={data.time.getTime()}
                className="flex items-center justify-between p-1 bg-white dark:bg-gray-800 rounded"
              >
                <div className="w-[50px] text-lg text-gray-900 dark:text-white">
                  {format(data.time, 'HH:mm')}
                </div>
                <div className="flex-[2] flex items-center justify-end gap-4">
                  <div className="flex flex-col items-center flex-[3]">
                    <div className="text-lg">
                      <span className="font-semibold">{data.windSpeed.toFixed(1)}</span>
                      <span className="text-gray-600 dark:text-gray-300"> ({data.windGust.toFixed(1)})</span>
                      <span className="text-[0.9rem] text-gray-600 dark:text-gray-300"> m/s</span>
                    </div>
                    <div className="mt-1">
                      <WindRating avgWind={data.windSpeed} gustWind={data.windGust} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 w-[55px]">
                    <span className="text-lg">{data.windDirection}°</span>
                    <span className="text-xl transform rotate-[270deg -90deg] inline-block">
                      {getDirectionArrow(data.windDirection)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hour header - always visible */}
      <div
        onClick={() => !hideDropdown && setIsExpanded(!isExpanded)}
        className={`p-2 rounded-lg cursor-pointer focus:outline-none ${
          bestWind.windSpeed >= 18
            ? 'bg-red-200 dark:bg-red-900'
            : bestWind.windSpeed >= 15
            ? 'bg-orange-200 dark:bg-orange-900'
            : bestWind.windSpeed >= 12
            ? 'bg-yellow-200 dark:bg-yellow-900'
            : bestWind.windSpeed >= 10
            ? 'bg-green-200 dark:bg-green-900'
            : 'bg-gray-100 dark:bg-gray-700'
        } hover:brightness-100`}
      >
        <div className="flex items-center">
          <div className="w-[70px] text-lg p-2 font-bold text-gray-900 dark:text-white">
            {hourLabel}
          </div>
          <div className="flex-[2] flex items-center justify-end gap-4">
            <div className="flex flex-col items-center flex-[3]">
              <div className="text-base">
                <span className="font-semibold">{bestWind.windSpeed.toFixed(1)}</span>
                <span className="text-gray-600 dark:text-gray-300 text-sm"> ({bestWind.windGust.toFixed(1)})</span>
                <span className="text-[0.8rem] text-gray-600 dark:text-gray-300"> m/s</span>
              </div>
              <div className="mt-1">
                <WindRating avgWind={bestWind.windSpeed} gustWind={bestWind.windGust} />
              </div>
            </div>
            <div className="flex items-center gap-1 w-[55px]">
              <span className="text-sm">{bestWind.windDirection}°</span>
              <span className="font-bold text-xl transform rotate-[270deg -90deg] inline-block">
                {getDirectionArrow(bestWind.windDirection)}
              </span>
            </div>
            {!hideDropdown && (
              <span
                className="transition-transform duration-200 w-[20px] text-gray-300"
                style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                ▼
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 