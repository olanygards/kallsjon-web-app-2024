import { useState, useMemo, useEffect } from 'react';
import { format, startOfDay, endOfDay, parseISO, isValid } from 'date-fns';
import { sv } from 'date-fns/locale';
import { WindOverview } from '../components/WindOverview';
import { WindDetail } from '../components/WindDetail';
import { Header } from '../components/Header';
import { useWindData } from '../hooks/useWindData';
import WindMap from '../components/WindMap';

// Helper function to convert wind direction in degrees to cardinal direction
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Helper function to get a color based on wind speed
function getWindSpeedColor(speed: number): string {
  if (speed >= 18) return "bg-red-200 dark:bg-red-900 text-gray-900 dark:text-white";
  if (speed >= 15) return "bg-orange-200 dark:bg-orange-900 text-gray-900 dark:text-white";
  if (speed >= 12) return "bg-yellow-200 dark:bg-yellow-900 text-gray-900 dark:text-white";
  if (speed >= 10) return "bg-green-200 dark:bg-green-900 text-gray-900 dark:text-white";
  return "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white";
}

function Experiments() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [windDirectionStats, setWindDirectionStats] = useState<Record<string, any[]>>({});

  // For WindOverview, we need data from the last few months
  const overviewDateRange = useMemo(() => {
    const now = new Date();
    // Fetch historical data going back to 2020
    const range = {
      start: new Date(2020, 0, 1), // Start from January 1, 2020
      end: endOfDay(now)
    };
    return range;
  }, []);

  // For selected date view
  const dateRange = useMemo(() => {
    if (selectedDate) {
      return {
        start: startOfDay(selectedDate),
        end: endOfDay(selectedDate)
      };
    }
    return overviewDateRange;
  }, [selectedDate, overviewDateRange]);

  // Fetch data for overview - only observed data, filtered for wind >= 10 m/s
  const { 
    data: overviewWindData, 
    loading: overviewLoading, 
    error: overviewError 
  } = useWindData({
    startDate: overviewDateRange.start,
    endDate: overviewDateRange.end,
    minForce: 10 // Only get data with wind >= 10 m/s
  });

  // Process the data once it's loaded
  useEffect(() => {
    if (overviewWindData && overviewWindData.length > 0) {
      
      try {
        // Group by date to ensure we only have one entry per day
        const dateMap = new Map();
        // Track top days by direction
        const directionMap: Record<string, any[]> = {};
        
        // Sample a few items to debug
        const sampleItems = overviewWindData.slice(0, 5);
        console.log('Sample items for debugging:', sampleItems);
        
        overviewWindData.forEach(item => {
          // Skip items without time
          if (!item.time) return;
          
          // Ensure we have a proper Date object
          let date;
          try {
            // Handle different date formats
            if (item.time instanceof Date) {
              date = item.time;
            } else if (typeof item.time === 'string') {
              // Try parsing as ISO string
              date = parseISO(item.time);
              if (!isValid(date)) {
                // If not valid, try creating a new Date directly
                date = new Date(item.time);
              }
            } else if (typeof item.time === 'object' && item.time !== null && 'seconds' in item.time) {
              // Handle Firestore Timestamp objects
              date = new Date((item.time as any).seconds * 1000);
            } else {
              // Last resort
              date = new Date(item.time);
            }
            
            // Verify date is valid
            if (isNaN(date.getTime())) {
              console.warn('Invalid date created:', {
                original: item.time,
                attempted: date
              });
              return; // Skip this item
            }
          } catch (e) {
            console.error('Error creating date from:', item.time, e);
            return; // Skip this item
          }
          
          // Use date string as key (YYYY-MM-DD)
          const dateStr = format(date, 'yyyy-MM-dd');
          
          // If we haven't seen this date yet, or this entry has a higher wind speed
          // than what we've seen before, update the entry for this date
          if (!dateMap.has(dateStr) || 
              item.windSpeed > dateMap.get(dateStr).windSpeed) {
            const entry = {
              time: date,
              windSpeed: item.windSpeed,
              windGust: item.windGust || item.windSpeed,
              windDirection: item.windDirection,
              isForecast: false,
              dateStr // Keep the formatted date for easier reference
            };
            
            dateMap.set(dateStr, entry);
            
            // Add to direction stats
            if (item.windDirection !== undefined) {
              const direction = getWindDirection(item.windDirection);
              if (!directionMap[direction]) {
                directionMap[direction] = [];
              }
              
              // Add entry to direction map
              directionMap[direction].push(entry);
              
              // Keep top 5 for each direction
              directionMap[direction].sort((a, b) => b.windSpeed - a.windSpeed);
              if (directionMap[direction].length > 5) {
                directionMap[direction] = directionMap[direction].slice(0, 5);
              }
            }
          }
        });
        
        // Convert map to array
        const processedData = Array.from(dateMap.values());
        
        console.log('Processed data:', {
          totalDays: processedData.length,
          sample: processedData.length > 0 ? processedData[0] : null
        });
        
        setProcessedData(processedData);
        setWindDirectionStats(directionMap);
      } catch (err) {
        console.error('Error processing wind data:', err);
      }
    } else {
      console.log('No overview wind data available yet');
    }
  }, [overviewWindData, overviewLoading, overviewError]);

  // Fetch data for selected date - only observed data
  const { 
    data: windData, 
    loading: windLoading, 
    error: windError 
  } = useWindData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    minForce: 10 // Only get data with wind >= 10 m/s
  });

  const loading = selectedDate ? windLoading : overviewLoading;
  const error = selectedDate ? windError : overviewError;

  const handleDateSelect = (date: Date): void => {
    setSelectedDate(date);
  };

  const handleBack = (): void => {
    setSelectedDate(null);
  };

  // Memoize the wind data transformations for WindMap
  const transformedWindData = useMemo(() => 
    windData?.map(item => ({
      time: item.time instanceof Date ? format(item.time, 'HH:mm') : String(item.time),
      speed: item.windSpeed !== undefined ? item.windSpeed : 0,
      gust: item.windGust !== undefined ? item.windGust : 0,
      direction: item.windDirection !== undefined ? item.windDirection : 0
    })) ?? []
  , [windData]);

  // Get directions with data, sorted by the max wind speed in each direction
  const directionsWithData = useMemo(() => {
    return Object.entries(windDirectionStats)
      .sort((a, b) => {
        const aMax = Math.max(...a[1].map(item => item.windSpeed));
        const bMax = Math.max(...b[1].map(item => item.windSpeed));
        return bMax - aMax;
      });
  }, [windDirectionStats]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-screen-2xl">
        <div className="space-y-4">
          {selectedDate ? (
            <>
              <button
                onClick={handleBack}
                className="mb-4 text-kallsjon-green-dark hover:text-kallsjon-green-darker"
              >
                ← Tillbaka
              </button>
              
              <h2 className="text-xl font-semibold mb-4">
                {format(selectedDate, 'EEEE d MMMM', { locale: sv })}
              </h2>

              {loading ? (
                <div className="p-4 text-center">Laddar vinddata...</div>
              ) : error ? (
                <div className="p-4 text-center text-red-500">Kunde inte ladda vinddata</div>
              ) : transformedWindData.length > 0 ? (
                <>
                  <WindMap 
                    windData={transformedWindData}
                    forecastData={[]} // No forecast data in the Experiments page
                  />

                  <WindDetail 
                    selectedDate={selectedDate} 
                    onBack={handleBack}
                  />
                </>
              ) : (
                <div className="p-4 text-center">Ingen vinddata tillgänglig</div>
              )}
            </>
          ) : (
            <>
              {overviewLoading ? (
                <div className="p-4 text-center">Laddar vinddata...</div>
              ) : overviewError ? (
                <div className="p-4 text-center text-red-500">Kunde inte ladda vinddata</div>
              ) : (
                <>
                  {processedData.length > 0 ? (
                    <>
                      <WindOverview 
                        onDateSelect={handleDateSelect}
                        windData={processedData}
                      />
                      
                      {/* Top 5 Windy Days by Direction */}
                      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-8">
                        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                          Topp 5 Blåsiga Dagar efter Vindriktning
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {directionsWithData.map(([direction, days]) => (
                            <div key={direction} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-700 shadow-sm">
                              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white flex items-center justify-between">
                                <span>{direction}</span>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {days[0]?.windDirection?.toFixed(0)}°
                                </span>
                              </h3>
                              
                              <ul className="space-y-2">
                                {days.map((day, index) => (
                                  <li 
                                    key={index} 
                                    className={`p-2 rounded-md ${getWindSpeedColor(day.windSpeed)} cursor-pointer hover:brightness-95`}
                                    onClick={() => handleDateSelect(day.time)}
                                  >
                                    <div className="flex justify-between items-center">
                                      <span>{format(day.time, 'd MMM yyyy', { locale: sv })}</span>
                                      <span className="font-semibold">{day.windSpeed.toFixed(1)} m/s</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : (
                    <div className="p-4 text-center bg-white rounded-lg shadow">
                      Ingen data med stark vind (10+ m/s) hittades från 2020 till idag
                    </div>
                  )}
                  
                  <section className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-xl font-semibold mb-2">Kommande experiment</h2>
                    <p className="text-gray-600 text-sm">
                      Här kommer vi att lägga till fler experiment med olika sätt att visualisera vinddata.
                    </p>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Experiments; 