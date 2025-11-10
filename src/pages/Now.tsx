import { useWindData } from '../hooks/useWindData';
import { WindChart } from '../components/WindChart';
import { Header } from '../components/Header';
import { useMemo } from 'react';
import { format, subHours } from 'date-fns';
import { sv } from 'date-fns/locale';

function getDirectionArrow(direction: number): string {
  if (direction < 22.5 || direction >= 337.5) return "↓";
  if (direction >= 22.5 && direction < 67.5) return "↙";
  if (direction >= 67.5 && direction < 112.5) return "←";
  if (direction >= 112.5 && direction < 157.5) return "↖";
  if (direction >= 157.5 && direction < 202.5) return "↑";
  if (direction >= 202.5 && direction < 247.5) return "↗";
  if (direction >= 247.5 && direction < 292.5) return "→";
  return "↘";
}

export default function Now() {
  // Fetch last 24h of wind data for the 'Just nu' card
  const endDate = new Date();
  const startDate24h = subHours(endDate, 24);
  const { data: windData24h, loading, error } = useWindData({ startDate: startDate24h, endDate });

  // Fetch last 1h of wind data for the chart
  const startDate1h = subHours(endDate, 1);
  const { data: windData1h } = useWindData({ startDate: startDate1h, endDate });

  // Find the latest observed data point from 24h data
  const latest = useMemo(() => {
    if (!windData24h || windData24h.length === 0) return null;
    return windData24h.reduce((a, b) => (a.time > b.time ? a : b));
  }, [windData24h]);

  return (
    <div className="min-h-screen bg-kallsjon-green">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-[640px]">
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold mb-2 text-center">Just nu</div>
            {loading ? (
              <div className="text-gray-500">Laddar...</div>
            ) : error ? (
              <div className="text-red-500">Kunde inte ladda vinddata</div>
            ) : latest ? (
              <>
                <div className="text-3xl font-extrabold mb-1">Medelvind: <span className="text-kallsjon-green-dark">{latest.windSpeed.toFixed(0)}</span> m/s</div>
                <div className="text-xl font-semibold mb-1">Byvind: <span className="text-kallsjon-green-dark">{latest.windGust.toFixed(0)}</span> m/s</div>
                <div className="text-xl font-semibold mb-1">Riktning: <span className="text-kallsjon-green-dark">{latest.windDirection.toFixed(0)}° {getDirectionArrow(latest.windDirection)}</span></div>
                <div className="text-sm text-gray-500 mt-2">Senast uppmätt: {format(latest.time, 'HH:mm:ss dd MMM', { locale: sv })}</div>
              </>
            ) : (
              <div className="text-gray-500">Ingen data</div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-lg font-semibold mb-2">Vindstyrka senaste timmen</div>
          <div className="h-[350px]">
            <WindChart
              windData={windData1h}
              forecastData={[]}
              title="Vindstyrka"
              timeRange={0.1}
              zoomEnabled={true}
              variant="default"
              noCard
            />
          </div>
        </div>
      </main>
    </div>
  );
} 