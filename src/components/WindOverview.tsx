import { useState, useEffect, useCallback, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import 'chartjs-plugin-zoom';

interface WindOverviewProps {
  onDateSelect: (date: Date) => void;
}

interface BinnedWindData {
  date: Date;
  maxWindSpeed: number;
  windBin: '2-5' | '5-7' | '7-10' | '10+';
}

export function WindOverview({ onDateSelect }: WindOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [windyDays, setWindyDays] = useState<BinnedWindData[]>([]);
  const chartRef = useRef<any>(null);

  // Fetch windy days from Firestore
  useEffect(() => {
    async function fetchWindyDays() {
      try {
        setLoading(true);
        console.log('Fetching windy days...');
        const windRef = collection(db, 'wind');
        const q = query(
          windRef,
          where('force', '>=', 10),
          orderBy('force', 'desc'),
          limit(100)
        );

        const querySnapshot = await getDocs(q);
        console.log('Query snapshot size:', querySnapshot.size);
        const days: BinnedWindData[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Document data:', data);
          const date = data.time?.toDate();
          const maxWindSpeed = data.force;
          
          if (!date || typeof maxWindSpeed !== 'number') {
            console.warn('Invalid data structure:', { date, maxWindSpeed });
            return;
          }
          
          let windBin: BinnedWindData['windBin'];
          if (maxWindSpeed >= 10) windBin = '10+';
          else if (maxWindSpeed >= 7) windBin = '7-10';
          else if (maxWindSpeed >= 5) windBin = '5-7';
          else windBin = '2-5';

          days.push({ date, maxWindSpeed, windBin });
        });

        console.log('Processed days:', days);
        setWindyDays(days.sort((a, b) => a.date.getTime() - b.date.getTime()));
      } catch (err) {
        console.error('Error fetching windy days:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch windy days'));
      } finally {
        setLoading(false);
      }
    }

    fetchWindyDays();
  }, []);

  const handleClick = useCallback((event: any, elements: any[]) => {
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
        label: 'Max vindhastighet',
        data: windyDays.map(day => day.maxWindSpeed),
        borderColor: (context: any) => {
          const value = context.raw;
          if (value >= 10) return '#ad3c1f';
          if (value >= 7) return '#005b2f';
          if (value >= 5) return '#0b7c46';
          return '#49654c96';
        },
        segment: {
          borderColor: (context: any) => {
            const value = Math.max(
              context.p0.parsed.y || 0,
              context.p1.parsed.y || 0
            );
            if (value >= 10) return '#ad3c1f';
            if (value >= 7) return '#005b2f';
            if (value >= 5) return '#0b7c46';
            return '#49654c96';
          },
        },
        tension: 0.1,
        pointRadius: 3,
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
        max: 30,
        title: {
          display: true,
          text: 'Vindstyrka (m/s)',
        },
      },
    },
    plugins: {
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
          x: { min: 'original', max: 'original' },
          y: { min: 0, max: 30 },
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        Ett fel uppstod: {error.message}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Översikt - Blåsiga dagar</h2>
        <p className="text-gray-600 text-sm mt-1">
          Visar de 100 blåsigaste dagarna sedan 2019. Klicka på en punkt för att se detaljerad data för den dagen.
          Zooma och panorera med mushjulet eller dra för att zooma in på ett område.
        </p>
      </div>
      <div className="p-4">
        <div className="h-[500px] relative">
          <button
            onClick={() => {
              const chart = chartRef.current;
              if (chart) {
                chart.resetZoom();
              }
            }}
            className="absolute top-2 right-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
          >
            Återställ zoom
          </button>
          <Line ref={chartRef} data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
} 