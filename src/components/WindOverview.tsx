import { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format, startOfYear, endOfYear, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import 'chartjs-plugin-zoom';
import { WindDetailModal } from './WindDetailModal';

// Register Chart.js plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

interface WindOverviewProps {
  onDateSelect: (date: Date) => void;
}

interface HourlyData {
  time: Date;
  windSpeed: number;
  windGust: number;
  windDirection: number;
}

interface BinnedWindData {
  date: Date;
  maxWindSpeed: number;
  maxGust: number;
  windBin: '2-5' | '5-7' | '7-10' | '10+';
  windDirection: number;
  hourlyData: HourlyData[];
}

interface StatCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, children, onClick }: StatCardProps) {
  return (
    <div 
      className={`bg-blue-50 rounded-lg border border-blue-100 p-4 flex flex-col justify-between ${onClick ? 'cursor-pointer hover:bg-blue-100 transition-colors' : ''}`}
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold text-blue-900">{title}</h3>
      {value !== undefined && <p className="text-2xl font-bold mt-2 text-blue-800">{value}</p>}
      {subtitle && <p className="text-blue-600 text-sm">{subtitle}</p>}
      {children && <div className="text-blue-800">{children}</div>}
    </div>
  );
}

interface WindStatsProps {
  bestDay: { date: Date; maxWindSpeed: number } | null;
  totalDays: number;
  topDays: { date: Date; maxWindSpeed: number }[];
  bestYear?: number;
  bestYearDays?: number;
  fetch24HourData: (date: Date) => Promise<HourlyData[]>;
  onDaySelect: (day: BinnedWindData) => void;
}

function WindStats({ bestDay, totalDays, topDays, bestYear, bestYearDays, fetch24HourData, onDaySelect }: WindStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      {/* First row - Best Day & Total Days */}
      <StatCard
        title="Bästa dagen"
        value={bestDay ? format(bestDay.date, 'd MMM yyyy', { locale: sv }) : '-'}
        subtitle={bestDay ? `Vindstyrka: ${bestDay.maxWindSpeed} m/s` : 'Ingen data tillgänglig'}
        onClick={bestDay ? async () => {
          const fullDayData = await fetch24HourData(bestDay.date);
          onDaySelect({
            date: bestDay.date,
            maxWindSpeed: bestDay.maxWindSpeed,
            maxGust: bestDay.maxWindSpeed, // Use maxWindSpeed as fallback
            windBin: bestDay.maxWindSpeed >= 10 ? '10+' : bestDay.maxWindSpeed >= 7 ? '7-10' : bestDay.maxWindSpeed >= 5 ? '5-7' : '2-5',
            windDirection: 0, // Default value
            hourlyData: fullDayData
          });
        } : undefined}
      />
      <StatCard
        title="Totalt antal blåsiga dagar"
        value={totalDays}
        subtitle="Dagar med vindstyrka över 10 m/s"
      />

      {/* Second row - Top 5 Best Days (Full width) */}
      <div className="col-span-1 md:col-span-2">
        <StatCard title="Topp 5 blåsigaste dagar">
          <ul className="mt-2 space-y-2">
            {topDays.map((day, index) => (
              <li 
                key={index} 
                className="flex justify-between text-sm cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors"
                onClick={async () => {
                  const fullDayData = await fetch24HourData(day.date);
                  onDaySelect({
                    date: day.date,
                    maxWindSpeed: day.maxWindSpeed,
                    maxGust: day.maxWindSpeed, // Use maxWindSpeed as fallback
                    windBin: day.maxWindSpeed >= 10 ? '10+' : day.maxWindSpeed >= 7 ? '7-10' : day.maxWindSpeed >= 5 ? '5-7' : '2-5',
                    windDirection: 0, // Default value
                    hourlyData: fullDayData
                  });
                }}
              >
                <span>{format(day.date, 'd MMM yyyy', { locale: sv })}</span>
                <span className="font-semibold">{day.maxWindSpeed} m/s</span>
              </li>
            ))}
          </ul>
        </StatCard>
      </div>

      {/* Third row - Best Year & Total Days in that Year */}
      {bestYear && bestYearDays && (
        <>
          <StatCard 
            title="Bästa året" 
            value={bestYear} 
            subtitle="Året med mest vind" 
          />
          <StatCard
            title="Blåsiga dagar det året"
            value={bestYearDays}
            subtitle={`Antal dagar över 10 m/s under ${bestYear}`}
          />
        </>
      )}
    </div>
  );
}

