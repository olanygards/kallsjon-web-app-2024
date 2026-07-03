import { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart2, X, ArrowUp, Compass } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getDirectionLabel } from '../../utils/windDataConverter';
import { APP_THEME, AVG_SURFABLE_MS } from '../../config/windScale';

import { MediaUpload } from '../media/MediaUpload';
import { DailyGallery } from '../media/DailyGallery';

// ... (keep getNightZones and CustomTooltip as is)

const getNightZones = (data: TimelinePoint[]) => {
  const zones: Array<{ start: number; end: number }> = [];
  let currentZone: { start: number } | null = null;

  data.forEach((point) => {
    if (!point.isDaylight) {
      if (!currentZone) {
        currentZone = { start: point.time.getTime() };
      }
    } else {
      if (currentZone) {
        zones.push({
          ...currentZone,
          end: point.time.getTime()
        });
        currentZone = null;
      }
    }
  });

  if (currentZone) {
    zones.push({
      start: (currentZone as any).start,
      end: data[data.length - 1].time.getTime()
    });
  }

  return zones;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const avgData = payload.find((p: any) => p.dataKey === 'avg');
    const gustData = payload.find((p: any) => p.dataKey === 'gust');
    const dataPoint = payload[0]?.payload;
    const dir = dataPoint?.dir || 0;

    return (
      <div className="bg-app-surface/95 border border-app-border p-3 rounded-xl shadow-2xl backdrop-blur-sm min-w-[140px]">
        <div className="mb-2 pb-2 border-b border-app-border">
          <p className="text-xs font-medium text-app-text capitalize">
            {format(dataPoint.fullDate, 'EEE d MMM HH:mm', { locale: sv })}
          </p>
        </div>
        <div className="space-y-2">
          {gustData && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-app-muted">Byvind</span>
              <span className="text-sm font-bold text-yellow-400">{gustData.value} m/s</span>
            </div>
          )}
          {avgData && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-app-muted">Medel</span>
              <span className="text-sm font-bold text-app-muted">{avgData.value} m/s</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-app-border">
            <span className="text-xs text-app-muted flex items-center gap-1">
              <Compass size={10} /> Riktning
            </span>
            <span className="text-xs font-mono text-app-text flex items-center gap-1">
              {Math.round(dir)}° {getDirectionLabel(dir)}
              <div className="inline-block" style={{ transform: `rotate(${dir + 180}deg)` }}>
                <ArrowUp size={12} className="text-app-muted" />
              </div>
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface HistoryTabsProps {
  timeline: TimelinePoint[];

  selectedDate?: Date | null;
  onClearSelection?: () => void;
}

export function HistoryTabs({ timeline, selectedDate, onClearSelection }: HistoryTabsProps) {
  const [historyRange, setHistoryRange] = useState<'24h' | '3d' | '7d' | 'Kalender'>('24h');
  const [showUpload, setShowUpload] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      // Only update if dimensions are valid and different
      if (width > 0 && height > 0) {
        setDimensions(prev => {
          if (prev.width === width && prev.height === height) return prev;
          return { width, height };
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const activeHistoryData = useMemo(() => {
    if (selectedDate) {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      return timeline.filter((p) => p.time >= start && p.time <= end);
    }

    const now = new Date();
    let cutoffDate: Date;

    if (historyRange === '24h') {
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (historyRange === '3d') {
      cutoffDate = subDays(now, 3);
    } else if (historyRange === '7d') {
      cutoffDate = subDays(now, 7);
    } else {
      return [];
    }

    return timeline.filter((p) => p.time >= cutoffDate && !p.isForecast);
  }, [historyRange, timeline, selectedDate]);

  const chartData = useMemo(() => {
    return activeHistoryData.map((point) => ({
      time: point.timeStr,
      fullDate: point.time,
      avg: point.avg,
      gust: point.gust,
      dir: point.dir,
      isDaylight: point.isDaylight
    }));
  }, [activeHistoryData]);

  const nightZones = useMemo(() => getNightZones(activeHistoryData), [activeHistoryData]);

  if (historyRange === 'Kalender' && !selectedDate) {
    return null; // Kalendern hanteras separat
  }

  return (
    <div className="animate-in slide-in-from-right-8 duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-app-text flex items-center gap-2">
          <BarChart2 size={20} className="text-app-muted" />
          {selectedDate ? (
            <span>{format(selectedDate, 'd MMMM yyyy', { locale: sv })}</span>
          ) : (
            'Detaljer'
          )}
        </h2>

        {selectedDate ? (
          <button
            onClick={onClearSelection}
            className="bg-app-surface-elevated hover:bg-app-surface-elevated text-app-text px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <X size={14} />
            Tillbaka
          </button>
        ) : (
          <div className="flex gap-1">
            {(['24h', '3d', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setHistoryRange(range)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${historyRange === range
                  ? 'bg-app-surface-elevated text-app-text shadow-sm'
                  : 'text-app-subtle hover:text-app-text'
                  }`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="bg-app-surface border border-app-border rounded-2xl p-2 pb-8 shadow-sm relative h-[320px] w-full">
        {dimensions.width > 0 && dimensions.height > 0 ? (
          <AreaChart
            width={dimensions.width}
            height={dimensions.height}
            data={chartData}
            margin={{
              top: 10,
              right: 0,
              left: 20,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={APP_THEME.accentFlag.blue} stopOpacity={0.35} />
                <stop offset="95%" stopColor={APP_THEME.accentFlag.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={APP_THEME.border} vertical={false} />

            <XAxis
              dataKey="fullDate"
              stroke={APP_THEME.textMuted}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={historyRange === '24h' ? 47 : historyRange === '3d' ? 143 : 287}
              tickFormatter={(val) => {
                if (!val) return '';
                if (historyRange === '24h') {
                  return format(val, 'HH:mm');
                }
                return format(val, 'EEE', { locale: sv });
              }}
              height={40}
            />
            <YAxis stroke={APP_THEME.textMuted} fontSize={12} domain={[0, 'auto']} orientation="right" />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 10 }} />

            {nightZones.map((zone, i) => (
              <ReferenceArea
                key={i}
                x1={zone.start}
                x2={zone.end}
                xAxisId={0}
                fill="#000000"
                fillOpacity={0.06}
              />
            ))}

            <ReferenceLine
              y={AVG_SURFABLE_MS}
              stroke={APP_THEME.accentFlag.blue}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              label={{ value: 'Surfbart', fill: APP_THEME.textMuted, fontSize: 10 }}
            />

            <Area
              type="monotone"
              dataKey="gust"
              name="Byvind"
              stroke={APP_THEME.textSubtle}
              strokeWidth={1}
              fill="transparent"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="avg"
              name="Medel"
              stroke={APP_THEME.accentFlag.blue}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAvg)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: APP_THEME.accentFlag.blue }}
            />
          </AreaChart>
        ) : (
          <div className="flex items-center justify-center h-full text-app-subtle/50 text-sm">
            Laddar graf...
          </div>
        )}
      </div>

      <div className="mt-4 bg-app-surface border border-app-border p-4 rounded-xl shadow-sm flex justify-between items-center">
        <div>
          <h3 className="text-app-text font-medium text-sm mb-1">
            {historyRange === '24h'
              ? 'Senaste dygnet'
              : historyRange === '3d'
                ? '3 dagar'
                : '7 dagar'}
          </h3>
          <p className="text-app-muted text-xs">
            {historyRange === '24h' ? '5 minuters upplösning' : 'Visar tim-värden'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-app-subtle block">Högsta medelvind denna period</span>
          <span className="text-lg font-bold text-app-text">
            {activeHistoryData.length > 0
              ? Math.max(...activeHistoryData.map((d) => d.avg)).toFixed(1)
              : '0.0'}{' '}
            m/s
          </span>
        </div>
      </div>

      {selectedDate && (
        <div className="mt-8 border-t border-app-border/50 pt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-app-text">Media</h3>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="text-xs bg-app-surface-elevated hover:bg-app-surface-elevated text-app-text px-3 py-2 rounded-lg transition-colors"
            >
              {showUpload ? 'Dölj uppladdning' : 'Ladda upp bild/film'}
            </button>
          </div>

          {showUpload && (
            <div className="mb-8">
              <MediaUpload
                preselectedDate={format(selectedDate, 'yyyy-MM-dd')}
                onUploadComplete={() => setShowUpload(false)}
              />
            </div>
          )}

          <DailyGallery date={format(selectedDate, 'yyyy-MM-dd')} />
        </div>
      )}
    </div>
  );
}
