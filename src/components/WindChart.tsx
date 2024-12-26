import { useMemo, useRef, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
  ChartOptions,
  TimeScale,
  Chart,
  TooltipModel,
  ScriptableLineSegmentContext,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import 'chartjs-adapter-date-fns';
import { WindData } from '../types/WindData';

// Register Chart.js components and plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTitle,
  ChartTooltip,
  Legend,
  annotationPlugin,
  TimeScale
);

interface WindChartProps {
  windData: WindData[];
  forecastData?: WindData[];
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

export function WindChart({
  windData,
  forecastData = [],
  title = 'Vindstyrka',
  timeRange = 1,
}: WindChartProps) {
  // Combine and sort the data
  const allData = useMemo(() => {
    const combinedData = [
      ...windData.map((d) => ({
        ...d,
        isForecast: false,
        estimatedWindGust:
          d.windGust !== null && d.windGust !== undefined ? d.windGust : d.windSpeed * 1.5,
      })),
      ...forecastData.map((d) => ({
        ...d,
        isForecast: true,
        estimatedWindGust:
          d.windGust !== null && d.windGust !== undefined ? d.windGust : d.windSpeed * 1.5,
      })),
    ];
    return combinedData
      .filter((d) => d && d.time && !isNaN(d.time.getTime()))
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [windData, forecastData]);

  // Find the start time of the forecast data
  const forecastStartTime = useMemo(() => {
    if (!forecastData.length) return null;
    const times = forecastData
      .filter((d) => d && d.time && !isNaN(d.time.getTime()))
      .map((d) => d.time.getTime());
    return new Date(Math.min(...times));
  }, [forecastData]);

  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: 'Byvind',
          data: allData.map((d) => ({
            x: d.time,
            y: typeof d.windGust === 'number' ? d.windGust : null,
            isForecast: d.isForecast,
            windDirection: d.windDirection,
            windSpeed: d.windSpeed,
            windGust: d.windGust,
            estimatedWindGust: d.estimatedWindGust,
          })),
          borderColor: 'rgba(0,0,0,0)', // Transparent, we'll use segment coloring
          backgroundColor: 'rgba(0,0,0,0)',
          tension: 0.1,
          pointRadius: 0,
          pointHitRadius: 10, // Increase hit radius for better tooltip activation
          borderWidth: 2,
          spanGaps: true, // Allow lines between points with irregular intervals
          segment: {
            borderColor: (ctx: ScriptableLineSegmentContext) => {
              if (!ctx.p0?.parsed || !ctx.p1?.parsed) return undefined;
              const value1 = ctx.p0.parsed.y;
              const value2 = ctx.p1.parsed.y;
              return getGustColor(Math.max(value1 || 0, value2 || 0));
            },
            borderDash: (ctx: ScriptableLineSegmentContext) => 
              ((ctx.p1 as any)?.raw?.isForecast ? [5, 5] : []),
          },
        },
        {
          label: 'Medelvind',
          data: allData.map((d) => ({
            x: d.time,
            y: typeof d.windSpeed === 'number' ? d.windSpeed : null,
            isForecast: d.isForecast,
            windDirection: d.windDirection,
            windSpeed: d.windSpeed,
            windGust: d.windGust,
            estimatedWindGust: d.estimatedWindGust,
          })),
          borderColor: 'rgba(0,0,0,0)',
          backgroundColor: 'rgba(0,0,0,0)',
          tension: 0.1,
          pointRadius: 0,
          pointHitRadius: 10, // Increase hit radius for better tooltip activation
          borderWidth: 2,
          spanGaps: true,
          segment: {
            borderColor: (ctx: ScriptableLineSegmentContext) => {
              const data = ctx.p1.parsed.y !== null ? ctx.p1 : ctx.p0;
              return getWindColor((data as any).raw.windSpeed);
            },
            borderDash: (ctx: ScriptableLineSegmentContext) => 
              ((ctx.p1 as any)?.raw?.isForecast ? [5, 5] : []),
          },
        },
      ],
    }),
    [allData]
  );

  const chartRef = useRef(null);

  // Custom Tooltip
  const customTooltip = (args: { 
    chart: Chart; 
    tooltip: TooltipModel<'line'>
  }) => {
    const { chart, tooltip } = args;
    // Tooltip Element
    let tooltipEl = document.getElementById('chartjs-tooltip');

    // Create element on first render
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'chartjs-tooltip';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.background = 'rgba(255, 255, 255, 0.9)';
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

    // Hide if no tooltip
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }

    // Set Text
    if (tooltip.body) {
      const dataPoint = tooltip.dataPoints[0].raw as {
        x: Date;
        isForecast: boolean;
        windDirection: number;
        y: number | null;
      };
      const date = dataPoint.x;
      const isForecast = dataPoint.isForecast;

      const dateFormatted = format(date, 'EEEE, d MMM', { locale: sv });
      const timeFormatted = format(date, 'HH:mm');
      const dataType = isForecast ? 'Prognos' : 'Observerad';

      // Build the title
      let innerHtml = `<div><strong>${dateFormatted}</strong></div>`;
      innerHtml += `<div>${dataType}: ${timeFormatted}</div>`;

      // Get wind direction
      const windDir = dataPoint.windDirection;
      const windDirText = `${windDir.toFixed(0)}°`;

      // Correct the arrow rotation
      const arrowRotation = windDir + 180; // Adjust rotation so 0° points upwards

      // Create arrow using inline SVG
      const arrowSvg = `
          <svg width="16" height="16" style="transform: rotate(${arrowRotation}deg);">
            <line x1="8" y1="2" x2="8" y2="14" stroke="black" stroke-width="2"/>
            <line x1="8" y1="2" x2="4" y2="6" stroke="black" stroke-width="2"/>
            <line x1="8" y1="2" x2="12" y2="6" stroke="black" stroke-width="2"/>
          </svg>
      `;

      // Build wind direction display
// Build wind direction display with arrow after text
innerHtml += `<div style="margin-top: 4px; display: flex; align-items: center;">`;
innerHtml += `<span>Riktning: ${windDirText}</span>`;
innerHtml += `<span style="margin-left: 4px;">${arrowSvg}</span></div>`;

      // Include Byvind and Medelvind
      tooltip.dataPoints.forEach((dataPoint) => {
        const datasetLabel = dataPoint.dataset.label;
        const value = (dataPoint.raw as { y: number | null }).y != null &&
                      !isNaN((dataPoint.raw as { y: number | null }).y!)
                      ? ((dataPoint.raw as { y: number | null }).y!).toFixed(1)
                      : '-';
        innerHtml += `<div>${datasetLabel}: ${value} m/s</div>`;
      });

      tooltipEl.innerHTML = innerHtml;
    }

    const position = chart.canvas.getBoundingClientRect();

    // Display, position, and set styles
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left =
      position.left + window.pageXOffset + tooltip.caretX - tooltipEl.offsetWidth / 2 + 'px';
    tooltipEl.style.top =
      position.top + window.pageYOffset + tooltip.caretY - tooltipEl.offsetHeight - 10 + 'px';
  };

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index', // Use 'index' mode to show all datasets at a given x-axis value
        intersect: false,
      },
      hover: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          type: 'time',
          time: {
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM d',
            },
          },
          ticks: {
            maxRotation: 60,
            minRotation: 60,
            autoSkip: true,
            source: 'auto',
            callback: function (value, index, ticks) {
              const date = new Date(value as number);
              const previousTick = ticks[index - 1];
              const previousDate = previousTick ? new Date(previousTick.value as number) : null;

              // Show date label if the day changes
              if (!previousDate || date.getDate() !== previousDate.getDate()) {
                return format(date, 'd MMM', { locale: sv });
              }

              // Adjust label frequency based on timeRange
              if (timeRange === 1) {
                if (date.getHours() % 1 === 0 && date.getMinutes() === 0) {
                  return format(date, 'HH:mm');
                }
              } else if (timeRange <= 3) {
                if (date.getHours() % 3 === 0 && date.getMinutes() === 0) {
                  return format(date, 'HH:mm');
                }
              } else {
                if (date.getHours() % 6 === 0 && date.getMinutes() === 0) {
                  return format(date, 'HH:mm');
                }
              }

              return '';
            },
          },
          grid: {
            display: true,
            drawBorder: true,
          },
        },
        y: {
          beginAtZero: true,
          max: 30,
          min: 0,
          title: {
            display: true,
            text: 'Vindstyrka (m/s)',
          },
          grid: {
            color(ctx) {
              if (ctx.tick.value === 10 || ctx.tick.value === 15) {
                return 'rgba(255, 0, 0, 0.2)';
              }
              return 'rgba(0, 0, 0, 0.1)';
            },
            lineWidth(ctx) {
              if (ctx.tick.value === 10 || ctx.tick.value === 15) {
                return 1.5;
              }
              return 1;
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false, // Disable the default tooltip
          external: customTooltip,
        },
        annotation: {
          annotations:
            forecastStartTime && windData.length > 0
              ? {
                  forecastLine: {
                    type: 'line',
                    xMin: forecastStartTime.getTime(),
                    xMax: forecastStartTime.getTime(),
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    label: {
                      content: 'Prognos börjar',
                      enabled: true,
                      position: '80%',
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                    },
                  },
                }
              : {},
        },
      },
    }),
    [customTooltip, allData, timeRange, forecastStartTime, windData]
  );

  useEffect(() => {
    // Cleanup the tooltip element when the component unmounts
    return () => {
      const tooltipEl = document.getElementById('chartjs-tooltip');
      if (tooltipEl) {
        document.body.removeChild(tooltipEl);
      }
    };
  }, []);

  if (!allData.length) {
    return <div className="p-4 text-gray-500">Ingen data tillgänglig</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4 dark:text-white">{title}</h2>
      <div className="relative h-[400px]">
        <Line ref={chartRef} data={chartData} options={{
          ...options,
          scales: {
            ...(options?.scales ?? {}),
            x: {
              ...(options?.scales?.x ?? {}),
              ticks: {
                ...(options?.scales?.x?.ticks ?? {}),
                color: '#E5E7EB',
              },
              grid: {
                ...(options?.scales?.x?.grid ?? {}),
                color: 'rgba(255, 255, 255, 0.1)',
              },
            },
            y: {
              ...(options?.scales?.y ?? {}),
              ticks: {
                ...(options?.scales?.y?.ticks ?? {}),
                color: '#E5E7EB',
              },
              grid: {
                ...(options?.scales?.y?.grid ?? {}),
                color: 'rgba(255, 255, 255, 0.1)',
              },
            },
          },
          plugins: {
            ...(options?.plugins ?? {}),
            legend: {
              ...(options?.plugins?.legend ?? {}),
              labels: {
                color: '#E5E7EB',
              },
            },
          },
        }} />
      </div>
    </div>
  );
}