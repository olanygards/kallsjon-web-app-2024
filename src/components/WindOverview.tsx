import { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format, startOfYear, endOfYear } from 'date-fns';
import { sv } from 'date-fns/locale';
import 'chartjs-plugin-zoom';

interface WindOverviewProps {
  onDateSelect: (date: Date) => void;
}

interface BinnedWindData {
  date: Date;
  maxWindSpeed: number;
  maxGust: number;
  windBin: '2-5' | '5-7' | '7-10' | '10+';
}

export function WindOverview({ onDateSelect }: WindOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [windyDays, setWindyDays] = useState<BinnedWindData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [cachedData, setCachedData] = useState<Map<number | null, BinnedWindData[]>>(new Map());
  const chartRef = useRef<any>(null);

  async function fetchWindyDays(year: number | null) {
    // Check cache first - modified to check for empty arrays
    const cached = cachedData.get(year);
    if (cached && cached.length > 0) {
      console.log(`Using cached data for ${year ? year : "all years"}`);
      setWindyDays(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`Fetching windy days for ${year ? `year ${year}` : "all years"}...`);
      
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
          where('force', '>=', 10),
          orderBy('time', 'asc') // Keep chronological for year view
        );
      } else {
        // Fetch the top 100 windiest days across all years
        q = query(
          windRef,
          where('force', '>=', 10),
          orderBy('force', 'desc'),  // Order by highest wind speed
          orderBy('time', 'asc'),    // Secondary sort by time
          limit(100)                 // Get the top 100
        );
      }

      const querySnapshot = await getDocs(q);
      console.log('Query snapshot size:', querySnapshot.size);

      const days: BinnedWindData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.time?.toDate();
        const maxWindSpeed = data.force;
        const maxGust = data.forceMax;

        if (!date || typeof maxWindSpeed !== 'number' || typeof maxGust !== 'number') {
          console.warn('Invalid data structure:', { date, maxWindSpeed, maxGust });
          return;
        }

        let windBin: BinnedWindData['windBin'];
        if (maxWindSpeed >= 10) windBin = '10+';
        else if (maxWindSpeed >= 7) windBin = '7-10';
        else if (maxWindSpeed >= 5) windBin = '5-7';
        else windBin = '2-5';

        days.push({ date, maxWindSpeed, maxGust, windBin });
      });

      // Always sort chronologically
      const sortedDays = days.sort((a, b) => a.date.getTime() - b.date.getTime());

      console.log('Processed days:', sortedDays);

      // Store in cache only if we have data
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

  const handleYearSelect = (year: number | null) => {
    setWindyDays([]); // Clear old data first
    setLoading(true); // Show loading state
    setSelectedYear(year);
  };

  const handleClick = useCallback((_event: any, elements: any[]) => {
    if (elements.length > 0) {
      const dataIndex = elements[0].index;
      const selectedDay = windyDays[dataIndex];
      onDateSelect(selectedDay.date);
    }
  }, [windyDays, onDateSelect]);

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
        tension: 0.1,
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
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
        order: 2
      },
    ],
  };

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
        display: true,
        position: 'top' as const,
      },
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
            ? `Visar alla dagar med vind över 10 m/s under ${selectedYear}.`
            : 'Visar de 100 blåsigaste dagarna över alla år.'} Klicka på en punkt för att se detaljerad data för den dagen.
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
          {[2019, 2020, 2021, 2022, 2023, 2024].map(year => (
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
          <div className="h-[500px] relative">
            <button
              onClick={() => chartRef.current?.resetZoom()}
              className="absolute top-2 right-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
            >
              Återställ zoom
            </button>
            <Line ref={chartRef} data={chartData} options={options} />
          </div>
        </div>
      )}
    </div>
  );
} 