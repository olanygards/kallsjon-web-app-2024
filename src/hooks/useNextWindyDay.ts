import { useState, useEffect, useRef } from 'react';
import { addDays, subDays } from 'date-fns';
import { WindData } from '../types/WindData';
import { CONFIG } from '../config/constants';

interface UseNextWindyDayParams {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  loading: boolean;
  groupedByDate: Record<string, { best: WindData; records: WindData[] }[]>;
  groupedForecastData: Record<string, { best: WindData; records: WindData[] }>;
  onFound: () => void;
}

export function useNextWindyDay({
  currentDate,
  setCurrentDate,
  loading,
  groupedByDate,
  groupedForecastData,
  onFound
}: UseNextWindyDayParams) {
  const [searchingWindyDays, setSearchingWindyDays] = useState<{ direction: 'forward' | 'backward' } | null>(null);
  const searchAttemptsRef = useRef(0);

  const findNextWindyDate = (direction: 'forward' | 'backward') => {
    if (loading || searchingWindyDays) return;
    
    searchAttemptsRef.current = 0;
    setSearchingWindyDays({ direction });
  };

  useEffect(() => {
    if (!searchingWindyDays || loading) return;

    // Check if we have windy days in the current chunk
    const hasWindyDay = Object.entries(groupedByDate).some(([_, hourGroups]) =>
      hourGroups.some(group => group.best.windSpeed >= CONFIG.WIND_THRESHOLDS.GOOD)
    ) || Object.entries(groupedForecastData).some(([_, group]) =>
      group.best.windSpeed >= CONFIG.WIND_THRESHOLDS.GOOD
    );

    if (hasWindyDay) {
      // Found a windy day, we're already on it, just update the view
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      onFound();
      return;
    }

    // No windy days found in current chunk, try next chunk
    searchAttemptsRef.current += 1;
    if (searchAttemptsRef.current >= 10) { // Limit search to 10 chunks
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }

    // Calculate next chunk
    const nextDate = searchingWindyDays.direction === 'forward'
      ? addDays(currentDate, 1) // Try one day at a time
      : subDays(currentDate, 1);

    // Stop if we've gone too far
    const now = new Date();
    if (searchingWindyDays.direction === 'forward' && nextDate > addDays(now, 10)) {
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }
    if (searchingWindyDays.direction === 'backward' && nextDate < subDays(now, 30)) {
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }

    // Continue search with next chunk
    setCurrentDate(nextDate);
  }, [loading, groupedByDate, groupedForecastData, searchingWindyDays, currentDate, setCurrentDate, onFound]);

  return {
    searchingWindyDays,
    findNextWindyDate
  };
}

