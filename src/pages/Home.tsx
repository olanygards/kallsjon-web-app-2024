import { useWindData } from '../hooks/useWindData';
import { useForecast } from '../hooks/useForecast';
import { WindChart } from '../components/WindChart';
import { PullToRefresh } from '../components/PullToRefresh';
import { WindDataGroup } from '../components/WindDataGroup';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import { CONFIG } from '../config/constants';
import {
  format,
  addDays,
  subDays,
  endOfDay,
  isToday,
  startOfDay,
  addMinutes,
  subHours,
  addHours,
  roundToNearestMinutes,
} from 'date-fns';
import { sv } from 'date-fns/locale';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { WindData } from '../types/WindData';

interface SmhiForecastData {
  validTime: string;
  parameters: Array<{
    name: string;
    values: number[];
  }>;
}

const KALLSJON_COORDINATES = {
  latitude: 63.3,
  longitude: 13.8
};

const getMoonInfo = (date: Date) => {
  const synmonth = 29.53058867;
  const reference = new Date("2000-01-06").getTime();
  const phase = ((date.getTime() - reference) % (synmonth * 86400000)) / (synmonth * 86400000);
  const percentage = Math.round(phase * 100);
  
  if (phase < 0.125) return { emoji: '🌑', percentage };
  if (phase < 0.25) return { emoji: '🌒', percentage };
  if (phase < 0.375) return { emoji: '🌓', percentage };
  if (phase < 0.625) return { emoji: '🌔', percentage };
  if (phase < 0.75) return { emoji: '🌕', percentage };
  if (phase < 0.875) return { emoji: '🌖', percentage };
  if (phase < 1) return { emoji: '🌗', percentage };
  return { emoji: '🌘', percentage };
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
  </div>
);