interface AdvancedWindStatsProps {
  windyDays: BinnedWindData[];
  fetch24HourData: (date: Date) => Promise<HourlyData[]>;
  onDaySelect: (day: BinnedWindData) => void;
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function AdvancedWindStats({ windyDays, fetch24HourData, onDaySelect }: AdvancedWindStatsProps) {
  const [selectedDay, setSelectedDay] = useState<BinnedWindData | null>(null);

  // Calculate highest average wind speed per year
  const windSpeedByYear = windyDays.reduce((acc, day) => {
    const year = day.date.getFullYear();
    if (!acc[year]) {
      acc[year] = { totalWind: 0, count: 0 };
    }
    acc[year].totalWind += day.maxWindSpeed;
    acc[year].count += 1;
    return acc;
  }, {} as Record<number, { totalWind: number; count: number }>);

  // Find year with highest average wind speed
  const bestWindYear = Object.entries(windSpeedByYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      avgWindSpeed: data.totalWind / data.count,
    }))
    .sort((a, b) => b.avgWindSpeed - a.avgWindSpeed)[0];

  // Find day with highest gust
  const highestGustDay = [...windyDays]
    .sort((a, b) => b.maxGust - a.maxGust)[0];

  // Calculate longest streak of windy days
  const streaks = windyDays
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .reduce((acc, day, i, arr) => {
      if (i === 0) {
        acc.current = { start: day.date, length: 1 };
        acc.longest = { start: day.date, length: 1 };
        return acc;
      }

      const prevDay = arr[i - 1];
      const dayDiff = Math.round((day.date.getTime() - prevDay.date.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        acc.current.length++;
        if (acc.current.length > acc.longest.length) {
          acc.longest = { ...acc.current };
        }
      } else {
        acc.current = { start: day.date, length: 1 };
      }

      return acc;
    }, { current: { start: new Date(), length: 0 }, longest: { start: new Date(), length: 0 } });

  // Calculate most common wind direction
  const windDirections = windyDays.reduce((acc, day) => {
    if (day.windDirection === 0) return acc; // Skip days with no direction data
    const direction = getWindDirection(day.windDirection);
    acc[direction] = (acc[direction] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostCommonDirection = Object.entries(windDirections)
    .sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

  // Calculate best wind season (3-month period)
  const seasonalData = windyDays.reduce((acc, day) => {
    const year = day.date.getFullYear();
    const month = day.date.getMonth();
    for (let i = 0; i < 3; i++) {
      const seasonKey = `${year}-${((month - i + 12) % 12).toString().padStart(2, '0')}`;
      if (!acc[seasonKey]) {
        acc[seasonKey] = { totalWind: 0, count: 0, startMonth: (month - i + 12) % 12 };
      }
      acc[seasonKey].totalWind += day.maxWindSpeed;
      acc[seasonKey].count += 1;
    }
    return acc;
  }, {} as Record<string, { totalWind: number; count: number; startMonth: number }>);

  const bestSeason = Object.entries(seasonalData)
    .map(([key, data]) => ({
      key,
      avgWind: data.totalWind / data.count,
      startMonth: data.startMonth
    }))
    .sort((a, b) => b.avgWind - a.avgWind)[0];

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const seasonMonths = [
    monthNames[bestSeason.startMonth],
    monthNames[(bestSeason.startMonth + 1) % 12],
    monthNames[(bestSeason.startMonth + 2) % 12]
  ].join('-');

  const handleDateChange = useCallback(async (direction: 'prev' | 'next') => {
    if (!selectedDay) return;

    // Find current index
    const currentIndex = windyDays.findIndex(day => 
      day.date.getTime() === selectedDay.date.getTime()
    );

    if (currentIndex === -1) return;

    // Calculate new index
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= windyDays.length) return;

    // Get new day
    const newDay = windyDays[newIndex];
    const fullDayData = await fetch24HourData(newDay.date);
    
    const updatedDay = {
      ...newDay,
      hourlyData: fullDayData
    };
    
    setSelectedDay(updatedDay);
  }, [selectedDay, windyDays, fetch24HourData]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <StatCard
          title="Högst genomsnittlig vind"
          value={`${bestWindYear.year}`}
          subtitle={`Genomsnitt: ${bestWindYear.avgWindSpeed.toFixed(1)} m/s`}
        />
        <div onClick={async () => {
          if (highestGustDay) {
            const fullDayData = await fetch24HourData(highestGustDay.date);
            onDaySelect({
              ...highestGustDay,
              hourlyData: fullDayData
            });
          }
        }} className="cursor-pointer">
          <StatCard
            title="Högsta byvind"
            value={`${highestGustDay.maxGust.toFixed(1)} m/s`}
            subtitle={`${format(highestGustDay.date, 'd MMM yyyy', { locale: sv })}`}
          />
        </div>
        <div onClick={async () => {
          const startDay = windyDays.find(day => 
            day.date.getTime() === streaks.longest.start.getTime()
          );
          if (startDay) {
            const fullDayData = await fetch24HourData(startDay.date);
            onDaySelect({
              ...startDay,
              hourlyData: fullDayData
            });
          }
        }} className="cursor-pointer">
          <StatCard
            title="Längsta period med vind"
            value={`${streaks.longest.length} dagar`}
            subtitle={`Från ${format(streaks.longest.start, 'd MMM yyyy', { locale: sv })}`}
          />
        </div>
        <StatCard
          title="Vanligaste vindriktning"
          value={mostCommonDirection[0]}
          subtitle={mostCommonDirection[1] === 0 
            ? 'Ingen riktningsdata tillgänglig'
            : `${((mostCommonDirection[1] / Object.values(windDirections).reduce((a, b) => a + b, 0)) * 100).toFixed(0)}% av dagarna`}
        />
        <StatCard
          title="Bästa vindsäsong"
          value={seasonMonths}
          subtitle={`Genomsnitt: ${bestSeason.avgWind.toFixed(1)} m/s`}
        />
      </div>

      <WindDetailModal
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        date={selectedDay?.date || null}
        windData={selectedDay ? {
          maxWindSpeed: selectedDay.maxWindSpeed,
          maxGust: selectedDay.maxGust,
          windDirection: selectedDay.windDirection,
          hourlyData: selectedDay.hourlyData.map(data => ({
            time: format(data.time, 'HH:mm'),
            speed: data.windSpeed,
            gust: data.windGust,
            direction: data.windDirection
          })) || []
        } : undefined}
        onDateChange={handleDateChange}
        hasPrevDay={selectedDay ? windyDays.findIndex(day => 
          day.date.getTime() === selectedDay.date.getTime()
        ) > 0 : false}
        hasNextDay={selectedDay ? windyDays.findIndex(day => 
          day.date.getTime() === selectedDay.date.getTime()
        ) < windyDays.length - 1 : false}
      />
    </>
  );
}

export function WindOverview({ onDateSelect }: WindOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [windyDays, setWindyDays] = useState<BinnedWindData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [cachedData, setCachedData] = useState<Map<number | null, BinnedWindData[]>>(new Map());
  const chartRef = useRef<any>(null);
  const [selectedDay, setSelectedDay] = useState<BinnedWindData | null>(null);

  // Add new state for year stats
  const [yearStats, setYearStats] = useState<{ year: number; count: number }[]>([]);
  const [allWindyDays, setAllWindyDays] = useState<BinnedWindData[]>([]);

  async function fetch24HourData(date: Date) {
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const windRef = collection(db, 'wind');
    const q = query(
      windRef,
      where('time', '>=', Timestamp.fromDate(dayStart)),
      where('time', '<', Timestamp.fromDate(dayEnd)),
      orderBy('time', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const hourlyData: HourlyData[] = [];
    const hourMap = new Map<number, HourlyData>();

    // First, store all actual data points
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const time = data.time.toDate();
      const hour = time.getHours();
      
      const dataPoint = {
        time,
        windSpeed: data.force,
        windGust: data.forceMax || data.force,
        windDirection: data.direction || 0
      };

      // Keep the highest wind speed for each hour
      const existing = hourMap.get(hour);
      if (!existing || existing.windSpeed < dataPoint.windSpeed) {
        hourMap.set(hour, dataPoint);
      }
    });

    // Then fill in missing hours with interpolated or null values
    for (let hour = 0; hour < 24; hour++) {
      if (!hourMap.has(hour)) {
        // Find nearest previous and next measurements for interpolation
        let prevHour = hour - 1;
        let nextHour = hour + 1;
        let prevData: HourlyData | undefined;
        let nextData: HourlyData | undefined;

        while (prevHour >= 0 && !prevData) {
          prevData = hourMap.get(prevHour);
          prevHour--;
        }

        while (nextHour < 24 && !nextData) {
          nextData = hourMap.get(nextHour);
          nextHour++;
        }

        // Create a time for this hour
        const time = new Date(dayStart);
        time.setHours(hour);

        if (prevData && nextData) {
          // Interpolate values
          const ratio = (hour - (prevHour + 2)) / (nextHour - (prevHour + 2));
          hourMap.set(hour, {
            time,
            windSpeed: prevData.windSpeed + (nextData.windSpeed - prevData.windSpeed) * ratio,
            windGust: prevData.windGust + (nextData.windGust - prevData.windGust) * ratio,
            windDirection: prevData.windDirection + (nextData.windDirection - prevData.windDirection) * ratio
          });
        } else if (prevData) {
          // Use previous value with slight decay
          hourMap.set(hour, {
            time,
            windSpeed: prevData.windSpeed * 0.9,
            windGust: prevData.windGust * 0.9,
            windDirection: prevData.windDirection
          });
        } else if (nextData) {
          // Use next value with slight decay
          hourMap.set(hour, {
            time,
            windSpeed: nextData.windSpeed * 0.9,
            windGust: nextData.windGust * 0.9,
            windDirection: nextData.windDirection
          });
        } else {
          // No nearby data, use null values
          hourMap.set(hour, {
            time,
            windSpeed: 0,
            windGust: 0,
            windDirection: 0
          });
        }
      }
    }

    // Convert map to sorted array
    return Array.from(hourMap.entries())
      .sort(([hourA], [hourB]) => hourA - hourB)
      .map(([_, data]) => data);
  }

  async function fetchWindyDays(year: number | null) {
    const cached = cachedData.get(year);
    if (cached && cached.length > 0) {
      console.log(`Using cached data for ${year ? year : "all years"}`);
      setWindyDays(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`Fetching windiest days for ${year ? `year ${year}` : "all years"}...`);
      
      const windRef = collection(db, 'wind');
      let q;

      if (year) {
        // Fetch all windy days for a specific year
        const yearStart = startOfYear(new Date(year, 0, 1));
        const yearEnd = endOfYear(new Date(year, 11, 31));

        q = query(
          windRef,
          where('time', '>=', Timestamp.fromDate(yearStart)),
          where('time', '<=', Timestamp.fromDate(yearEnd)),
          where('force', '>=', 10),  // Show all days with wind over 10 m/s
          orderBy('time', 'asc')     // Sort chronologically
        );
      } else {
        // Fetch all windy days across all years
        q = query(
          windRef,
          where('force', '>=', 10),  // Get all days over 10 m/s
          where('time', '>=', Timestamp.fromDate(new Date(2020, 0, 1))), // Start from 2020
          orderBy('force', 'desc'),  // Sort by wind speed first
          orderBy('time', 'asc')     // Then by time
        );
      }

      const querySnapshot = await getDocs(q);
      console.log('Query snapshot size:', querySnapshot.size);

      const dailyMax: Map<string, BinnedWindData> = new Map();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.time.toDate();
        const dateKey = format(date, 'yyyy-MM-dd');
        const maxWindSpeed = data.force;
        const maxGust = data.forceMax || maxWindSpeed;

        // Keep only the highest wind speed for each day
        if (!dailyMax.has(dateKey)) {
          dailyMax.set(dateKey, {
            date: startOfDay(date), // Use start of day for the day's date
            maxWindSpeed,
            maxGust,
            windBin: maxWindSpeed >= 10 ? '10+' : maxWindSpeed >= 7 ? '7-10' : maxWindSpeed >= 5 ? '5-7' : '2-5',
            windDirection: data.direction || 0,
            hourlyData: [] // Initialize empty array
          });
        }

        const currentDay = dailyMax.get(dateKey)!;
        
        // Update max values if this record has higher values
        if (maxWindSpeed > currentDay.maxWindSpeed) {
          currentDay.maxWindSpeed = maxWindSpeed;
          currentDay.maxGust = maxGust;
          currentDay.windBin = maxWindSpeed >= 10 ? '10+' : maxWindSpeed >= 7 ? '7-10' : maxWindSpeed >= 5 ? '5-7' : '2-5';
        }

        // Add to hourly data
        currentDay.hourlyData.push({
          time: date,
          windSpeed: maxWindSpeed,
          windGust: maxGust,
          windDirection: data.direction || 0
        });
      });

      // Sort hourly data for each day
      dailyMax.forEach(day => {
        day.hourlyData.sort((a, b) => a.time.getTime() - b.time.getTime());
      });

      // Convert to array and sort
      let sortedDays = Array.from(dailyMax.values());
      
      if (year) {
        // For year view: sort chronologically
        sortedDays = sortedDays.sort((a, b) => a.date.getTime() - b.date.getTime());
      } else {
        // Store all windy days for stats calculation
        setAllWindyDays(sortedDays);
        
        // For display: get top 200 windiest days, then sort chronologically
        sortedDays = sortedDays
          .sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort by date only, no limit
      }

      console.log('Processed days:', sortedDays.length);

      if (sortedDays.length > 0) {
        setCachedData(prev => new Map(prev).set(year, sortedDays));
      }
      setWindyDays(sortedDays);
      
    } catch (err) {
      console.error('Error fetching windy days:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch windy days'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWindyDays(selectedYear);
  }, [selectedYear]);

  // Calculate stats when allWindyDays changes (not windyDays)
  useEffect(() => {
    if (!selectedYear && allWindyDays.length > 0) {
      // Calculate stats for all years using allWindyDays
      const yearCounts = allWindyDays.reduce((acc, day) => {
        const year = day.date.getFullYear();
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const stats = Object.entries(yearCounts).map(([year, count]) => ({
        year: parseInt(year),
        count
      }));

      setYearStats(stats.sort((a, b) => b.count - a.count));
    }
  }, [allWindyDays, selectedYear]);

  // Get best year stats
  const bestYearStats = yearStats.length > 0 ? {
    year: yearStats[0].year,
    days: yearStats[0].count
  } : undefined;

  // Sort days by wind speed for stats
  const sortedByWind = [...windyDays].sort((a, b) => b.maxWindSpeed - a.maxWindSpeed);
  const bestDay = sortedByWind.length > 0 ? {
    date: sortedByWind[0].date,
    maxWindSpeed: sortedByWind[0].maxWindSpeed
  } : null;

  const handleYearSelect = (year: number | null) => {
    setWindyDays([]); // Clear old data first
    setLoading(true); // Show loading state
    setSelectedYear(year);
  };

  const handleClick = useCallback(async (_event: any, elements: any[]) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const selectedDay = windyDays[dataIndex];
      const fullDayData = await fetch24HourData(selectedDay.date);
      setSelectedDay({
        ...selectedDay,
        hourlyData: fullDayData
      });
      onDateSelect(selectedDay.date);
    }
  }, [windyDays, onDateSelect, fetch24HourData]);

  const handleDateChange = useCallback(async (direction: 'prev' | 'next') => {
    if (!selectedDay) return;

    // Find current index
    const currentIndex = windyDays.findIndex(day => 
      day.date.getTime() === selectedDay.date.getTime()
    );

    if (currentIndex === -1) return;

    // Calculate new index
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= windyDays.length) return;

    // Get new day
    const newDay = windyDays[newIndex];
    const fullDayData = await fetch24HourData(newDay.date);
    
    const updatedDay = {
      ...newDay,
      hourlyData: fullDayData
    };
    
    setSelectedDay(updatedDay);
  }, [selectedDay, windyDays, fetch24HourData]);

  const chartData = {
    labels: windyDays.map(day => format(day.date, 'd MMM yyyy', { locale: sv })),
    datasets: [
      {
        label: 'Byvind',
        data: windyDays.map(day => day.maxGust),
        borderColor: (context: any) => {
          const value = context.raw;
          if (value >= 15) return '#ad3c1f';
          if (value >= 12) return '#a55c3b';
          return '#49654c96';
        },
        segment: {
          borderColor: (context: any) => {
            const value = Math.max(
              context.p0.parsed.y || 0,
              context.p1.parsed.y || 0
            );
            if (value >= 15) return '#ad3c1f';
            if (value >= 12) return '#a55c3b';
            return '#49654c96';
          },
        },
        tension: 0.2,
        pointRadius: 2,
        borderWidth: 1,
        order: 1
      },
      {
        label: 'Medelvind',
        data: windyDays.map(day => day.maxWindSpeed),
        borderColor: (context: any) => {
          const value = context.raw;
          if (value >= 10) return '#005b2f';
          if (value >= 7) return '#0b7c46';
          if (value >= 5) return '#388957';
          return '#49654c96';
        },
        segment: {
          borderColor: (context: any) => {
            const value = Math.max(
              context.p0.parsed.y || 0,
              context.p1.parsed.y || 0
            );
            if (value >= 10) return '#005b2f';
            if (value >= 7) return '#0b7c46';
            if (value >= 5) return '#388957';
            return '#49654c96';
          },
        },
        tension: 0.2,
        pointRadius: 3,
        borderWidth: 1,
        order: 2
      },
    ],
  };

  // Generate annotations based on the actual data points
  const annotations: Record<string, any> = {};

  // Monthly separators when a year is selected
  if (selectedYear) {
    const monthsSeen = new Set<number>();
    windyDays.forEach((day, index) => {
      const month = day.date.getMonth(); // Get 0-11 for months
      if (!monthsSeen.has(month)) {
        monthsSeen.add(month);
        annotations[`month${month}`] = {
          type: 'line',
          scaleID: 'x',
          value: index,
          borderColor: 'rgba(128, 128, 128, 0.2)',
          borderWidth: 1,
          borderDash: [5, 5],
          label: {
            display: true,
            content: format(day.date, 'MMM', { locale: sv }),
            position: 'start',
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
            color: '#666',
            font: { size: 10 }
          }
        };
      }
    });
  }

  // Year separators when all years are shown
  if (!selectedYear) {
    const yearsSeen = new Set<number>();
    windyDays.forEach((day, index) => {
      const year = day.date.getFullYear();
      if (!yearsSeen.has(year)) {
        yearsSeen.add(year);
        annotations[`year${year}`] = {
          type: 'line',
          scaleID: 'x',
          value: index,
          borderColor: 'rgba(128, 128, 128, 0.3)',
          borderWidth: 1,
          borderDash: [5, 5],
          label: {
            display: true,
            content: year.toString(),
            position: 'start',
            backgroundColor: 'rgba(128, 128, 128, 0.1)',
            color: '#666',
            font: { size: 12 }
          }
        };
      }
    });
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'category' as const,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: true,
          drawBorder: true,
          drawOnChartArea: true,
          drawTicks: true,
        }
      },
      y: {
        beginAtZero: true,
        max: 35,
        title: {
          display: true,
          text: 'Vindstyrka (m/s)',
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      annotation: { annotations },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x' as const,
          threshold: 10,
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderColor: 'rgba(0,0,0,0.3)',
            borderWidth: 1,
            threshold: 10,
          },
          mode: 'x' as const,
        },
        limits: {
          y: { min: 0, max: 35 }
        },
      },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            if (items.length > 0) {
              const index = items[0].dataIndex;
              const day = windyDays[index];
              return format(day.date, 'EEEE d MMMM yyyy', { locale: sv });
            }
            return '';
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Översikt - Blåsiga dagar</h2>
        <p className="text-gray-600 text-sm mt-1">
          {selectedYear 
            ? `Visar alla dagar med vind över 10 m/s under ${selectedYear}, sorterade efter datum.`
            : 'Visar alla dagar med vind över 10 m/s över alla år, sorterade efter datum.'} Klicka på en punkt för att se detaljerad data för den dagen.
        </p>

        <div className="flex gap-2 mt-4 flex-wrap">
          <button
            onClick={() => handleYearSelect(null)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedYear === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Alla år
          </button>
          {[2020, 2021, 2022, 2023, 2024, 2025].map(year => (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedYear === year
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-red-600 bg-red-50 rounded-lg">
          Ett fel uppstod: {error.message}
        </div>
      ) : (
        <div className="p-4">
          <div className="mb-4">
            <button
              onClick={() => chartRef.current?.resetZoom()}
              className="px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 float-right"
            >
              Återställ zoom
            </button>
          </div>
          <div className="h-[500px] relative clear-both">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>

          {/* Add stats section */}
          <WindStats
            bestDay={bestDay}
            totalDays={windyDays.length}
            topDays={sortedByWind.slice(0, 5).map(day => ({
              date: day.date,
              maxWindSpeed: day.maxWindSpeed
            }))}
            bestYear={!selectedYear && bestYearStats ? bestYearStats.year : undefined}
            bestYearDays={!selectedYear && bestYearStats ? bestYearStats.days : undefined}
            fetch24HourData={fetch24HourData}
            onDaySelect={setSelectedDay}
          />
          
          {/* Add Advanced Stats */}
          <h3 className="text-xl font-semibold mt-8 mb-4">Mer statistik</h3>
          <AdvancedWindStats 
            windyDays={windyDays} 
            fetch24HourData={fetch24HourData}
            onDaySelect={(day: BinnedWindData) => {
              setSelectedDay(day);
            }}
          />

          {/* Add WindDetailModal */}
          <WindDetailModal
            isOpen={selectedDay !== null}
            onClose={() => setSelectedDay(null)}
            date={selectedDay?.date || null}
            windData={selectedDay ? {
              maxWindSpeed: selectedDay.maxWindSpeed,
              maxGust: selectedDay.maxGust,
              windDirection: selectedDay.windDirection,
              hourlyData: selectedDay.hourlyData.map(data => ({
                time: format(data.time, 'HH:mm'),
                speed: data.windSpeed,
                gust: data.windGust,
                direction: data.windDirection
              }))
            } : undefined}
            onDateChange={handleDateChange}
            hasPrevDay={selectedDay ? windyDays.findIndex(day => 
              day.date.getTime() === selectedDay.date.getTime()
            ) > 0 : false}
            hasNextDay={selectedDay ? windyDays.findIndex(day => 
              day.date.getTime() === selectedDay.date.getTime()
            ) < windyDays.length - 1 : false}
          />
        </div>
      )}
    </div>
  );
} 