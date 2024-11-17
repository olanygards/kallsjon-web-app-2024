import { useWindData } from './hooks/useWindData';
import { useForecast } from './hooks/useForecast';
import { WindChart } from './components/WindChart';
import { format, addDays, subDays, endOfDay, isToday, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { WindRating } from './components/WindRating';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [timeRange, setTimeRange] = useState(1);
  const [showForecast, setShowForecast] = useState(true);
  const [showOnlyForecast, setShowOnlyForecast] = useState(false);

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

  const processedForecastData = useMemo(() => {
    if (!forecastData) return [];

    const seenTimes = new Set<number>();
    
    try {
      return forecastData
        .filter(f => {
          // Striktare validering av indata
          if (!f || typeof f !== 'object') return false;
          if (!f.validTime || typeof f.validTime !== 'string') return false;
          if (!Array.isArray(f.parameters)) return false;
          
          // Kontrollera att vi har vinddata
          const hasWindSpeed = f.parameters.some(p => p?.name === 'ws' && Array.isArray(p.values) && p.values.length > 0);
          const hasWindDirection = f.parameters.some(p => p?.name === 'wd' && Array.isArray(p.values) && p.values.length > 0);
          return hasWindSpeed && hasWindDirection;
        })
        .map((f) => {
          const time = new Date(f.validTime);
          if (isNaN(time.getTime())) return null;  // Explicit kontroll av datum
          
          const windSpeed = f.parameters.find(p => p.name === 'ws')?.values[0];
          const windDirection = f.parameters.find(p => p.name === 'wd')?.values[0];
          
          if (typeof windSpeed !== 'number' || typeof windDirection !== 'number') return null;
          
          return {
            time,
            windSpeed,
            windDirection,
            windGust: windSpeed * 1.5,
            isForecast: true
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
    } catch (error) {
      console.error('Error processing forecast data:', error);
      return [];
    }
  }, [forecastData]);

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

  const groupedData = useMemo(() => {
    return processedWindData.reduce((acc, data) => {
      if (data.time && !isNaN(data.time.getTime())) {
        const date = format(data.time, 'EEE d MMM', { locale: sv });
        if (!acc[date]) acc[date] = [];
        acc[date].push(data);
      }
      return acc;
    }, {} as Record<string, typeof processedWindData>);
  }, [processedWindData]);

  const loadMore = () => {
    setCurrentDate(prev => subDays(prev, timeRange));
  };

  const handlePrevious = () => {
    if (loading) return;
    const newDate = subDays(currentDate, 1);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setShowForecast(false);
    }
  };

  const handleNext = () => {
    if (loading) return;
    const newDate = addDays(currentDate, 1);
    const today = new Date();
    if (!isNaN(newDate.getTime()) && newDate <= today) {
      setCurrentDate(newDate);
      setShowForecast(false);
    }
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    const today = new Date();
    
    if (!isNaN(newDate.getTime()) && newDate <= today) {
      setCurrentDate(newDate);
      setShowForecast(false);
    }
  };
  
  const minAvailableDate = useMemo(() => {
    if (!processedWindData.length) return new Date(0);
    return processedWindData.reduce((min, data) => 
      data.time.getTime() < min.getTime() ? data.time : min
    , processedWindData[0].time);
  }, [processedWindData]);

  const handleTimeRangeChange = (newRange: number) => {
    const newDate = new Date();
    
    // Säkerställ att vi alltid börjar från dagens datum när vi ändrar intervall
    setCurrentDate(newDate);
    // Vänta med att uppdatera timeRange tills efter currentDate har uppdaterats
    setTimeout(() => {
      setTimeRange(newRange);
    }, 0);
  };

  const handleTodayClick = () => {
    setCurrentDate(new Date());
    setShowForecast(true);
    setShowOnlyForecast(false);
  };

  const handleForecastClick = () => {
    setCurrentDate(new Date());
    setShowForecast(true);
    setShowOnlyForecast(true);
  };

  const getDirectionArrow = (direction: number): string => {
    const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    return directions[Math.round(((direction % 360) / 45)) % 8];
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow mb-6">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Surf i Kallsjön
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4">
        <div className="mb-4 flex items-center gap-4">
          <button 
            onClick={handlePrevious}
            className="px-4 py-2 bg-white rounded-md border shadow-sm hover:bg-gray-50"
          >
            <span className="sr-only">Föregående</span>
            ←
          </button>

          <button 
            onClick={handleTodayClick}
            className="px-4 py-2 bg-white rounded-md border shadow-sm hover:bg-gray-50"
          >
            Idag
          </button>

          <button 
            onClick={handleForecastClick}
            className={`px-4 py-2 rounded-md border shadow-sm hover:bg-gray-50 
              ${showOnlyForecast ? 'bg-blue-100' : 'bg-white'}`}
          >
            Prognos
          </button>

          <input
            type="date"
            value={format(currentDate, 'yyyy-MM-dd')}
            onChange={handleDateChange}
            max={format(new Date(), 'yyyy-MM-dd')}
            min={format(minAvailableDate, 'yyyy-MM-dd')}
            className="rounded-md border-gray-300 shadow-sm p-2"
          />

          <select
            value={timeRange}
            onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm p-2"
          >
            <option value={1}>24 timmar</option>
            <option value={2}>2 dagar</option>
            <option value={3}>3 dagar</option>
            <option value={7}>7 dagar</option>
          </select>

          <button 
            onClick={handleNext}
            className="px-4 py-2 bg-white rounded-md border shadow-sm hover:bg-gray-50"
            disabled={loading || isToday(currentDate)}
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
        
        {processedWindData && processedWindData.length > 0 && (
          <>
            <div className="mb-6">
              <ErrorBoundary>
                <WindChart 
                  windData={showOnlyForecast ? [] : processedWindData} 
                  forecastData={showForecast ? processedForecastData : []}
                  title={showOnlyForecast ? "Vindprognos" : "Vindstyrka - observerad och prognos"}
                  timeRange={timeRange} 
                />
              </ErrorBoundary>
            </div>
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">Observerade värden</h2>
              {Object.entries(groupedData).map(([date, dayData]) => (
                <div key={date} className="mb-6">
                  <h3 className="text-lg font-medium mb-2">{date}</h3>
                  <div className="space-y-2">
                    {dayData
                      .filter(data => data.time && !isNaN(data.time.getTime()))
                      .sort((a, b) => b.time.getTime() - a.time.getTime())
                      .map((data) => {
                        let formattedTime = 'Okänt';
                        try {
                          formattedTime = format(data.time, 'HH:mm');
                        } catch {
                          console.error('Ogiltigt datum:', data.time);
                        }

                        return (
                          <div key={data.time.getTime()} className="flex items-center justify-between">
                            <span>{formattedTime}</span>
                            <span>
                              {data.windSpeed.toFixed(1)} ({data.windGust.toFixed(1)}) m/s 
                              <span className="ml-2">
                                {data.windDirection}° {getDirectionArrow(data.windDirection)}
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
        )}
        {!loading && (
          <button
            onClick={loadMore}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Ladda mer data
          </button>
        )}
      </main>
    </div>
  );
}

export default App;