function Home() {
  // Initialize the state to start with the "Idag" view
  const now = new Date();
  const initialTodayTimeWindow = {
    start: subHours(now, 6), // 6 hours ago
    end: addHours(now, 16),  // 16 hours in the future
  };

  const [currentDate, setCurrentDate] = useState(now);
  const [timeRange, setTimeRange] = useState(1);
  const [showForecast, setShowForecast] = useState(true);
  const [showOnlyForecast, setShowOnlyForecast] = useState(false);
  const [todayTimeWindow, setTodayTimeWindow] = useState<{ start: Date; end: Date } | null>(initialTodayTimeWindow);
  const [searchingWindyDays, setSearchingWindyDays] = useState<{ direction: 'forward' | 'backward' } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchAttemptsRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate the date range for fetching wind data
  const windDataRange = useMemo(() => {
    const start = startOfDay(currentDate);
    const end = endOfDay(currentDate);
    return { start, end };
  }, [currentDate]);

  const { data: windData, loading: windLoading, error: windError, isEmpty } = useWindData({
    startDate: windDataRange.start,
    endDate: windDataRange.end,
  });
  const { data: forecastData, loading: forecastLoading, error: forecastError } = useForecast({
    startDate: windDataRange.start,
    endDate: windDataRange.end,
  });

  const loading = windLoading || forecastLoading;
  const error = windError || forecastError;

  // Processed Forecast Data for Chart and Listing
  const processedForecastData = useMemo(() => {
    if (!forecastData) return [];

    const seenTimes = new Set<number>();
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);

    try {
      let data = forecastData
        .filter(f => {
          if (!f || typeof f !== 'object') return false;
          if (!f.time || typeof f.time !== 'object') return false;
          if (typeof f.windSpeed !== 'number') return false;
          if (typeof f.windDirection !== 'number') return false;

          // Check time range
          const time = f.time;
          if (time < dayStart || time > dayEnd) return false;

          return true;
        })
        .filter((f): f is NonNullable<typeof f> => {
          if (!f || !f.time) return false;

          const timeStamp = f.time.getTime();
          if (seenTimes.has(timeStamp)) return false;
          seenTimes.add(timeStamp);

          return isToday(f.time) || f.time > new Date();
        })
        .sort((a, b) => a.time.getTime() - b.time.getTime());

      // Filter based on todayTimeWindow
      if (todayTimeWindow) {
        data = data.filter(f => f.time >= todayTimeWindow.start && f.time <= todayTimeWindow.end);
      }

      return data;
    } catch (error) {
      console.error('Error processing forecast data:', error);
      return [];
    }
  }, [forecastData, todayTimeWindow, currentDate]);

  const processedWindData = useMemo(() => {
    if (!windData) return [];

    const seenTimes = new Set<number>();

    return windData
      .filter(data => {
        if (!data?.time || isNaN(data.time.getTime())) return false;
        if (typeof data.windSpeed !== 'number') return false;
        if (typeof data.windDirection !== 'number') return false;
        if (typeof data.windGust !== 'number') return false;

        const timeStamp = data.time.getTime();
        if (seenTimes.has(timeStamp)) return false;
        seenTimes.add(timeStamp);

        return true;
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [windData]);

  // Aggregated Observed Data for the Chart (15-minute intervals)
  const aggregatedWindData = useMemo(() => {
    if (!processedWindData.length) return [];

    // Filter based on todayTimeWindow
    let filteredData = processedWindData;
    if (todayTimeWindow) {
      const startTime = todayTimeWindow.start.getTime();
      const endTime = todayTimeWindow.end.getTime();
      filteredData = processedWindData.filter(
        data => data.time.getTime() >= startTime && data.time.getTime() <= endTime
      );
    }

    if (!filteredData.length) return [];

    const aggregatedData = [];
    let currentIntervalStart = roundToNearestMinutes(filteredData[0].time, { nearestTo: 15 });
    let nextIntervalStart = addMinutes(currentIntervalStart, 15);
    let sumWindSpeed = 0;
    let sumWindGust = 0;
    let sumWindDirectionSin = 0;
    let sumWindDirectionCos = 0;
    let count = 0;

    filteredData.forEach(data => {
      while (data.time >= nextIntervalStart) {
        if (count > 0) {
          const avgWindDirection =
            (Math.atan2(sumWindDirectionSin / count, sumWindDirectionCos / count) * 180) / Math.PI;
          const adjustedWindDirection = (avgWindDirection + 360) % 360;

          aggregatedData.push({
            time: currentIntervalStart,
            windSpeed: sumWindSpeed / count,
            windGust: sumWindGust / count,
            windDirection: adjustedWindDirection,
            isForecast: false,
          });
        }
        // Move to the next interval
        currentIntervalStart = nextIntervalStart;
        nextIntervalStart = addMinutes(currentIntervalStart, 15);
        sumWindSpeed = 0;
        sumWindGust = 0;
        sumWindDirectionSin = 0;
        sumWindDirectionCos = 0;
        count = 0;
      }

      sumWindSpeed += data.windSpeed;
      sumWindGust += data.windGust;
      // Convert wind direction to radians for averaging
      const windDirRadians = (data.windDirection * Math.PI) / 180;
      sumWindDirectionSin += Math.sin(windDirRadians);
      sumWindDirectionCos += Math.cos(windDirRadians);
      count += 1;
    });

    // Add the last aggregated data point
    if (count > 0) {
      const avgWindDirection =
        (Math.atan2(sumWindDirectionSin / count, sumWindDirectionCos / count) * 180) / Math.PI;
      const adjustedWindDirection = (avgWindDirection + 360) % 360;

      aggregatedData.push({
        time: currentIntervalStart,
        windSpeed: sumWindSpeed / count,
        windGust: sumWindGust / count,
        windDirection: adjustedWindDirection,
        isForecast: false,
      });
    }

    return aggregatedData;
  }, [processedWindData, todayTimeWindow?.start?.getTime(), todayTimeWindow?.end?.getTime()]);

  const handlePrevious = () => {
    if (loading) return;
    const newDate = subDays(currentDate, 1);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setShowForecast(false);
      setTodayTimeWindow(null); // Reset the today time window
    }
  };

  const handleNext = () => {
    if (loading) return;
    const newDate = addDays(currentDate, 1);
    const today = new Date();
    if (!isNaN(newDate.getTime()) && newDate <= today) {
      setCurrentDate(newDate);
      setShowForecast(false);
      setTodayTimeWindow(null); // Reset the today time window
    }
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setShowOnlyForecast(false);
      setTodayTimeWindow(null);
    }
  };

  const handleTimeRangeChange = useCallback((newRange: number) => {
    setTimeRange(newRange);
    setTodayTimeWindow(null); 
  }, []);

  const handleTodayClick = () => {
    const now = new Date();
    const start = subHours(now, 6); // 6 hours ago
    const end = addHours(now, 16); // 16 hours in the future
    setTodayTimeWindow({ start, end });
    setCurrentDate(now);
    setShowForecast(true);
    setShowOnlyForecast(false);
  };

  const handleForecastClick = () => {
    setCurrentDate(new Date());
    setShowForecast(true);
    setShowOnlyForecast(true);
    setTodayTimeWindow(null); // Reset the today time window
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Reset to current time
    const now = new Date();
    setCurrentDate(now);
    if (todayTimeWindow) {
      setTodayTimeWindow({
        start: subHours(now, 6),
        end: addHours(now, 16),
      });
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Group wind data by hour
  const groupedWindData = useMemo(() => {
    if (!processedWindData.length) return {};
    
    return processedWindData.reduce((groups, item) => {
      const hourKey = format(item.time, 'yyyy-MM-dd HH:00');
      if (!groups[hourKey]) groups[hourKey] = { best: item, records: [] };

      groups[hourKey].records.push(item);
      if (item.windSpeed > groups[hourKey].best.windSpeed) {
        groups[hourKey].best = item;
      }

      return groups;
    }, {} as Record<string, { best: WindData; records: WindData[] }>);
  }, [processedWindData]);

  const groupedByDate = useMemo(() => {
    const result: Record<string, { best: WindData; records: WindData[] }[]> = {};
    Object.entries(groupedWindData).forEach(([hourKey, group]) => {
      // Extract the date portion from the hourKey (first 10 characters for yyyy-MM-dd)
      const dateKey = hourKey.substring(0, 10);
      if (!result[dateKey]) {
        result[dateKey] = [];
      }
      result[dateKey].push(group);
    });
    return result;
  }, [groupedWindData]);

  const groupedForecastData = useMemo(() => {
    if (!processedForecastData.length) return {};
    
    return processedForecastData.reduce((groups, item) => {
      const hourKey = format(item.time, 'yyyy-MM-dd HH:00');
      if (!groups[hourKey]) groups[hourKey] = { best: item, records: [] };

      groups[hourKey].records.push(item);
      if (item.windSpeed > groups[hourKey].best.windSpeed) {
        groups[hourKey].best = item;
      }

      return groups;
    }, {} as Record<string, { best: WindData; records: WindData[] }>);
  }, [processedForecastData]);

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
      setTimeRange(1); // Set to 24 hours view
      setShowForecast(true);
      setShowOnlyForecast(false);
      setTodayTimeWindow(null); // Reset today window to show full 24h
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }

    // No windy days found in current chunk, try next chunk
    searchAttemptsRef.current += 1;
    if (searchAttemptsRef.current >= 10) { // Limit search to 10 chunks
      console.log('Reached maximum search attempts');
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
      console.log('Reached maximum future date');
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }
    if (searchingWindyDays.direction === 'backward' && nextDate < subDays(now, 30)) {
      console.log('Reached maximum past date');
      setSearchingWindyDays(null);
      searchAttemptsRef.current = 0;
      return;
    }

    // Continue search with next chunk
    setCurrentDate(nextDate);
  }, [loading, groupedByDate, groupedForecastData, searchingWindyDays, currentDate]);

  const findNextWindyDate = (direction: 'forward' | 'backward') => {
    if (loading || searchingWindyDays) return;
    
    searchAttemptsRef.current = 0;
    setSearchingWindyDays({ direction });
  };

  return (
    <div className="min-h-screen bg-kallsjon-green dark:bg-gray-900">
      <PullToRefresh onRefresh={handleRefresh}>
        <header className="bg-kallsjon-blue shadow mb-6">
          <div className="max-w-7xl mx-auto py-4 px-4">
            <h1 className="text-3xl font-bold text-white text-center">Surf i Kallsjön</h1>
          </div>
        </header>
      </PullToRefresh>
      
      <main className="max-w-7xl mx-auto px-4">
        <div className="mb-4 flex items-center gap-2 justify-center">
          <button
            onClick={() => findNextWindyDate('backward')}
            aria-label="Föregående blåsiga dag"
            className="px-3 py-2 bg-gray-300 text-black dark:bg-gray-700 rounded-md border shadow-sm hover:bg-blue-600 dark:hover:bg-blue-800"
            disabled={loading}
          >
            <span className="sr-only">Föregående blåsiga</span>
            ⟪
          </button>

          <button
            onClick={handlePrevious}
            aria-label="Föregående dag"
            className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
            disabled={showOnlyForecast}
          >
            <span className="sr-only">Föregående</span>
            ←
          </button>

          <div className="relative inline-block">
            <input
              type="date"
              aria-label="Välj datum"
              value={currentDate.toISOString().split('T')[0]}
              onChange={handleDateChange}
              className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 appearance-none text-base pr-8"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 2h8v12H6V4zm2 3a1 1 0 100 2h4a1 1 0 100-2H8z" />
              </svg>
            </div>
          </div>

          <button
            onClick={handleNext}
            className="px-3 py-2 bg-white dark:bg-gray-800 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading || isToday(currentDate) || showOnlyForecast}
          >
            <span className="sr-only">Nästa</span>
            →
          </button>

          <button
            onClick={() => findNextWindyDate('forward')}
            aria-label="Nästa blåsiga dag"
            className="px-3 py-2 bg-gray-300 text-black dark:bg-blue-700 rounded-md border shadow-sm hover:bg-blue-600 dark:hover:bg-blue-800"
            disabled={loading}
          >
            <span className="sr-only">Nästa blåsiga</span>
            ⟫
          </button>
        </div>
        {loading && <LoadingSpinner />}

        {!loading && error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg">
            Ett fel uppstod: {error.message}
          </div>
        )}

        {!loading && isEmpty && (
          <div className="bg-yellow-50 text-yellow-600 p-4 rounded-lg mb-4">
            Ingen data tillgänglig för valt datum
          </div>
        )}

        {(aggregatedWindData.length > 0 || processedForecastData.length > 0) && (
          <>
            <div className="mb-6">
              <ErrorBoundary>
                <WindChart
                  windData={showOnlyForecast ? [] : aggregatedWindData}
                  forecastData={showForecast ? processedForecastData : []}
                  title={
                    showOnlyForecast
                      ? 'Vindprognos'
                      : 'Vindstyrka - observerad och prognos'
                  }
                  timeRange={timeRange}
                />
              </ErrorBoundary>

              <div className="mt-4 flex items-center gap-4 justify-center">
                <button
                  onClick={handleTodayClick}
                  className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Idag
                </button>

                <button
                  onClick={handleForecastClick}
                  className={`px-4 py-2 rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 ${
                    showOnlyForecast 
                      ? 'bg-blue-100 dark:bg-blue-900 text-gray-900 dark:text-white' 
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  Prognos
                </button>

                <div className="relative inline-block">
                  <select
                    value={timeRange}
                    onChange={e => handleTimeRangeChange(Number(e.target.value))}
                    className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 appearance-none pr-8 text-base"
                  >
                    <option value={1}>24 timmar</option>
                    <option value={2}>2 dagar</option>
                    <option value={3}>3 dagar</option>
                    <option value={7}>7 dagar</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            {/* Listing for Observed and Forecast Data */}
            {!loading && !showOnlyForecast && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Observerade värden
                </h2>
                {Object.entries(groupedByDate)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([dateKey, hourGroups]) => (
                    <div key={dateKey} className="mb-6">
                      <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                        {format(new Date(dateKey), 'EEE d MMM', { locale: sv })}
                        <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                          ☀ {format(getSunrise(KALLSJON_COORDINATES.latitude, KALLSJON_COORDINATES.longitude, new Date(dateKey)), 'HH:mm')}
                          {' '} {' '} 
                          ☽ {format(getSunset(KALLSJON_COORDINATES.latitude, KALLSJON_COORDINATES.longitude, new Date(dateKey)), 'HH:mm')}
                          {' '} {' '}
                          {getMoonInfo(new Date(dateKey)).emoji} {getMoonInfo(new Date(dateKey)).percentage}%
                        </span>
                      </h3>
                      {hourGroups
                        .sort((a, b) => b.best.time.getTime() - a.best.time.getTime())
                        .map(({ best, records }) => (
                          <WindDataGroup
                            key={best.time.getTime()}
                            bestWind={best}
                            hourData={records.sort((a, b) => b.time.getTime() - a.time.getTime())}
                            isForecast={false}
                          />
                        ))}
                    </div>
                  ))}
              </div>
            )}

            {!loading && (showForecast || showOnlyForecast) && (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Prognosvärden
                </h2>
                {Object.entries(groupedForecastData)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([hourKey, { best, records }]) => (
                    <WindDataGroup
                      key={hourKey}
                      bestWind={best}
                      hourData={records}
                      isForecast={true}
                    />
                  ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Home; 