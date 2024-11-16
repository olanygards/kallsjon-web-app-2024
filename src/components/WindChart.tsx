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
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { WindData } from '../types/WindData';
import { ForecastData } from '../types/forecast';
import { useMemo } from 'react';

// Registrera Chart.js komponenter
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

interface WindChartProps {
  windData: WindData[];
  forecastData?: ForecastData[];
  title: string;
  timeRange: number;
}

const getGustColor = (windGust: number): string => {
  if (!windGust || windGust < 0) return '#a02109';
  if (windGust >= 25.0) return '#ad3c1f'; 
  if (windGust >= 23.5) return '#a55c3b'; 
  if (windGust >= 20.0) return '#005b2f'; 
  if (windGust >= 18.5) return '#00703a'; 
  if (windGust >= 17.0) return '#0b7c46'; 
  if (windGust >= 16.5) return '#388957';  
  if (windGust >= 15.0) return '#49654c96';  
  return 'rgb(230, 230, 230)'; // default gust color
};

const getWindColor = (windSpeed: number): string => {
  if (!windSpeed || windSpeed < 0) return '#a02109';
  if (windSpeed >= 14.0) return '#ad3c1f'; 
  if (windSpeed >= 13.5) return '#a55c3b'; 
  if (windSpeed >= 12.0) return '#005b2f'; 
  if (windSpeed >= 11.5) return '#00703a'; 
  if (windSpeed >= 11.0) return '#0b7c46'; 
  if (windSpeed >= 10.5) return '#388957';  
  if (windSpeed >= 10.0) return '#49654c96'; 
  return 'rgb(244, 244, 244)'; // default wind color
};

export function WindChart({ windData, forecastData = [], title = "Vindstyrka", timeRange = 1 }: WindChartProps) {
  const sortedWindData = useMemo(() => {
    if (!windData || !Array.isArray(windData)) return [];
    return [...windData]
      .filter(data => data && data.time && !isNaN(data.time.getTime()))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [windData]);
  
  const allData = useMemo(() => {
    if (!sortedWindData) return [];
    
    const combinedData = [
      ...sortedWindData,
      ...(forecastData || [])
        .filter(f => f && f.time && !isNaN(new Date(f.time).getTime()))
        .map(f => ({
          time: new Date(f.time),
          windSpeed: f.windSpeed || 0,
          windDirection: f.windDirection || 0,
          windGust: (f.windSpeed || 0) * 1.5,
          isForecast: true
        }))
    ];

    return combinedData
      .filter(data => data && data.time && !isNaN(data.time.getTime()))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [sortedWindData, forecastData]);

  const chartData = useMemo(() => ({
    labels: allData.map((data) => format(new Date(data.time), 'HH:mm')),
    datasets: [
      {
        label: 'Byvind',
        data: allData.map(d => d.windGust),
        borderColor: allData.map(d => getGustColor(d.windGust)),
        backgroundColor: allData.map(d => getGustColor(d.windGust)),
        tension: 0.1,
        pointRadius: 2,
        borderWidth: 2,
        segment: {
          borderColor: (ctx: any) => {
            if (!ctx.p0.parsed || !ctx.p1.parsed) return;
            const value1 = ctx.p0.parsed.y;
            const value2 = ctx.p1.parsed.y;
            return getGustColor(Math.max(value1, value2));
          },
        },
      },
      {
        label: 'Medelvind',
        data: allData.map(d => d.windSpeed),
        borderColor: allData.map(d => getWindColor(d.windSpeed)),
        backgroundColor: allData.map(d => getWindColor(d.windSpeed)),
        tension: 0.1,
        pointRadius: 2,
        borderWidth: 2,
        segment: {
          borderColor: (ctx: any) => {
            if (!ctx.p0.parsed || !ctx.p1.parsed) return;
            const value1 = ctx.p0.parsed.y;
            const value2 = ctx.p1.parsed.y;
            return getWindColor(Math.max(value1, value2));
          },
        },
      }
    ]
  }), [allData]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          title: function(tooltipItems: any) {
            const time = new Date(allData[tooltipItems[0].dataIndex].time);
            const isForecast = allData[tooltipItems[0].dataIndex].isForecast;
            return `${format(time, 'HH:mm EEE', { locale: sv })}${isForecast ? ' (Prognos)' : ''}`;
          },
          beforeBody: function(tooltipItems: any) {
            const dataPoint = allData[tooltipItems[0].dataIndex];
            if (dataPoint && dataPoint.windDirection) {
              const direction = dataPoint.windDirection;
              const directions = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
              const directionArrow = directions[Math.round(((direction % 360) / 45)) % 8];
              return `${direction}° ${directionArrow}`;
            }
            return '';
          },
          label: function(context: any) {
            const value = context.parsed.y;
            if (!value) return '';
            
            let result = '';
            if (context.dataset.label === 'Medelvind') {
              result = `Medelvind: ${value.toFixed(1)} m/s`;
            } else if (context.dataset.label === 'Byvind') {
              result = `Byvind: ${value.toFixed(1)} m/s`;
            }
            
            return result;
          }
        }
      },
      annotation: {
        annotations: {
          line1: {
            type: 'line' as const,
            xMin: sortedWindData.length - 0.5,
            xMax: sortedWindData.length - 0.5,
            borderColor: 'rgb(169, 169, 169)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              content: 'Prognos →',
              position: 'center' as const
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 30,
        min: 0,
        title: {
          display: true,
          text: 'Vindstyrka (m/s)'
        },
        grid: {
          color: (ctx: any) => {
            if (ctx.tick.value === 10 || ctx.tick.value === 15) {
              return 'rgba(255, 0, 0, 0.2)';
            }
            return 'rgba(0, 0, 0, 0.1)';
          },
          lineWidth: (ctx: any) => {
            if (ctx.tick.value === 10 || ctx.tick.value === 15) {
              return 1.5;
            }
            return 1;
          },
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          callback: function(_value: string | number, index: number) {
            const dataPoint = allData[index];
            return dataPoint?.time ? format(new Date(dataPoint.time), 'HH:mm') : '';
          }
        },
        grid: {
          display: false,
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    }
  }), [sortedWindData.length, allData, timeRange]);

  if (!allData.length) {
    return <div className="p-4 text-gray-500">Ingen data tillgänglig</div>;
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="relative h-[400px]">
        <Line 
          data={chartData}
          options={options}
        />
      </div>
    </div>
  );
}