import { useWindData } from './hooks/useWindData';
import { useForecast } from './hooks/useForecast';
import { WindChart } from './components/WindChart';
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
import { useState, useMemo } from 'react';
import { WindRating } from './components/WindRating';
import { ErrorBoundary } from './components/ErrorBoundary';

// Add this interface at the top of the file, after the imports
interface WindData {
  time: Date;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  isForecast: boolean;
}

function App() {
  // **Initialize the state to start with the "Idag" view**
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

  const endDate = useMemo(() => {
    return endOfDay(currentDate);
  }, [currentDate]);

  const startDate = useMemo(() => {
    return startOfDay(subDays(currentDate, timeRange - 1));
  }, [currentDate, timeRange]);

  const { data: windData, loading: windLoading, error: windError, isEmpty } = useWindData({
    startDate,
    endDate,
  });
  const { data: forecastData, loading: forecastLoading, error: forecastError } = useForecast();

  const loading = windLoading || forecastLoading;
  const error = windError || forecastError;

  // **Processed Forecast Data for Chart and Listing**
  const processedForecastData = useMemo(() => {
    if (!forecastData) return [];

    const seenTimes = new Set<number>();

    try {
      let data = forecastData
        .filter(f => {
          // Strict input validation
          if (!f || typeof f !== 'object') return false;
          if (!f.validTime || typeof f.validTime !== 'string') return false;
          if (!Array.isArray(f.parameters)) return false;

          // Check for wind data
          const hasWindSpeed = f.parameters.some(
            p => p?.name === 'ws' && Array.isArray(p.values) && p.values.length > 0
          );
          const hasWindDirection = f.parameters.some(
            p => p?.name === 'wd' && Array.isArray(p.values) && p.values.length > 0
          );
          return hasWindSpeed && hasWindDirection;
        })
        .map(f => {
          const time = new Date(f.validTime);
          if (isNaN(time.getTime())) return null; // Explicit date check

          const windSpeed = f.parameters.find(p => p.name === 'ws')?.values[0];
          const windDirection = f.parameters.find(p => p.name === 'wd')?.values[0];

          if (typeof windSpeed !== 'number' || typeof windDirection !== 'number') return null;

          return {
            time,
            windSpeed,
            windDirection,
            windGust: windSpeed * 1.5,
            isForecast: true,
          };
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
  }, [forecastData, todayTimeWindow]);

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
      filteredData = processedWindData.filter(
        data => data.time >= todayTimeWindow.start && data.time <= todayTimeWindow.end
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
  }, [processedWindData, todayTimeWindow]);

  // **Grouped Forecast Data for Listing**
  const groupedForecastData = useMemo(() => {
    return processedForecastData.reduce((acc, data) => {
      if (data.time && !isNaN(data.time.getTime())) {
        const date = format(data.time, 'EEE d MMM', { locale: sv });
        if (!acc[date]) acc[date] = [];
        acc[date].push(data);
      }
      return acc;
    }, {} as Record<string, WindData[]>);
  }, [processedForecastData]);

  const groupedData = useMemo(() => {
    let data = processedWindData.map(d => ({
      ...d,
      isForecast: false
    }));
    if (todayTimeWindow) {
      data = data.filter(d => d.time >= todayTimeWindow.start && d.time <= todayTimeWindow.end);
    }
    return data.reduce((acc, data) => {
      if (data.time && !isNaN(data.time.getTime())) {
        const date = format(data.time, 'EEE d MMM', { locale: sv });
        if (!acc[date]) acc[date] = [];
        acc[date].push(data);
      }
      return acc;
    }, {} as Record<string, WindData[]>);
  }, [processedWindData, todayTimeWindow]);

  const loadMore = () => {
    setCurrentDate(prev => subDays(prev, timeRange));
    setTodayTimeWindow(null); // Reset the today time window
  };

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
    setCurrentDate(newDate);
    setShowOnlyForecast(false);
    setTodayTimeWindow(null); // Reset the today time window when changing dates
  };

  const handleTimeRangeChange = (newRange: number) => {
    const newDate = new Date();

    // Ensure we always start from today's date when changing the interval
    setCurrentDate(newDate);
    // Wait to update timeRange until after currentDate has been updated
    setTimeout(() => {
      setTimeRange(newRange);
      setTodayTimeWindow(null); // Reset the today time window
    }, 0);
  };

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

  const getDirectionArrow = (direction: number): string => {
    const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return directions[Math.round(((direction % 360) / 45)) % 8];
  };

  return (
    <div className="min-h-screen bg-pink-100 dark:bg-gray-900">
      <header className="bg-kallsjon-blue shadow mb-6">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-3xl font-bold text-white text-center">Surf i Kallsjön</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4">
        <div className="mb-4 flex items-center gap-4 justify-center">
          <button
            onClick={handlePrevious}
            className="px-4 py-2 bg-white dark:bg-gray-800 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={showOnlyForecast}
          >
            <span className="sr-only">Föregående</span>
            ←
          </button>

          <div className="mb-4">
            <input
              type="date"
              value={currentDate.toISOString().split('T')[0]}
              onChange={handleDateChange}
              className="rounded-md border-gray-300 shadow-sm p-2 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>

          <button
            onClick={handleNext}
            className="px-4 py-2 bg-white dark:bg-gray-800 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={loading || isToday(currentDate) || showOnlyForecast}
          >
            <span className="sr-only">Nästa</span>
            →
          </button>
        </div>
        {loading && (
          <div className="text-center py-4">
            <p className="text-gray-600">Laddar data...</p>
          </div>
        )}

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
                  className="px-4 py-2 bg-white rounded-md border shadow-sm hover:bg-gray-50"
                >
                  Idag
                </button>

                <button
                  onClick={handleForecastClick}
                  className={`px-4 py-2 rounded-md border shadow-sm hover:bg-gray-50 ${
                    showOnlyForecast ? 'bg-blue-100' : 'bg-white'
                  }`}
                >
                  Prognos
                </button>

                <select
                  value={timeRange}
                  onChange={e => handleTimeRangeChange(Number(e.target.value))}
                  className="rounded-md border-gray-300 shadow-sm p-2"
                >
                  <option value={1}>24 timmar</option>
                  <option value={2}>2 dagar</option>
                  <option value={3}>3 dagar</option>
                  <option value={7}>7 dagar</option>
                </select>
              </div>
            </div>
            {/* Listing for Observed and Forecast Data */}
            {showOnlyForecast ? (
              // **Forecast Data Listing**
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">Prognosvärden</h2>
                {Object.entries(groupedForecastData).map(([date, dayData]) => (
                  <div key={date} className="mb-6">
                    <h3 className="text-lg font-medium mb-2">{date}</h3>
                    <div className="space-y-2">
                      {dayData
                        .filter(data => data.time && !isNaN(data.time.getTime()))
                        .sort((a, b) => a.time.getTime() - b.time.getTime())
                        .map(data => {
                          let formattedTime = 'Okänt';
                          try {
                            formattedTime = format(data.time, 'HH:mm');
                          } catch {
                            console.error('Invalid date:', data.time);
                          }

                          return (
                            <div
                              key={data.time.getTime()}
                              className="flex items-center justify-between"
                            >
                              <span className="dark:text-white">{formattedTime}</span>
                              <span className="dark:text-white">
                                {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s
                                <span className="ml-2">
                                  {data.windDirection.toFixed(0)}° {getDirectionArrow(data.windDirection)}
                                </span>
                              </span>
                              <WindRating
                                avgWind={data.windSpeed}
                                gustWind={data.windGust}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : todayTimeWindow ? (
              <>
                {/* Observed Data Listing */}
                <div className="bg-white shadow rounded-lg p-4">
                  <h2 className="text-xl font-semibold mb-4">Observerade värden</h2>
                  {Object.entries(groupedData).map(([date, dayData]) => (
                    <div key={date} className="mb-6">
                      <h3 className="text-lg font-medium mb-2">{date}</h3>
                      <div className="space-y-2">
                        {dayData
                          .filter(data => data.time && !isNaN(data.time.getTime()))
                          .sort((a, b) => b.time.getTime() - a.time.getTime())
                          .map(data => {
                            let formattedTime = 'Okänt';
                            try {
                              formattedTime = format(data.time, 'HH:mm');
                            } catch {
                              console.error('Invalid date:', data.time);
                            }

                            return (
                              <div
                                key={data.time.getTime()}
                                className="flex items-center justify-between"
                              >
                                <span className="dark:text-white">{formattedTime}</span>
                                <span className="dark:text-white">
                                  {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s
                                  <span className="ml-2">
                                    {data.windDirection.toFixed(0)}° {getDirectionArrow(data.windDirection)}
                                  </span>
                                </span>
                                <WindRating
                                  avgWind={data.windSpeed}
                                  gustWind={data.windGust}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Forecast Data Listing */}
                <div className="bg-white shadow rounded-lg p-4 mt-4">
                  <h2 className="text-xl font-semibold mb-4">Prognosvärden</h2>
                  {Object.entries(groupedForecastData).map(([date, dayData]) => (
                    <div key={date} className="mb-6">
                      <h3 className="text-lg font-medium mb-2">{date}</h3>
                      <div className="space-y-2">
                        {dayData
                          .filter(data => data.time && !isNaN(data.time.getTime()))
                          .sort((a, b) => a.time.getTime() - b.time.getTime())
                          .map(data => {
                            let formattedTime = 'Okänt';
                            try {
                              formattedTime = format(data.time, 'HH:mm');
                            } catch {
                              console.error('Invalid date:', data.time);
                            }

                            return (
                              <div
                                key={data.time.getTime()}
                                className="flex items-center justify-between"
                              >
                                <span className="dark:text-white">{formattedTime}</span>
                                <span className="dark:text-white">
                                  {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s
                                  <span className="ml-2">
                                    {data.windDirection.toFixed(0)}° {getDirectionArrow(data.windDirection)}
                                  </span>
                                </span>
                                <WindRating
                                  avgWind={data.windSpeed}
                                  gustWind={data.windGust}
                                />
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // **Observed Data Listing**
              <div className="bg-white shadow rounded-lg p-4">
                <h2 className="text-xl font-semibold mb-4">Observerade värden</h2>
                {Object.entries(groupedData).map(([date, dayData]) => (
                  <div key={date} className="mb-6">
                    <h3 className="text-lg font-medium mb-2">{date}</h3>
                    <div className="space-y-2">
                      {dayData
                        .filter(data => data.time && !isNaN(data.time.getTime()))
                        .sort((a, b) => b.time.getTime() - a.time.getTime())
                        .map(data => {
                          let formattedTime = 'Okänt';
                          try {
                            formattedTime = format(data.time, 'HH:mm');
                          } catch {
                            console.error('Invalid date:', data.time);
                          }

                          return (
                            <div
                              key={data.time.getTime()}
                              className="flex items-center justify-between">
                              <span className="dark:text-white">{formattedTime}</span>
                              <span className="dark:text-white">
                                {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s
                                <span className="ml-2">
                                  {data.windDirection.toFixed(0)}° {getDirectionArrow(data.windDirection)}
                                </span>
                              </span>
                              <WindRating
                                avgWind={data.windSpeed}
                                gustWind={data.windGust}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !todayTimeWindow && (
          <button
            onClick={loadMore}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Ladda mer data
          </button>
        )}
      </main>
    </div>
  );
}

export default App;