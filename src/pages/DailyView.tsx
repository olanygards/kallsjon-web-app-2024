import React, { useState, useMemo } from 'react';
import { format, addDays, subDays, isToday, startOfDay, endOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import WindMap from '../components/WindMap';
import { useWindData } from '../hooks/useWindData';
import { Header } from '../components/Header';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function DailyView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const { data: windData, loading, error } = useWindData({
    startDate: startOfDay(currentDate),
    endDate: endOfDay(currentDate),
    includeObserved: true,
    includeForecast: false,
  });

  // Kallsjön coordinates (approximate)
  const KALLSJON_LAT = 63.4;
  const KALLSJON_LNG = 13.2;

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
  function calculateMoonPhase(date) {
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

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    setSelectedDate(date);
    setIsDatePickerOpen(false);
  };

  const findMaxWindData = (data: any[]) => {
    if (!data || data.length === 0) return null;
    
    let maxEntry = null;
    let maxSpeed = -1;
    
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (!entry) continue;
      
      const speed = entry.windSpeed !== undefined ? entry.windSpeed : 
                   (entry.speed !== undefined ? entry.speed : 0);
      
      if (speed > maxSpeed) {
        maxSpeed = speed;
        maxEntry = entry;
      }
    }
    
    return maxEntry;
  };

  return (
    <div className="min-h-screen bg-kallsjon-green flex flex-col">
      <Header title="Dagsvy" />
      
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-2">
        <div className="overflow-hidden">
          {/* Date selector */}
          <div className="py-4 px-3 flex justify-between items-center">
            <button 
              onClick={() => handleDateChange('prev')}
              className="text-kallsjon-green font-bold"
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
              className="text-kallsjon-green font-bold"
            >
              &gt;
            </button>
          </div>
          
          {/* Dynamic sun and moon information - now centered */}
          <div className="text-center w-full mb-3">
            <span className="text-sm text-gray-600 dark:text-gray-400 inline-block">
              ☀ {sunMoonInfo.sunriseTime}   
              ☽ {sunMoonInfo.sunsetTime}   
              {sunMoonInfo.moonPhase.emoji} {sunMoonInfo.moonPhase.percentage}%
            </span>
          </div>

          {/* Date Picker Modal */}
          {isDatePickerOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-4 rounded-lg">
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateSelect}
                  inline
                  locale={sv}
                  maxDate={addDays(new Date(), 7)}
                  minDate={subDays(new Date(), 30)}
                />
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setIsDatePickerOpen(false)}
                    className="bg-gray-200 text-gray-800 px-4 py-2 rounded"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Best wind of the day */}
          <div 
            className="flex justify-between p-3 mx-2 mb-4 rounded-lg shadow" 
            style={{ backgroundColor: "rgb(223, 241, 223)" }}
          >
            <div className="text-center" style={{ width: '25%' }}>
              <div className="text-sm text-gray-500">Bäst idag</div>
              <div className="text-xl font-bold">
                {(() => {
                  const maxEntry = findMaxWindData(windData || []);
                  if (!maxEntry) return "--:--";
                  
                  if (maxEntry.time instanceof Date) {
                    return format(maxEntry.time, 'HH:mm');
                  } else {
                    return maxEntry.time || "--:--";
                  }
                })()}
              </div>
            </div>
            
            <div className="text-center" style={{ width: '45%' }}>
              <div className="text-sm text-gray-500">Vindhastighet</div>
              <div className="text-xl font-bold whitespace-nowrap">
                {(() => {
                  const maxEntry = findMaxWindData(windData || []);
                  if (!maxEntry) return "-- (--) m/s";
                  
                  const speed = maxEntry.windSpeed !== undefined ? maxEntry.windSpeed : 
                               (maxEntry.speed !== undefined ? maxEntry.speed : 0);
                  
                  const gust = maxEntry.windGust !== undefined ? maxEntry.windGust :
                              (maxEntry.gustSpeed !== undefined ? maxEntry.gustSpeed :
                              (maxEntry.gust !== undefined ? maxEntry.gust : speed * 1.5));
                  
                  return `${speed.toFixed(1)} (${gust.toFixed(1)}) m/s`;
                })()}
              </div>
            </div>
            
            <div className="text-center" style={{ width: '30%' }}>
              <div className="text-sm text-gray-500">Riktning</div>
              <div className="text-xl font-bold">
                {(() => {
                  const maxEntry = findMaxWindData(windData || []);
                  if (!maxEntry) return "--°";
                  
                  const direction = maxEntry.direction !== undefined ? maxEntry.direction : 
                                   (maxEntry.windDirection !== undefined ? maxEntry.windDirection : 0);
                  
                  return `${direction}°`;
                })()}
              </div>
            </div>
          </div>
          
          {/* Wind map */}
          {loading ? (
            <div className="p-4 text-center">Laddar vinddata...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">Kunde inte ladda vinddata</div>
          ) : windData && windData.length > 0 ? (
            <WindMap windData={windData.map(item => ({
              time: item.time instanceof Date ? format(item.time, 'HH:mm') : String(item.time),
              speed: item.windSpeed !== undefined ? item.windSpeed : (item.speed || 0),
              gust: item.windGust !== undefined ? item.windGust : (item.gust || 0),
              direction: item.windDirection !== undefined ? item.windDirection : (item.direction || 0)
            }))} />
          ) : (
            <div className="p-4 text-center">Ingen vinddata tillgänglig</div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DailyView; 