import { useMemo, useRef, useEffect, useCallback } from 'react';
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
  Plugin,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { format, startOfDay, endOfDay, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import 'chartjs-adapter-date-fns';
import { WindData, ForecastDataset } from '../types/WindData';

const KALLSJON_LAT = 63.4;
const KALLSJON_LNG = 13.2;

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
  TimeScale,
  zoomPlugin
);

interface WindChartProps {
  windData: WindData[];
  forecastData?: WindData[]; // Legacy prop, kept for backward compatibility
  forecastDatasets?: ForecastDataset[]; // New prop for multi-model support
  title: string;
  timeRange: number;
  zoomEnabled?: boolean;
  variant?: 'default' | 'experiment';
  noCard?: boolean;
}

/**
 * Sätter alpha-kanal på färg oavsett format (#RRGGBB, #RRGGBBAA, rgb(...), rgba(...))
 */
const withAlpha = (color: string, alpha: number): string => {
  // #RRGGBB
  if (/^#([0-9a-f]{6})$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // #RRGGBBAA
  if (/^#([0-9a-f]{8})$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // rgb(...) eller rgba(...)
  const m = color.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map(v => parseFloat(v.trim()));
    const [r, g, b] = parts;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Fallback
  return color;
};

const UNDER_GUST_COLOR = '#c8c8c8'; // < 15 m/s, grå
const UNDER_WIND_COLOR = '#c8c8c8'; // < 10 m/s, grå

/**
 * Injicerar brytpunkter vid tröskelkorsningar för exakt färgbyte
 */
function insertThresholdCrossings<T extends {
  time: Date;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  isForecast: boolean;
  estimatedWindGust?: number;
}>(
  arr: T[],
  yKey: 'windSpeed' | 'windGust',
  threshold: number
): T[] {
  if (arr.length < 2) return arr;

  const out: T[] = [];

  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i];
    const b = arr[i + 1];
    out.push(a);

    const y0 = a[yKey] as number | null;
    const y1 = b[yKey] as number | null;
    if (y0 == null || y1 == null) continue;

    // Kollar om segmentet korsar tröskeln (olika tecken på skillnaden)
    const crosses = (y0 - threshold) * (y1 - threshold) < 0;

    if (crosses) {
      const t0 = a.time.getTime();
      const t1 = b.time.getTime();
      const t = (threshold - y0) / (y1 - y0); // 0..1
      const x = new Date(t0 + t * (t1 - t0));

      // Skapa inskjuten punkt vid exakt threshold
      const inserted: T = {
        ...b,
        time: x,
        [yKey]: threshold,
      } as T;

      out.push(inserted);
    }
  }

  // Lägg till sista punkten
  out.push(arr[arr.length - 1]);

  // Håll tidsordning
  out.sort((p, q) => p.time.getTime() - q.time.getTime());

  return out;
}

const getGustColor = (windGust: number): string => {
  // Ogiltig data
  if (!windGust || windGust < 0) return '#a02109';

  // Stark vind (röd-grön skala) - rensade från inbakad alpha
  if (windGust >= 25.0) return '#ad3c1f';
  if (windGust >= 23.5) return '#a55c3b';
  if (windGust >= 20.0) return '#005b2f';
  if (windGust >= 18.5) return '#00703a';
  if (windGust >= 17.0) return '#0b7c46';
  if (windGust >= 16.5) return '#388957';
  if (windGust >= 15.0) return '#49654c';  // Borttaget 96 (alpha)

  // UNDER 15 m/s = grå
  return UNDER_GUST_COLOR;
};

const getWindColor = (windSpeed: number): string => {
  // Ogiltig data
  if (!windSpeed || windSpeed < 0) return '#a02109';

  // Stark vind (röd-grön skala) - rensade från inbakad alpha
  if (windSpeed >= 14.0) return '#ad3c1f';
  if (windSpeed >= 13.5) return '#a55c3b';
  if (windSpeed >= 12.0) return '#005b2f';
  if (windSpeed >= 11.5) return '#00703a';
  if (windSpeed >= 11.0) return '#0b7c46';
  if (windSpeed >= 10.5) return '#388957';
  if (windSpeed >= 10.0) return '#49654c';  // Borttaget 96 (alpha)

  // UNDER 10 m/s = grå
  return UNDER_WIND_COLOR;
};

