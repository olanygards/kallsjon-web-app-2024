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
import { Header } from '../components/Header';

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

function ChartView() {
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
  const searchAttemptsRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Processed Wind Data
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
    if (loading) return;
    const newDate = new Date(event.target.value);
    const today = new Date();
    if (!isNaN(newDate.getTime()) && newDate <= today) {
      setCurrentDate(newDate);
      setShowForecast(false);
      setTodayTimeWindow(null); // Reset the today time window when changing date
    }
  };

  const handleTodayClick = () => {
    if (loading) return;
    setCurrentDate(new Date());
    setShowForecast(true);
    setTodayTimeWindow(initialTodayTimeWindow);
  };

  const handleForecastClick = () => {
    if (loading) return;
    setShowForecast(!showForecast);
  };

  const handleRefresh = async () => {
    // Force a refresh by updating the key
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Graf vy" />
      
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="max-w-7xl mx-auto px-4 py-6 w-full">
          <div className="mb-6 bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                <button
                  onClick={handlePrevious}
                  disabled={loading}
                  className="p-2 bg-kallsjon-green rounded-full shadow text-white disabled:opacity-50"
                >
                  &lt;
                </button>
                <h2 className="text-xl font-bold">
                  {format(currentDate, 'EEEE d MMMM', { locale: sv })}
                </h2>
                <button
                  onClick={handleNext}
                  disabled={loading || (isToday(currentDate) && !searchingWindyDays)}
                  className="p-2 bg-kallsjon-green rounded-full shadow text-white disabled:opacity-50"
                >
                  &gt;
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleTodayClick}
                  className={`px-3 py-1 text-sm rounded-md ${
                    isToday(currentDate)
                      ? 'bg-kallsjon-green text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Idag
                </button>
                
                <input
                  type="date"
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={handleDateChange}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  className="px-3 py-1 text-sm bg-gray-100 rounded-md border border-gray-300"
                />
                
                <button
                  onClick={handleForecastClick}
                  disabled={!isToday(currentDate)}
                  className={`px-3 py-1 text-sm rounded-md ${
                    showForecast && isToday(currentDate)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'
                  }`}
                >
                  Prognos
                </button>
              </div>
            </div>
            
            <ErrorBoundary fallback={<div>Error loading chart</div>}>
              <div className="h-[450px]">
                {loading ? (
                  <LoadingSpinner />
                ) : error ? (
                  <div className="flex justify-center items-center h-full">
                    <p className="text-red-500">Error: {error.message}</p>
                  </div>
                ) : (
                  <WindChart
                    windData={aggregatedWindData}
                    forecastData={showForecast ? processedForecastData : []}
                    title="Vindstyrka"
                    timeRange={timeRange}
                    zoomEnabled={true}
                    variant="default"
                  />
                )}
              </div>
            </ErrorBoundary>
          </div>
        </main>
      </PullToRefresh>
    </div>
  );
}

export default ChartView; 