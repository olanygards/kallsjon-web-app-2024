import { useState, useCallback, useRef, useEffect } from 'react';
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
import { format, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import 'chartjs-plugin-zoom';
import { WindDetailModal } from './WindDetailModal';
import type { WindData } from '../types/WindData';

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
      className={`bg-kallsjon-green rounded-lg border p-4 flex flex-col justify-between ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold text-green-900">{title}</h3>
      {value !== undefined && <p className="text-2xl font-bold mt-2 text-green-800">{value}</p>}
      {subtitle && <p className="text-green-800 text-sm">{subtitle}</p>}
      {children && <div className="text-green-800">{children}</div>}
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
                className="flex justify-between text-sm cursor-pointer p-2 rounded transition-colors"
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
  const bestWindYear = Object.entries(windSpeedByYear).length > 0
    ? Object.entries(windSpeedByYear)
      .map(([year, data]) => ({
        year: parseInt(year),
        avgWindSpeed: data.totalWind / data.count,
      }))
      .sort((a, b) => b.avgWindSpeed - a.avgWindSpeed)[0]
    : null;

  // Find day with highest gust
  const highestGustDay = windyDays.length > 0
    ? [...windyDays].sort((a, b) => b.maxGust - a.maxGust)[0]
    : null;

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
  const seasonMonths = bestSeason ? [
    monthNames[bestSeason.startMonth],
    monthNames[(bestSeason.startMonth + 1) % 12],
    monthNames[(bestSeason.startMonth + 2) % 12]
  ].join('-') : 'Ingen data';

  const handleDateChange = useCallback(async (direction: 'prev' | 'next') => {
    if (!selectedDay) return;

    const currentIndex = windyDays.findIndex(day =>
      day.date.getTime() === selectedDay.date.getTime()
    );

    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= windyDays.length) return;

    const newDay = windyDays[newIndex];
    await onDaySelect(newDay);
  }, [selectedDay, windyDays, onDaySelect]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <StatCard
          title="Högst genomsnittlig vind"
          value={bestWindYear ? `${bestWindYear.year}` : 'Ingen data'}
          subtitle={bestWindYear ? `Genomsnitt: ${bestWindYear.avgWindSpeed.toFixed(1)} m/s` : 'Ingen data tillgänglig'}
        />
        <div onClick={async () => {
          if (highestGustDay) {
            const fullDayData = await fetch24HourData(highestGustDay.date);
            onDaySelect({
              ...highestGustDay,
              hourlyData: fullDayData
            });
          }
        }} className={`cursor-pointer ${!highestGustDay ? 'opacity-50' : ''}`}>
          <StatCard
            title="Högsta byvind"
            value={highestGustDay ? `${highestGustDay.maxGust.toFixed(1)} m/s` : 'Ingen data'}
            subtitle={highestGustDay ? `${format(highestGustDay.date, 'd MMM yyyy', { locale: sv })}` : 'Ingen data tillgänglig'}
          />
        </div>
        <div onClick={async () => {
          if (streaks.longest.length > 0) {
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
          }
        }} className={`cursor-pointer ${streaks.longest.length === 0 ? 'opacity-50' : ''}`}>
          <StatCard
            title="Längsta period med vind"
            value={streaks.longest.length > 0 ? `${streaks.longest.length} dagar` : 'Ingen data'}
            subtitle={streaks.longest.length > 0 ? `Från ${format(streaks.longest.start, 'd MMM yyyy', { locale: sv })}` : 'Ingen data tillgänglig'}
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
          subtitle={bestSeason ? `Genomsnitt: ${bestSeason.avgWind.toFixed(1)} m/s` : 'Ingen data tillgänglig'}
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
      />
    </>
  );
}

interface WindOverviewProps {
  onDateSelect: (date: Date) => void;
  windData: WindData[];
}

export function WindOverview({ onDateSelect, windData }: WindOverviewProps) {
  const [selectedYear, setSelectedYear] = useState<number>(0); // 0 means "all years"
  const [loading, setLoading] = useState(false);
  const [windyDays, setWindyDays] = useState<BinnedWindData[]>([]);
  const chartRef = useRef<any>(null);
  const [selectedDay, setSelectedDay] = useState<BinnedWindData | null>(null);
  const [yearStats] = useState<{ year: number; count: number }[]>([]);

  // Add logging to see the input data
  useEffect(() => {

    if (windData && windData.length > 0) {
      // Process the data for the chart
      try {
        const processedDays: BinnedWindData[] = windData.map(day => {
          // Ensure the day has all required properties
          if (!day.time || typeof day.windSpeed !== 'number') {
            console.warn('Invalid day data:', day);
            return null;
          }

          // Determine wind bin
          let windBin: '2-5' | '5-7' | '7-10' | '10+' = '2-5';
          if (day.windSpeed >= 10) {
            windBin = '10+';
          } else if (day.windSpeed >= 7) {
            windBin = '7-10';
          } else if (day.windSpeed >= 5) {
            windBin = '5-7';
          }

          // Create the processed day object
          return {
            date: day.time instanceof Date ? day.time : new Date(day.time),
            maxWindSpeed: day.windSpeed,
            maxGust: day.windGust || day.windSpeed,
            windBin,
            windDirection: day.windDirection || 0,
            hourlyData: []
          };
        }).filter(Boolean) as BinnedWindData[];

        // The second useEffect will handle filtering by year and wind speed
        // Just set the raw processed days here
        setWindyDays(processedDays);
      } catch (err) {
        console.error('Error processing wind data in WindOverview:', err);
      }
    } else {
      console.warn('WindOverview received no data');
      setWindyDays([]);
    }
  }, [windData]);

  // Apply the year filter when selectedYear changes
  useEffect(() => {
    if (windData && windData.length > 0) {
      try {
        console.log('Processing wind data for year filter. Selected year:', selectedYear);


        // Get the processed days again
        const processedDays: BinnedWindData[] = windData.map(day => {
          if (!day.time) return null;

          // Create date object
          const date = day.time instanceof Date ? day.time : new Date(day.time);


          // Determine wind bin
          let windBin: '2-5' | '5-7' | '7-10' | '10+' = '2-5';
          if (day.windSpeed >= 10) windBin = '10+';
          else if (day.windSpeed >= 7) windBin = '7-10';
          else if (day.windSpeed >= 5) windBin = '5-7';

          return {
            date,
            maxWindSpeed: day.windSpeed,
            maxGust: day.windGust || day.windSpeed,
            windBin,
            windDirection: day.windDirection || 0,
            hourlyData: []
          };
        }).filter(Boolean) as BinnedWindData[];

        applyYearFilter(selectedYear, processedDays);
      } catch (err) {
        console.error('Error filtering by year:', err);
        setLoading(false);
      }
    }
  }, [selectedYear, windData]);

  // Function to apply year filter
  const applyYearFilter = (year: number, allDays: BinnedWindData[]) => {
    try {

      // Count by year before filtering
      const yearCounts = allDays.reduce((acc, day) => {
        const year = day.date.getFullYear();
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      console.log('Year distribution before filtering:', yearCounts);

      // Filter by year
      let filteredDays = allDays;
      if (year !== 0) {
        // Check date validity first
        const invalidDates = allDays.filter(day =>
          isNaN(day.date.getTime()) ||
          !isFinite(day.date.getTime())
        ).length;

        if (invalidDates > 0) {
          console.warn(`Found ${invalidDates} invalid dates in the dataset`);
        }

        // Apply year filter with extra logging
        filteredDays = allDays.filter(day => {
          const dayYear = day.date.getFullYear();
          const matches = dayYear === year;

          // Log any potential issues with years not matching expected format
          if (dayYear < 2000 || dayYear > 2100) {
            console.warn('Suspicious year value:', {
              dayYear,
              date: day.date.toString(),
              originalDate: day.date
            });
          }

          return matches;
        });

      } else {
        console.log(`Showing all ${filteredDays.length} days across all years`);
      }

      // Count by year after filtering
      const filteredYearCounts = filteredDays.reduce((acc, day) => {
        const year = day.date.getFullYear();
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      console.log('Year distribution after filtering:', filteredYearCounts);

      // Filter for days with wind >= 10 m/s
      const strongWindDays = filteredDays.filter(day => day.maxWindSpeed >= 10);

      // Update state with filtered days
      setWindyDays(strongWindDays);
      setLoading(false);
    } catch (err) {
      console.error('Error in applyYearFilter:', err);
      setLoading(false);
    }
  };

  async function fetch24HourData(date: Date): Promise<HourlyData[]> {
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

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      hourlyData.push({
        time: data.time.toDate(),
        windSpeed: data.force,
        windGust: data.forceMax || data.force,
        windDirection: data.direction || 0
      });
    });

    return hourlyData;
  }

  const handleYearSelect = (year: number | null) => {
    console.log('Year selected:', year);

    // Check if we have any data for this year before filtering
    if (windData && windData.length > 0) {
      const yearCounts = windData.reduce((acc, item) => {
        if (!item.time) return acc;
        const date = item.time instanceof Date ? item.time : new Date(item.time);
        const itemYear = date.getFullYear();
        acc[itemYear] = (acc[itemYear] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      if (year !== null && year !== 0 && !yearCounts[year]) {
        console.warn(`No data available for selected year ${year}. Available years:`, Object.keys(yearCounts));
      }
    }

    // For "Alla dagar", use 0 as a special value
    const newYear = year === null ? 0 : year;
    setSelectedYear(newYear);
    setLoading(true); // Show loading state
  };

  const handleDaySelect = useCallback(async (day: BinnedWindData) => {
    const hourlyData = await fetch24HourData(day.date);
    const updatedDay: BinnedWindData = {
      ...day,
      hourlyData
    };
    setSelectedDay(updatedDay);
    onDateSelect(day.date);
  }, [fetch24HourData, onDateSelect]);

  const handleChartClick = useCallback(async (_event: any, elements: any[]) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const day = windyDays[dataIndex];
      await handleDaySelect(day);
    }
  }, [windyDays, handleDaySelect]);

  const handleDateChange = useCallback(async (direction: 'prev' | 'next') => {
    if (!selectedDay) return;

    const currentIndex = windyDays.findIndex(day =>
      day.date.getTime() === selectedDay.date.getTime()
    );

    if (currentIndex === -1) return;

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= windyDays.length) return;

    const newDay = windyDays[newIndex];
    await handleDaySelect(newDay);
  }, [selectedDay, windyDays, handleDaySelect]);


  const tooltipTimerRef = useRef<number | null>(null);

  const hideTooltip = useCallback(() => {
    const tooltipEl = document.getElementById('chartjs-tooltip');
    if (tooltipEl) {
      tooltipEl.style.opacity = '0';
    }
  }, []);

  const customTooltip = useCallback((args: { chart: any; tooltip: any }) => {
    const { chart, tooltip } = args;

    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    let tooltipEl = document.getElementById('chartjs-tooltip');

    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chartjs-tooltip';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.background = 'rgba(255, 255, 255, 0.4)';
      tooltipEl.style.backdropFilter = 'blur(4px)';
      // @ts-ignore
      tooltipEl.style.WebkitBackdropFilter = 'blur(4px)';
      tooltipEl.style.border = '1px solid rgba(0, 0, 0, 0.2)';
      tooltipEl.style.borderRadius = '3px';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.transition = 'all .1s ease';
      tooltipEl.style.fontFamily = 'Arial, sans-serif';
      tooltipEl.style.fontSize = '12px';
      tooltipEl.style.color = '#000';
      tooltipEl.style.padding = '8px';
      tooltipEl.style.zIndex = '100';
      document.body.appendChild(tooltipEl);
    }

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    if (tooltip.body) {
      const dataIndex = tooltip.dataPoints[0].dataIndex;
      const day = windyDays[dataIndex];
      const dateFormatted = format(day.date, 'EEEE, d MMM yyyy', { locale: sv });

      let innerHtml = `<div><strong>${dateFormatted}</strong></div>`;

      // Wind direction
      if (day.windDirection) {
        const windDir = day.windDirection;
        const windDirText = `${windDir.toFixed(0)}°`;
        const arrowRotation = windDir + 180;
        const arrowSvg = `
          <svg width="16" height="16" style="transform: rotate(${arrowRotation}deg);">
            <line x1="8" y1="2" x2="8" y2="14" stroke="black" stroke-width="2"/>
            <line x1="8" y1="2" x2="4" y2="6" stroke="black" stroke-width="2"/>
            <line x1="8" y1="2" x2="12" y2="6" stroke="black" stroke-width="2"/>
          </svg>
        `;
        innerHtml += `<div style="margin-top: 4px; display: flex; align-items: center;">`;
        innerHtml += `<span>Riktning: ${windDirText}</span>`;
        innerHtml += `<span style="margin-left: 4px;">${arrowSvg}</span></div>`;
      }


      tooltip.dataPoints.forEach((dataPoint: any) => {
        const datasetLabel = dataPoint.dataset.label;
        const value = dataPoint.raw.toFixed(1);
        // Actually in WindOverview borderColor is a function. We might need to handle this.
        // For simplicity, let's just use a representative color or evaluate it?
        // The borderColor function in chartData depends on context.
        // Let's just use static colors matching the logic for the marker.

        let markerColor = '#999';
        if (datasetLabel === 'Byvind') {
          if (dataPoint.raw >= 15) markerColor = '#ad3c1f';
          else if (dataPoint.raw >= 12) markerColor = '#a55c3b';
          else markerColor = '#49654c96';
        } else {
          if (dataPoint.raw >= 10) markerColor = '#005b2f';
          else if (dataPoint.raw >= 7) markerColor = '#0b7c46';
          else if (dataPoint.raw >= 5) markerColor = '#388957';
          else markerColor = '#49654c96';
        }

        const marker = `<span style="display:inline-block;width:10px;height:10px;background-color:${markerColor};margin-right:5px;border-radius:50%;"></span>`;
        innerHtml += `<div>${marker}${datasetLabel}: ${value} m/s</div>`;
      });

      tooltipEl.innerHTML = innerHtml;
    }

    const position = chart.canvas.getBoundingClientRect();
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = position.left + window.pageXOffset + tooltip.caretX - tooltipEl.offsetWidth / 2 + 'px';
    tooltipEl.style.top = position.top + window.pageYOffset + tooltip.caretY - tooltipEl.offsetHeight - 10 + 'px';

    tooltipTimerRef.current = window.setTimeout(hideTooltip, 3000);
  }, [windyDays, hideTooltip]);

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
  if (selectedYear !== 0) {
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
  if (selectedYear === 0) {
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
    onClick: handleChartClick,
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
        beginAtZero: false,
        min: 8,
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
          y: { min: 8, max: 35 }
        },
      },
      tooltip: {
        enabled: false,
        external: customTooltip,
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Översikt - dagar över 10 m/s</h2>
        <p className="text-gray-600 text-sm mt-1">
          {selectedYear !== 0
            ? `Visar alla dagar med vind över 10 m/s under ${selectedYear}, sorterade efter datum.`
            : 'Visar alla dagar med vind över 10 m/s över alla år, sorterade efter datum.'} Klicka på en punkt för att se detaljerad data för den dagen.
        </p>

        <div className="flex gap-2 mt-4 flex-wrap">
          <button
            onClick={() => handleYearSelect(null)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedYear === 0
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Alla år
          </button>
          {[2020, 2021, 2022, 2023, 2024, 2025].map(year => (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedYear === year
                ? 'bg-green-600 text-white'
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
      ) : (
        <div className="p-4">
          <div className="mb-4">
            <button
              onClick={() => chartRef.current?.resetZoom()}
              className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 float-right"
            >
              Återställ zoom
            </button>
          </div>
          <div className="h-[350px] relative clear-both">
            <Line ref={chartRef} data={chartData} options={options} />
          </div>

          {/* Add stats section */}
          <WindStats
            bestDay={windyDays.length > 0 ?
              {
                date: [...windyDays].sort((a, b) => b.maxWindSpeed - a.maxWindSpeed)[0].date,
                maxWindSpeed: [...windyDays].sort((a, b) => b.maxWindSpeed - a.maxWindSpeed)[0].maxWindSpeed
              } : null}
            totalDays={windyDays.length}
            topDays={[...windyDays]
              .sort((a, b) => b.maxWindSpeed - a.maxWindSpeed)
              .slice(0, 5)
              .map(day => ({
                date: day.date,
                maxWindSpeed: day.maxWindSpeed
              }))}
            bestYear={yearStats.length > 0 ? yearStats[0].year : undefined}
            bestYearDays={yearStats.length > 0 ? yearStats[0].count : undefined}
            fetch24HourData={fetch24HourData}
            onDaySelect={async (day) => {
              const hourlyData = await fetch24HourData(day.date);
              const updatedDay: BinnedWindData = {
                ...day,
                hourlyData
              };
              setSelectedDay(updatedDay);
              onDateSelect(day.date);
            }}
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
          />
        </div>
      )}
    </div>
  );
} 