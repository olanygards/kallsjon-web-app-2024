import { useState, useMemo } from 'react';
import { format, addDays, subDays, startOfDay, endOfDay} from 'date-fns';
import { sv } from 'date-fns/locale';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import WindMap from '../components/WindMap';
import { useWindData } from '../hooks/useWindData';
import { useForecast } from '../hooks/useForecast';
import { useWindyDays } from '../hooks/useWindyDays';
import { Header } from '../components/Header';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './date-picker-custom.css';
import { WindDataGroup } from '../components/WindDataGroup';
import { WindRating } from '../components/WindRating';

// Helper function to get direction arrow based on wind direction
const getDirectionArrow = (direction: number): string => {
  if (direction < 22.5 || direction >= 337.5) return "↓";
  if (direction >= 22.5 && direction < 67.5) return "↙";
  if (direction >= 67.5 && direction < 112.5) return "←";
  if (direction >= 112.5 && direction < 157.5) return "↖";
  if (direction >= 157.5 && direction < 202.5) return "↑";
  if (direction >= 202.5 && direction < 247.5) return "↗";
  if (direction >= 247.5 && direction < 292.5) return "→";
  return "↘";
};

function DailyView() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showForecast, setShowForecast] = useState(true);
  
  // Current year for windy days highlighting
  const currentYear = useMemo(() => currentDate.getFullYear(), [currentDate]);
  
  // Fetch days with strong wind (over 10 m/s)
  const { windSpeedMap } = useWindyDays({ 
    minForce: 10,
    year: currentYear
  });
  
  // Memoize date range to prevent unnecessary recalculations
  const dateRange = useMemo(() => ({
    start: startOfDay(currentDate),
    end: endOfDay(currentDate)
  }), [currentDate]);
  
  const { data: windData, loading: windLoading, error: windError } = useWindData({
    startDate: dateRange.start,
    endDate: dateRange.end,
    minForce: 0 // Explicitly set to 0 to get ALL wind data, regardless of wind speed
  });

  const { data: forecastData, loading: forecastLoading, error: forecastError } = useForecast({
    startDate: dateRange.start,
    endDate: dateRange.end
  });

  const loading = windLoading || forecastLoading;
  const error = windError || forecastError;

  // Kallsjön coordinates (approximate)
  const KALLSJON_LAT = 63.4;
  const KALLSJON_LNG = 13.2;
  const KALLSJON_COORDINATES = { latitude: KALLSJON_LAT, longitude: KALLSJON_LNG };

  // Calculate sun and moon information
  const sunMoonInfo = useMemo(() => {
    // Get sunrise and sunset times
    const sunrise = getSunrise(KALLSJON_LAT, KALLSJON_LNG, currentDate);
    const sunset = getSunset(KALLSJON_LAT, KALLSJON_LNG, currentDate);
    
    // Format times
    const sunriseTime = format(sunrise, 'HH:mm');
    const sunsetTime = format(sunset, 'HH:mm');
    
    // Calculate moon phase (simplified)
    // This is a simple approximation - for more accuracy, consider a specialized library
    const moonPhase = calculateMoonPhase(currentDate);
    
    return {
      sunriseTime,
      sunsetTime,
      moonPhase
    };
  }, [currentDate]);

  // Simple moon phase calculation (0-100%)
  function calculateMoonPhase(date: Date) {
    // Moon cycle is approximately 29.53 days
    const LUNAR_CYCLE = 29.53;
    
    // New moon reference date (you can update this to a recent new moon)
    const NEW_MOON_REFERENCE = new Date('2024-01-11T00:00:00Z');
    
    // Calculate days since reference new moon
    const daysSinceNewMoon = (date.getTime() - NEW_MOON_REFERENCE.getTime()) / (1000 * 60 * 60 * 24);
    
    // Calculate current phase (0 to 1)
    const phase = (daysSinceNewMoon % LUNAR_CYCLE) / LUNAR_CYCLE;
    
    // Convert to percentage
    const percentage = Math.round(phase * 100);
    
    // Determine moon emoji based on phase
    let moonEmoji = '🌑'; // new moon
    if (percentage < 5 || percentage > 95) moonEmoji = '🌑';
    else if (percentage < 20) moonEmoji = '🌒';
    else if (percentage < 30) moonEmoji = '🌓';
    else if (percentage < 45) moonEmoji = '🌔';
    else if (percentage < 55) moonEmoji = '🌕'; // full moon
    else if (percentage < 70) moonEmoji = '🌖';
    else if (percentage < 80) moonEmoji = '🌗';
    else if (percentage < 95) moonEmoji = '🌘';
    
    return {
      percentage,
      emoji: moonEmoji
    };
  }

  const handleDateChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentDate(prev => subDays(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, 1));
    }
  };

  const handleDateSelect = (date: Date | null) => {
    if (date) {
      setCurrentDate(date);
      setSelectedDate(date);
    }
    setIsDatePickerOpen(false);
  };

  const findMaxWindData = (data: any[], forecastData: any[] = []) => {
    if ((!data || data.length === 0) && (!forecastData || forecastData.length === 0)) return null;
    
    let maxEntry = null;
    let maxSpeed = -1;
    
    // Check observed data
    for (let i = 0; i < (data?.length || 0); i++) {
      const entry = data[i];
      if (!entry) continue;
      
      const speed = entry.windSpeed !== undefined ? entry.windSpeed : 
                   (entry.speed !== undefined ? entry.speed : 0);
      
      if (speed > maxSpeed) {
        maxSpeed = speed;
        maxEntry = { ...entry, isForecast: false };
      }
    }
    
    // Check forecast data
    for (let i = 0; i < (forecastData?.length || 0); i++) {
      const entry = forecastData[i];
      if (!entry) continue;
      
      const speed = entry.windSpeed !== undefined ? entry.windSpeed : 
                   (entry.speed !== undefined ? entry.speed : 0);
      
      if (speed > maxSpeed) {
        maxSpeed = speed;
        maxEntry = { ...entry, isForecast: true };
      }
    }
    
    return maxEntry;
  };

  // Simplify forecast data grouping
  const groupedForecastData = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    
    // Sort forecast data by time
    return [...forecastData].sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [forecastData]);

  // Group data by date for observed data
  const groupedByDate = useMemo(() => {
    if (!windData || windData.length === 0) return {};
    
    const grouped: Record<string, { best: any; records: any[] }[]> = {};
    
    // First group by date
    windData.forEach(item => {
      if (!item || !item.time) return;
      
      const dateKey = format(item.time, 'yyyy-MM-dd');
      const hourKey = format(item.time, 'HH');
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      // Find if hour group exists
      let hourGroup = grouped[dateKey].find(g => format(g.best.time, 'HH') === hourKey);
      
      if (!hourGroup) {
        hourGroup = {
          best: item,
          records: [item]
        };
        grouped[dateKey].push(hourGroup);
      } else {
        hourGroup.records.push(item);
        // Update best if this item has higher wind speed
        if (item.windSpeed > hourGroup.best.windSpeed) {
          hourGroup.best = item;
        }
      }
    });
    
    return grouped;
  }, [windData]);

  // Add a function to check if a time is in the current hour of today
  const isCurrentHour = (time: Date): boolean => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const selectedDay = format(currentDate, 'yyyy-MM-dd');
    const timeDate = format(time, 'yyyy-MM-dd');
    const currentHour = now.getHours();
    const timeHour = time.getHours();
    
    // Only expand if we're viewing today's date AND the hour matches current hour
    return today === selectedDay && today === timeDate && currentHour === timeHour;
  };



  // Function to get class name for date cell based on wind speed
  const getDayClassName = (date: Date): string => {
    if (!date) return '';
    
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!windSpeedMap.has(dateStr)) return '';
    
    const speed = windSpeedMap.get(dateStr) || 0;
    let className = 'text-white rounded-full font-medium ';
    
    // Add appropriate color class based on wind speed
    if (speed >= 16.0) className += 'bg-[#a02109]';
    else if (speed >= 14.0) className += 'bg-[#005b2f]';
    else if (speed >= 12.0) className += 'bg-[#388957]';
    else if (speed >= 11.0) className += 'bg-[#9bb798]';
    else if (speed >= 10.0) className += 'bg-[#b7d4b4]';
    
    return className;
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-[640px]">
        <div className="overflow-hidden">
          {/* Date selector */}
          <div className="px-3 flex justify-between items-center">
            <button 
              onClick={() => handleDateChange('prev')}
              className="text-kallsjon-green font-bold rounded-full bg-kallsjon-lt-green-light py-3"
            >
              &lt;
            </button>
            <button 
              onClick={() => setIsDatePickerOpen(true)}
              className="text-center font-bold"
            >
              {format(currentDate, 'EEEE d MMMM', { locale: sv })}
            </button>
            <button 
              onClick={() => handleDateChange('next')}
              className="text-kallsjon-green font-bold rounded-full bg-kallsjon-lt-green-light py-3"
            >
              &gt;
            </button>
          </div>
          
          {/* Dynamic sun and moon information - now centered */}
          <div className="text-center w-full mb-3 mt-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 inline-block">
              <span className="px-2">☀ {sunMoonInfo.sunriseTime} </span>
              <span className="px-2">☽ {sunMoonInfo.sunsetTime} </span>
              <span className="px-2">{sunMoonInfo.moonPhase.emoji} {sunMoonInfo.moonPhase.percentage}%</span>
            </span>
          </div>

          {/* Date Picker Modal */}
          {isDatePickerOpen && (
            <div className="fixed inset-0 z-50">
              {/* Semi-transparent overlay for the background */}
              <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setIsDatePickerOpen(false)}></div>
              
              {/* Position date picker near the date display */}
              <div 
                className="absolute p-4 rounded-lg shadow-lg custom-datepicker-container"
                style={{ 
                  top: '40px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  maxWidth: '90%',
                  width: '395px',
                  backgroundColor: '#eaf5eb',
                  borderRadius: '12px',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.15)'
                }}
              >
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  inline
                  locale={sv}
                  minDate={new Date('2020-01-01')}
                  maxDate={addDays(new Date(), 8)}
                  dayClassName={getDayClassName}
                  wrapperClassName="custom-datepicker-wrapper"
                  calendarClassName="custom-calendar"
                />
                
                {/* Add a simple legend with improved styling */}
                <div className="mt-3 text-xs text-center p-2 bg-white bg-opacity-80 rounded-md">
                  <p className="text-xs mb-1 font-medium text-kallsjon-green-dark">Vindstyrka:</p>
                  <div className="flex flex-wrap justify-center gap-2 mb-1">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-1 bg-[#b7d4b4]"></div>
                      <span className="text-xs">10-11 m/s</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-1 bg-[#388957]"></div>
                      <span className="text-xs">12-13 m/s</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-1 bg-[#005b2f]"></div>
                      <span className="text-xs text-[#005b2f] font-medium">14-15 m/s</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full mr-1 bg-[#a02109]"></div>
                      <span className="text-xs text-[#a02109] font-medium">16+ m/s</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center mt-3">
                  <button
                    onClick={() => setIsDatePickerOpen(false)}
                    className="bg-kallsjon-green text-white px-4 py-2 rounded font-medium"
                  >
                    Stäng
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Best wind of the day */}
          <div className="mb-2 mx-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(218 244 230)' }}>
              <div className="flex items-center">
                <div className="w-[90px] text-lg p-2 font-bold text-green-900">
                  <div className="text-xs text-green-800">Bäst vind</div>
                  {(() => {
                    const maxEntry = findMaxWindData(windData || [], forecastData || []);
                    if (!maxEntry) return "--:--";
                    
                    if (maxEntry.time instanceof Date) {
                      return format(maxEntry.time, 'HH:mm') + (maxEntry.isForecast ? '*' : '');
                    } else {
                      return (maxEntry.time || "--:--") + (maxEntry.isForecast ? '*' : '');
                    }
                  })()}
                </div>
                <div className="flex-[2] flex items-center justify-end gap-10">
                  <div className="flex flex-col items-center flex-[3]">
                    <div className="text-base">
                      {(() => {
                        const maxEntry = findMaxWindData(windData || [], forecastData || []);
                        if (!maxEntry) return <span className="font-semibold">-- (--) m/s</span>;
                        
                        const speed = maxEntry.windSpeed !== undefined ? maxEntry.windSpeed : 
                                     (maxEntry.speed !== undefined ? maxEntry.speed : 0);
                        
                        const gust = maxEntry.windGust !== undefined ? maxEntry.windGust :
                                    (maxEntry.gustSpeed !== undefined ? maxEntry.gustSpeed :
                                    (maxEntry.gust !== undefined ? maxEntry.gust : speed * 1.5));
                        
                        return (
                          <>
                            <span className="font-semibold">{speed.toFixed(1)}</span>
                            <span className="text-green-800 text-sm"> ({gust.toFixed(1)})</span>
                            <span className="text-[0.8rem] text-green-800"> m/s</span>
                          </>
                        );
                      })()}
                    </div>
                    <div className="mt-1">
                      {(() => {
                        const maxEntry = findMaxWindData(windData || [], forecastData || []);
                        if (!maxEntry) return null;
                        
                        const speed = maxEntry.windSpeed !== undefined ? maxEntry.windSpeed : 
                                     (maxEntry.speed !== undefined ? maxEntry.speed : 0);
                        
                        const gust = maxEntry.windGust !== undefined ? maxEntry.windGust :
                                    (maxEntry.gustSpeed !== undefined ? maxEntry.gustSpeed :
                                    (maxEntry.gust !== undefined ? maxEntry.gust : speed * 1.5));
                        
                        return <WindRating avgWind={speed} gustWind={gust} />;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 w-[55px]">
                    {(() => {
                      const maxEntry = findMaxWindData(windData || [], forecastData || []);
                      if (!maxEntry) return <span className="text-sm">--°</span>;
                      
                      const direction = maxEntry.direction !== undefined ? maxEntry.direction : 
                                       (maxEntry.windDirection !== undefined ? maxEntry.windDirection : 0);
                      
                      return (
                        <>
                          <span className="text-sm">{direction}°</span>
                          <span className="font-bold text-xl transform rotate-[270deg -90deg] inline-block">
                            {getDirectionArrow(direction)}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Wind map */}
          {loading ? (
            <div className="p-4 text-center">Laddar vinddata...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">Kunde inte ladda vinddata</div>
          ) : (windData?.length > 0 || forecastData?.length > 0) ? (
            <WindMap 
              windData={windData?.map(item => {
                return {
                  time: item.time instanceof Date ? format(item.time, 'HH:mm') : String(item.time),
                  speed: item.windSpeed !== undefined ? item.windSpeed : 0,
                  gust: item.windGust !== undefined ? item.windGust : 0,
                  direction: item.windDirection !== undefined ? item.windDirection : 0
                };
              }) ?? []}
              forecastData={forecastData?.map(item => {
                return {
                  time: item.time instanceof Date ? format(item.time, 'HH:mm') : String(item.time),
                  speed: item.windSpeed ?? 0,
                  gust: item.windGust ?? (item.windSpeed ? item.windSpeed * 1.5 : 0),
                  direction: item.windDirection ?? 0
                };
              }) ?? []}
            />
          ) : (
            <div className="p-4 text-center">Ingen vinddata tillgänglig</div>
          )}
          
          {/* Toggle forecast button */}
          {(() => {
            // Check if we're viewing today's date
            const now = new Date();
            const today = format(now, 'yyyy-MM-dd');
            const selectedDay = format(currentDate, 'yyyy-MM-dd');
            const isToday = today === selectedDay;
            
            // Only show the button when viewing today's date
            return isToday && (
              <div className="flex justify-center mt-4 mb-2">
                <button
                  onClick={() => setShowForecast(!showForecast)}
                  className={`px-4 py-2 rounded-lg ${
                    showForecast ? 'bg-kallsjon-green-dark text-white' : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {showForecast ? 'Dölj prognos' : 'Visa prognos'}
                </button>
              </div>
            );
          })()}
          
          {/* Listing for Forecast Data */}
          {(() => {
            // Check if we're viewing today's date or a future date
            const now = new Date();
            const today = format(now, 'yyyy-MM-dd');
            const selectedDay = format(currentDate, 'yyyy-MM-dd');
            const isToday = today === selectedDay;
            const isFuture = currentDate > now;
            
            // Show forecast data when:
            // 1. Today's date AND showForecast is true, OR
            // 2. Future date (always show forecast for future dates)
            return !loading && ((isToday && showForecast) || isFuture) && forecastData && forecastData.length > 0 && (
              <div className="bg-white shadow rounded-lg p-4 mt-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Prognosvärden
                  {isFuture && !isToday && (
                    <span className="block text-sm text-gray-600 font-normal mt-1">
                      Visar endast prognosdata för framtida datum
                    </span>
                  )}
                </h2>
                {groupedForecastData.map((forecast) => (
                  <WindDataGroup
                    key={forecast.time.getTime()}
                    bestWind={forecast}
                    hourData={[forecast]} // Pass single item array since it's forecast data
                    isForecast={true}
                    hideDropdown={true} // Hide dropdown since there's only one data point
                  />
                ))}
              </div>
            );
          })()}

          {/* Listing for Observed Data */}
          {!loading && windData && windData.length > 0 && (
            <div className="bg-white shadow rounded-lg p-4 mt-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Observerade värden
              </h2>
              {Object.entries(groupedByDate)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([dateKey, hourGroups]) => (
                  <div key={dateKey} className="mb-6">
                    <h3 className="text-lg font-medium mb-2 text-gray-900">
                      {format(new Date(dateKey), 'EEE d MMM', { locale: sv })}
                      <span className="text-sm text-gray-600 ml-2">
                        ☀ {format(getSunrise(KALLSJON_COORDINATES.latitude, KALLSJON_COORDINATES.longitude, new Date(dateKey)), 'HH:mm')}
                        {' '} {' '} 
                        ☽ {format(getSunset(KALLSJON_COORDINATES.latitude, KALLSJON_COORDINATES.longitude, new Date(dateKey)), 'HH:mm')}
                        {' '} {' '}
                        {calculateMoonPhase(new Date(dateKey)).emoji} {calculateMoonPhase(new Date(dateKey)).percentage}%
                      </span>
                    </h3>
                    {hourGroups
                      .sort((a, b) => b.best.time.getTime() - a.best.time.getTime())
                      .map(({ best, records }) => {
                        // Check if this is the current hour of today
                        const isCurrentHourGroup = isCurrentHour(best.time);
                        
                        return (
                          <WindDataGroup
                            key={best.time.getTime()}
                            bestWind={best}
                            hourData={records.sort((a, b) => b.time.getTime() - a.time.getTime())}
                            isForecast={false}
                            initiallyExpanded={isCurrentHourGroup}
                          />
                        );
                      })}
                  </div>
                ))}
            </div>
          )}

          
        </div>
      </main>
    </div>
  );
}


export default DailyView; 