export function WindChart({
  windData,
  forecastData = [],
  forecastDatasets = [],
  title = 'Vindstyrka',
  timeRange = 1,
  zoomEnabled = false,
  variant = 'default',
  noCard = false,
}: WindChartProps) {

  // Determine if we should use the multi-model comparison view
  // This is true if we have explicitly passed forecastDatasets and there are more than 1 model (plus potentially observed)
  const forecastModelsCount = forecastDatasets.filter(d => d.modelId !== 'observed').length;
  const isComparisonView = forecastModelsCount > 1;

  // Combine and sort the data for the Gradient View (Legacy / Single Model)
  const gradientData = useMemo(() => {
    if (isComparisonView) return []; // Not used in comparison view

    // If we have forecastDatasets but only 1, we can extract data from it to use in gradient view
    // or fallback to forecastData prop.
    let effectiveForecastData = forecastData;
    if (forecastDatasets.length > 0 && forecastData.length === 0) {
      // Extract from the single dataset
      const ds = forecastDatasets.find(d => d.modelId !== 'observed');
      if (ds) {
        effectiveForecastData = ds.data.map(p => ({
          time: new Date(p.time),
          windSpeed: p.wind,
          windGust: p.gust ?? p.wind * 1.5,
          windDirection: p.dir ?? 0,
          isForecast: true
        }));
      }
    }

    const combinedData = [
      ...windData.map((d) => ({
        ...d,
        isForecast: false,
        estimatedWindGust:
          d.windGust !== null && d.windGust !== undefined ? d.windGust : d.windSpeed * 1.5,
      })),
      ...effectiveForecastData.map((d) => ({
        ...d,
        isForecast: true,
        estimatedWindGust:
          d.windGust !== null && d.windGust !== undefined ? d.windGust : d.windSpeed * 1.5,
      })),
    ];
    return combinedData
      .filter((d) => d && d.time && !isNaN(d.time.getTime()))
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [windData, forecastData, forecastDatasets, isComparisonView]);

  // Skapa datasets med inskjutna brytpunkter vid tröskelkorsningar (för Gradient View)
  const processedForGust = useMemo(
    () => isComparisonView ? [] : insertThresholdCrossings(gradientData, 'windGust', 15),
    [gradientData, isComparisonView]
  );

  const processedForMean = useMemo(
    () => isComparisonView ? [] : insertThresholdCrossings(gradientData, 'windSpeed', 10),
    [gradientData, isComparisonView]
  );

  // Find the start time of the forecast data
  const forecastStartTime = useMemo(() => {
    if (isComparisonView) {
      // In comparison view, find earliest forecast point
      const allForecastPoints = forecastDatasets
        .filter(ds => ds.modelId !== 'observed')
        .flatMap(ds => ds.data)
        .map(p => new Date(p.time).getTime());

      if (allForecastPoints.length === 0) return null;
      return new Date(Math.min(...allForecastPoints));
    } else {
      // Legacy
      const effectiveForecastData = forecastDatasets.length > 0 && forecastData.length === 0
        ? forecastDatasets.find(d => d.modelId !== 'observed')?.data.map(p => ({ time: new Date(p.time) })) || []
        : forecastData;

      if (!effectiveForecastData.length) return null;
      const times = effectiveForecastData
        .filter((d) => d && d.time && !isNaN(d.time.getTime()))
        .map((d) => d.time.getTime());
      return new Date(Math.min(...times));
    }
  }, [forecastData, forecastDatasets, isComparisonView]);

  // Calculate night periods for shading
  const nightPeriods = useMemo(() => {
    // Base this on the full range of data displayed
    let minTime: number, maxTime: number;

    if (isComparisonView) {
      const allTimes = forecastDatasets.flatMap(ds => ds.data.map(p => new Date(p.time).getTime()));
      if (windData.length) allTimes.push(...windData.map(d => d.time.getTime()));

      if (allTimes.length === 0) return [];
      minTime = Math.min(...allTimes);
      maxTime = Math.max(...allTimes);
    } else {
      if (!gradientData.length) return [];
      const times = gradientData.map(d => d.time.getTime());
      minTime = Math.min(...times);
      maxTime = Math.max(...times);
    }

    const periods: Array<{ start: Date; end: Date }> = [];
    let currentDay = startOfDay(new Date(minTime));
    const lastDay = endOfDay(new Date(maxTime));

    // Generate night periods for each day in the range
    while (currentDay <= lastDay) {
      const sunrise = getSunrise(KALLSJON_LAT, KALLSJON_LNG, currentDay);
      const sunset = getSunset(KALLSJON_LAT, KALLSJON_LNG, currentDay);

      // Night period before sunrise (from start of day to sunrise)
      if (startOfDay(currentDay) < sunrise) {
        periods.push({
          start: new Date(Math.max(startOfDay(currentDay).getTime(), minTime)),
          end: new Date(Math.min(sunrise.getTime(), maxTime)),
        });
      }

      // Night period after sunset (from sunset to end of day)
      if (sunset < endOfDay(currentDay)) {
        periods.push({
          start: new Date(Math.max(sunset.getTime(), minTime)),
          end: new Date(Math.min(endOfDay(currentDay).getTime(), maxTime)),
        });
      }

      currentDay = addDays(currentDay, 1);
    }

    return periods.filter(p => p.start < p.end);
  }, [gradientData, forecastDatasets, windData, isComparisonView]);

  const nightGradientPlugin = useMemo<Plugin<'line'>>(() => ({
    id: 'night-gradient-fill',
    beforeDatasetsDraw: (chart) => {
      if (!nightPeriods.length) return;
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x) return;

      const xScale = scales.x;
      const areaHeight = chartArea.bottom - chartArea.top;
      if (areaHeight <= 0) return;

      const isDarkMode = document.documentElement.classList.contains('dark');
      const fillColor = isDarkMode ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.08)';
      const fadeDurationMs = 60 * 60 * 1000; // 1 hour

      ctx.save();
      nightPeriods.forEach(period => {
        const startPixel = xScale.getPixelForValue(period.start.getTime());
        const endPixel = xScale.getPixelForValue(period.end.getTime());
        if (!isFinite(startPixel) || !isFinite(endPixel)) return;

        const left = Math.max(Math.min(startPixel, endPixel), chartArea.left);
        const right = Math.min(Math.max(startPixel, endPixel), chartArea.right);
        if (right <= left) return;

        const durationMs = Math.max(period.end.getTime() - period.start.getTime(), 1);
        const fadeRatio = Math.min(0.45, fadeDurationMs / durationMs);

        const gradient = ctx.createLinearGradient(left, 0, right, 0);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(Math.min(fadeRatio, 0.35), fillColor);
        gradient.addColorStop(Math.max(1 - fadeRatio, fadeRatio), fillColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(left, chartArea.top, right - left, areaHeight);
      });
      ctx.restore();
    }
  }), [nightPeriods]);

  // Add a ref for the timer
  const tooltipTimerRef = useRef<number | null>(null);

  // Create a function to hide tooltip
  const hideTooltip = useCallback(() => {
    const tooltipEl = document.getElementById('chartjs-tooltip');
    if (tooltipEl) {
      tooltipEl.style.opacity = '0';
    }
  }, []);

  const chartData = useMemo(() => {
    if (isComparisonView) {
      // Multi-model Comparison View
      const datasets: any[] = [];

      forecastDatasets.forEach(ds => {
        // For each model, we can show Mean and Gust.
        // To avoid clutter, maybe dashed for Gust and solid for Mean? 
        // Or just Mean?
        // Let's try showing both but with same color, different opacity/style.

        const isObserved = ds.modelId === 'observed';
        const baseColor = ds.color;

        // Mean Wind
        datasets.push({
          label: `${ds.modelName} (Medel)`,
          data: ds.data.map(p => ({
            x: new Date(p.time),
            y: p.wind,
            isForecast: !isObserved,
            windDirection: p.dir ?? 0,
            windSpeed: p.wind,
            windGust: p.gust,
            modelName: ds.modelName
          })),
          borderColor: baseColor,
          backgroundColor: baseColor,
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 10,
          borderWidth: 2,
          spanGaps: false,
        });

        // Gust (Dashed)
        datasets.push({
          label: `${ds.modelName} (Byvind)`,
          data: ds.data.map(p => ({
            x: new Date(p.time),
            y: p.gust,
            isForecast: !isObserved,
            windDirection: p.dir ?? 0,
            windSpeed: p.wind,
            windGust: p.gust,
            modelName: ds.modelName
          })),
          borderColor: withAlpha(baseColor, 0.6),
          backgroundColor: 'transparent',
          borderDash: [3, 3],
          tension: 0.3,
          pointRadius: 0,
          pointHitRadius: 10,
          borderWidth: 1.5,
          spanGaps: false,
          hidden: true // Hide gust by default in comparison view to reduce clutter? Or show? Let's show.
        });
      });

      return { datasets };

    } else {
      // Gradient View (Legacy)
      return {
        datasets: [
          {
            label: 'Byvind',
            data: processedForGust.map((d) => ({
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
            tension: 0, // RAK linje för exakt färgföljning
            pointRadius: 0,
            pointHitRadius: 10,
            borderWidth: variant === 'experiment' ? 1.5 : 2,
            spanGaps: false, // Undvik att dra linjer över gaps
            segment: {
              borderColor: (ctx: ScriptableLineSegmentContext) => {
                if (!ctx.p0?.parsed || !ctx.p1?.parsed) return undefined;

                const v0 = ctx.p0.parsed.y ?? null;
                const v1 = ctx.p1.parsed.y ?? null;
                if (v0 == null || v1 == null) return UNDER_GUST_COLOR;

                // Segment är "över" bara om BÅDA ändarna är >= 15 m/s
                const over = v0 >= 15 && v1 >= 15;

                // Använd färgskala för "över", annars grå
                const avg = (v0 + v1) / 2;
                const base = over ? getGustColor(avg) : UNDER_GUST_COLOR;

                // Prognos: applicera transparens med helper
                const isForecast = (ctx.p0 as any)?.raw?.isForecast || (ctx.p1 as any)?.raw?.isForecast;
                return isForecast ? withAlpha(base, 0.7) : base;
              },
            },
          },
          {
            label: 'Medelvind',
            data: processedForMean.map((d) => ({
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
            tension: 0, // RAK linje för exakt färgföljning
            pointRadius: 0,
            pointHitRadius: 10,
            borderWidth: variant === 'experiment' ? 1.5 : 2,
            spanGaps: false, // Undvik att dra linjer över gaps
            segment: {
              borderColor: (ctx: ScriptableLineSegmentContext) => {
                if (!ctx.p0?.parsed || !ctx.p1?.parsed) return undefined;

                const v0 = ctx.p0.parsed.y ?? null;
                const v1 = ctx.p1.parsed.y ?? null;
                if (v0 == null || v1 == null) return UNDER_WIND_COLOR;

                // Segment är "över" bara om BÅDA ändarna är >= 10 m/s
                const over = v0 >= 10 && v1 >= 10;

                // Använd färgskala för "över", annars grå
                const avg = (v0 + v1) / 2;
                const base = over ? getWindColor(avg) : UNDER_WIND_COLOR;

                // Prognos: applicera transparens med helper
                const isForecast = (ctx.p0 as any)?.raw?.isForecast || (ctx.p1 as any)?.raw?.isForecast;
                return isForecast ? withAlpha(base, 0.7) : base;
              },
            },
          },
        ],
      };
    }
  }, [processedForGust, processedForMean, variant, isComparisonView, forecastDatasets]);

  // Use the correct type for the chart ref with the actual data type
  const chartRef = useRef<any>(null);

  // Modify the customTooltip function
  const customTooltip = useCallback((args: {
    chart: Chart;
    tooltip: TooltipModel<'line'>
  }) => {
    const { chart, tooltip } = args;

    // Clear any existing timer
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

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
        modelName?: string;
      };
      const date = dataPoint.x;


      const dateFormatted = format(date, 'EEEE, d MMM', { locale: sv });
      const timeFormatted = format(date, 'HH:mm');

      // Build the title
      let innerHtml = `<div><strong>${dateFormatted}</strong></div>`;
      innerHtml += `<div>${timeFormatted}</div>`;

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

        const color = dataPoint.dataset.borderColor as string;
        const marker = `<span style="display:inline-block;width:10px;height:10px;background-color:${color};margin-right:5px;border-radius:50%;"></span>`;

        innerHtml += `<div>${marker}${datasetLabel}: ${value} m/s</div>`;
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

    // Set timer to hide tooltip after 3 seconds
    tooltipTimerRef.current = window.setTimeout(hideTooltip, 3000);
  }, [hideTooltip]);

  const options: ChartOptions<'line'> = useMemo(() => {
    const isExperiment = variant === 'experiment';

    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          left: 0,
          right: 10,
          top: 10,
          bottom: 0,
        },
      },
      interaction: {
        mode: 'index',
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
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'MMM d',
            },
            unit: timeRange <= 0.25 ? 'minute' : (isExperiment ? 'day' : 'hour'),
          },
          ticks: {
            color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#374151',
            autoSkip: timeRange > 0.25,
            maxTicksLimit: timeRange <= 0.25 ? 20 : (window.innerWidth < 768 ? 6 : undefined),
            padding: 5,
            callback: function (value, index, ticks) {
              const date = new Date(value as number);
              // Always show HH:mm for very short time ranges (like the Now page)
              if (timeRange <= 0.25) {
                return format(date, 'HH:mm');
              }
              const previousTick = ticks[index - 1];
              const previousDate = previousTick ? new Date(previousTick.value as number) : null;
              if (!previousDate || date.getDate() !== previousDate.getDate()) {
                return format(date, 'd MMM', { locale: sv });
              }
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
            color: isExperiment ? 'rgba(0, 0, 0, 0.1)' : undefined,
          },
        },
        y: {
          beginAtZero: !isExperiment,
          max: 30,
          min: isExperiment ? 8 : 0,
          title: {
            display: true,
            text: 'Vindstyrka (m/s)',
            padding: { top: 0, bottom: 5 },
          },
          ticks: {
            padding: 5,
          },
          grid: isExperiment ? {
            color: 'rgba(0, 0, 0, 0.1)',
            display: true,
          } : {
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
          display: isComparisonView || isExperiment, // Show legend in comparison view
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#374151',
          },
        },
        tooltip: {
          enabled: false,
          external: customTooltip,
        },
        zoom: zoomEnabled ? {
          pan: {
            enabled: true,
            mode: 'x',
            modifierKey: isExperiment ? undefined : 'ctrl',
            threshold: 10, // Add threshold for better touch control
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: isExperiment ? undefined : 'ctrl',
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
            mode: 'x',
          },
          limits: {
            x: { min: 'original', max: 'original' },
            y: { min: isExperiment ? 8 : 0, max: 30 },
          },
        } : undefined,
        annotation: isExperiment ? undefined : {
          annotations: {
            goodWind: {
              type: 'line',
              yMin: 10,
              yMax: 10,
              borderColor: 'rgba(34, 197, 94, 0.6)',
              borderWidth: 2,
              borderDash: [5, 5],
            },
            strongWind: {
              type: 'line',
              yMin: 15,
              yMax: 15,
              borderColor: 'rgba(239, 68, 68, 0.6)',
              borderWidth: 2,
              borderDash: [5, 5],
            },
            ...(forecastStartTime && (windData.length > 0 || isComparisonView)
              ? {
                forecastLine: {
                  type: 'line',
                  xMin: forecastStartTime.getTime(),
                  xMax: forecastStartTime.getTime(),
                  borderColor: 'rgba(156, 163, 175, 0.6)',
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
              : {}),
          },
        },
      },
    };
  }, [customTooltip, timeRange, forecastStartTime, windData.length, window.innerWidth, zoomEnabled, variant, isComparisonView]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current !== null) {
        window.clearTimeout(tooltipTimerRef.current);
      }
      const tooltipEl = document.getElementById('chartjs-tooltip');
      if (tooltipEl) {
        document.body.removeChild(tooltipEl);
      }
    };
  }, []);

  const handleResetZoom = useCallback(() => {
    if (chartRef.current) {
      // @ts-ignore - The resetZoom method is added by the zoom plugin at runtime
      // and is not included in the Chart type definition from chart.js
      chartRef.current.resetZoom();
    }
  }, []);

  if (!isComparisonView && !gradientData.length) {
    return <div className="p-4 text-gray-500">Ingen data tillgänglig</div>;
  }

  if (isComparisonView && !forecastDatasets.length && !windData.length) {
    return <div className="p-4 text-gray-500">Ingen data tillgänglig</div>;
  }

  const chartContent = (
    <div className="h-full w-full flex flex-col">
      {title && <h2 className="text-lg font-semibold mb-2 dark:text-white">{title}</h2>}
      <div className="relative flex-1 min-h-0 w-full">
        {zoomEnabled && (
          <button
            onClick={handleResetZoom}
            className="absolute top-2 right-2 px-3 py-1 bg-white text-kallsjon-green-dark rounded-md text-sm hover:bg-gray-50 border border-kallsjon-green z-10"
          >
            Återställ zoom
          </button>
        )}
        <div className="h-full w-full">
          <Line ref={chartRef} data={chartData} options={{
            ...options,
            scales: variant === 'experiment' ? options.scales : {
              ...(options?.scales ?? {}),
              x: {
                ...(options?.scales?.x ?? {}),
                ticks: {
                  ...(options?.scales?.x?.ticks ?? {}),
                  color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#374151',
                },
                grid: {
                  ...(options?.scales?.x?.grid ?? {}),
                  color: document.documentElement.classList.contains('dark')
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.1)',
                  display: true,
                },
              },
              y: {
                ...(options?.scales?.y ?? {}),
                ticks: {
                  ...(options?.scales?.y?.ticks ?? {}),
                  color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#374151',
                },
                grid: {
                  ...(options?.scales?.y?.grid ?? {}),
                  color: (ctx) => {
                    if (ctx.tick.value === 10 || ctx.tick.value === 15) {
                      return document.documentElement.classList.contains('dark')
                        ? 'rgba(255, 0, 0, 0.2)'
                        : 'rgba(255, 0, 0, 0.3)';
                    }
                    return document.documentElement.classList.contains('dark')
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)';
                  },
                  display: true,
                },
              },
            },
            plugins: variant === 'experiment' ? options.plugins : {
              ...(options?.plugins ?? {}),
              legend: {
                ...(options?.plugins?.legend ?? {}),
                labels: {
                  color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#374151',
                },
              },
            },
          }} plugins={[nightGradientPlugin]} className="h-full w-full" />
        </div>
      </div>
    </div>
  );

  return noCard ? (
    chartContent
  ) : (
    <div className="bg-white rounded-lg shadow px-3 py-3 w-full">
      <div className="h-[350px] w-full flex flex-col">
        {chartContent}
      </div>
    </div>
  );
}