import { useMemo, useState } from 'react';
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { useDailyMedia } from '../../hooks/useDailyMedia';
import { DailyGallery } from '../media/DailyGallery';
import { MediaUpload } from '../media/MediaUpload';
import { getLevelBadgeStyle } from '../../utils/windColors';
import {
  APP_THEME,
  AVG_SURFABLE_MS,
  WIND_SCALE_LEVELS,
  getEffectiveLevelIndex,
} from '../../config/windScale';
import { getSunTimes, formatDecimalTime } from '../../utils/sunTimes';

const INK = APP_THEME.text;
const SURFABLE_INDEX = WIND_SCALE_LEVELS.findIndex(l => l.id === 'surfable');

const SECTORS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
const sectorIndex = (deg: number) => Math.round(deg / 22.5) % 16;

/**
 * Riktningsspann under dagens blåsigaste period, t.ex. "V–NV".
 * Tar de vanligaste sektorerna bland punkter nära dagens max.
 */
function getDirectionSpan(points: TimelinePoint[], maxAvg: number): string | null {
  const windy = points.filter(p => p.dir > 0 && p.avg >= Math.max(4, maxAvg * 0.6));
  if (windy.length === 0) return null;

  const counts = new Map<number, number>();
  windy.forEach(p => {
    const idx = sectorIndex(p.dir);
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0][0];
  const secondary = sorted[1]?.[0];

  if (
    secondary !== undefined &&
    (Math.abs(primary - secondary) === 1 || Math.abs(primary - secondary) === 15) &&
    sorted[1][1] >= windy.length * 0.25
  ) {
    return `${SECTORS[primary]}–${SECTORS[secondary]}`;
  }
  return SECTORS[primary];
}

interface ChartPoint {
  timeMs: number;
  pastAvg: number | null;
  pastGust: number | null;
  futureAvg: number | null;
  futureGust: number | null;
}

interface DayDetailProps {
  date: Date;
  timeline: TimelinePoint[];
  onBack: () => void;
  onNavigateDay: (date: Date) => void;
  /** Öppna Prognos-fliken med dagen förvald (endast prognosdagar) */
  onCompareModels?: (date: Date) => void;
}

/**
 * Dagvyn enligt UX-skiss v1.4 (4b): dagsammanfattning, vindgraf med
 * mediamarkörer och dagens media. Samma komponent för alla dagar —
 * passerade visar observation, framtida prognos.
 */
export function DayDetail({ date, timeline, onBack, onNavigateDay, onCompareModels }: DayDetailProps) {
  const [showUpload, setShowUpload] = useState(false);

  const dateKey = format(date, 'yyyy-MM-dd');
  const media = useDailyMedia(dateKey);

  const dayPoints = useMemo(() => {
    return timeline.filter(p => isSameDay(p.time, date));
  }, [timeline, date]);

  const summary = useMemo(() => {
    if (dayPoints.length === 0) return null;

    const maxAvg = Math.max(...dayPoints.map(p => p.avg));
    const maxGust = Math.max(...dayPoints.map(p => p.gust));
    const bestLevelIndex = dayPoints.reduce(
      (best, p) => Math.max(best, getEffectiveLevelIndex(p.avg, p.gust)),
      0
    );

    const surfable = dayPoints.filter(p => getEffectiveLevelIndex(p.avg, p.gust) >= SURFABLE_INDEX);
    const thresholdWindow = surfable.length > 0
      ? { from: format(surfable[0].time, 'HH:mm'), to: format(surfable[surfable.length - 1].time, 'HH:mm') }
      : null;

    const isForecast = dayPoints.every(p => p.isForecast);
    const hasForecast = dayPoints.some(p => p.isForecast);

    return {
      maxAvg,
      maxGust,
      level: WIND_SCALE_LEVELS[bestLevelIndex],
      directionSpan: getDirectionSpan(dayPoints, maxAvg),
      thresholdWindow,
      isForecast,
      hasForecast,
    };
  }, [dayPoints]);

  const chartData = useMemo<ChartPoint[]>(() => {
    let lastObservedIndex = -1;
    for (let i = dayPoints.length - 1; i >= 0; i--) {
      if (!dayPoints[i].isForecast) { lastObservedIndex = i; break; }
    }

    return dayPoints.map((p, index) => {
      const isObserved = !p.isForecast;
      const isFuture = p.isForecast || index === lastObservedIndex;
      return {
        timeMs: p.time.getTime(),
        pastAvg: isObserved ? p.avg : null,
        pastGust: isObserved ? p.gust : null,
        futureAvg: isFuture ? p.avg : null,
        futureGust: isFuture ? p.gust : null,
      };
    });
  }, [dayPoints]);

  // Mediamarkörer: tidpunkt på dagens tidslinje (kräver capturedAt HH:mm)
  const mediaMarkers = useMemo(() => {
    const dayStart = startOfDay(date).getTime();
    return media.items
      .filter(item => item.capturedAt)
      .map(item => {
        const [h, m] = item.capturedAt!.split(':').map(Number);
        return { id: item.id, timeMs: dayStart + (h * 60 + m) * 60 * 1000 };
      });
  }, [media.items, date]);

  const sunTimes = getSunTimes(date);
  const today = startOfDay(new Date());
  const canCompareModels = onCompareModels
    && startOfDay(date) >= today
    && startOfDay(date) <= addDays(today, 6);
  const canGoForward = startOfDay(date) < addDays(today, 6);

  const scrollToMedia = () => {
    document.getElementById('day-media')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const xDomain: [number, number] = [
    startOfDay(date).getTime(),
    startOfDay(date).getTime() + 24 * 60 * 60 * 1000,
  ];

  return (
    <div className="animate-in slide-in-from-right-8 duration-300 space-y-4">
      {/* Dagnavigering */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-app-muted hover:text-app-text flex items-center gap-0.5 transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="capitalize">{format(date, 'MMMM', { locale: sv })}</span>
        </button>

        <h2 className="text-base font-bold text-app-text capitalize">
          {format(date, 'EEE d MMMM', { locale: sv })}
        </h2>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigateDay(subDays(date, 1))}
            className="p-1.5 rounded-lg text-app-muted hover:text-app-text hover:bg-app-surface-elevated transition-colors"
            aria-label="Föregående dag"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => canGoForward && onNavigateDay(addDays(date, 1))}
            disabled={!canGoForward}
            className={`p-1.5 rounded-lg transition-colors ${canGoForward
              ? 'text-app-muted hover:text-app-text hover:bg-app-surface-elevated'
              : 'text-app-border cursor-not-allowed'
              }`}
            aria-label="Nästa dag"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Dagsammanfattning */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
        {summary ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] uppercase tracking-wide"
                style={getLevelBadgeStyle(summary.maxAvg, summary.maxGust)}
              >
                {summary.level.label}
              </span>
              {summary.isForecast && (
                <span className="text-[10px] font-bold text-app-subtle uppercase tracking-wider border border-app-border rounded px-1.5 py-0.5">
                  Prognos
                </span>
              )}
            </div>

            <p className="text-sm text-app-text">
              Max medel <b>{summary.maxAvg.toFixed(1).replace('.', ',')}</b> · max by{' '}
              <b>{summary.maxGust.toFixed(1).replace('.', ',')}</b> m/s
            </p>
            <p className="text-sm text-app-muted mt-0.5">
              {summary.directionSpan && <>Riktning {summary.directionSpan}</>}
              {summary.thresholdWindow && (
                <>
                  {summary.directionSpan && ' · '}
                  över tröskeln <b className="text-app-text">{summary.thresholdWindow.from}–{summary.thresholdWindow.to}</b>
                </>
              )}
              {!summary.thresholdWindow && summary.directionSpan && ' · under tröskeln hela dagen'}
            </p>
            <p className="text-xs text-app-subtle mt-2">
              Dagsljus {formatDecimalTime(sunTimes.rise)}–{formatDecimalTime(sunTimes.set)}
            </p>
          </>
        ) : (
          <p className="text-sm text-app-muted">Ingen vinddata för den här dagen.</p>
        )}
      </div>

      {/* Vindgraf */}
      {dayPoints.length > 0 && (
        <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
          <h3 className="text-app-muted text-[10px] uppercase tracking-wider font-bold mb-3">
            {summary?.isForecast
              ? 'Vind under dagen · prognos'
              : summary?.hasForecast
                ? 'Vind under dagen · observation + prognos'
                : 'Vind under dagen · observation Vassnäs'}
          </h3>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={160} debounce={50}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 3" stroke={APP_THEME.borderMuted} vertical={false} />
                <XAxis
                  dataKey="timeMs"
                  type="number"
                  domain={xDomain}
                  scale="time"
                  stroke={APP_THEME.textSubtle}
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  ticks={[0, 6, 12, 18, 24].map(h => xDomain[0] + h * 60 * 60 * 1000)}
                  tickFormatter={(ms: number) => format(new Date(ms), 'HH')}
                />
                <YAxis
                  orientation="left"
                  tick={{ fontSize: 9, fill: APP_THEME.textSubtle, fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (dataMax: number) => Math.max(12, Math.ceil(dataMax + 1))]}
                  allowDecimals={false}
                  tickCount={5}
                />

                <ReferenceLine
                  y={AVG_SURFABLE_MS}
                  stroke={APP_THEME.accentFlag.blue}
                  strokeDasharray="4 3"
                  strokeOpacity={0.6}
                />

                <Area type="monotone" dataKey="pastAvg" stroke="none" fill={APP_THEME.accentFlag.blue} fillOpacity={0.06} isAnimationActive={false} />
                <Line type="monotone" dataKey="pastGust" stroke={APP_THEME.textSubtle} strokeWidth={1} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="pastAvg" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="futureGust" stroke={APP_THEME.textSubtle} strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="futureAvg" stroke={INK} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />

                {/* Mediamarkörer på tidslinjen */}
                {mediaMarkers.map(marker => (
                  <ReferenceDot
                    key={marker.id}
                    x={marker.timeMs}
                    y={0}
                    r={4}
                    fill={INK}
                    stroke="#ffffff"
                    strokeWidth={1}
                    onClick={scrollToMedia}
                    className="cursor-pointer"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between items-center mt-1 text-[9px] text-app-subtle">
            <span>{summary?.isForecast ? 'prognos, streckad' : 'obs heldragen · by tunn'}</span>
            {mediaMarkers.length > 0 && <span>● = media finns · tryck för att se</span>}
          </div>

          {canCompareModels && (
            <button
              onClick={() => onCompareModels!(date)}
              className="mt-3 w-full text-center text-xs text-app-accent hover:underline underline-offset-2"
            >
              Jämför modeller ›
            </button>
          )}
        </div>
      )}

      {/* Media från dagen */}
      <div id="day-media" className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm scroll-mt-24">
        <div className="flex justify-between items-center">
          <h3 className="text-app-muted text-[10px] uppercase tracking-wider font-bold">
            Media från dagen{media.items.length > 0 ? ` · ${media.items.length} ${media.items.length === 1 ? 'post' : 'poster'}` : ''}
          </h3>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="text-xs bg-app-surface-elevated hover:bg-app-border-muted text-app-text px-3 py-1.5 rounded-lg transition-colors"
          >
            {showUpload ? 'Dölj uppladdning' : '＋ Ladda upp'}
          </button>
        </div>

        {showUpload && (
          <div className="mt-4">
            <MediaUpload
              preselectedDate={dateKey}
              onUploadComplete={() => {
                setShowUpload(false);
                media.refetch();
              }}
            />
          </div>
        )}

        {media.loading ? (
          <p className="text-app-subtle text-sm mt-4">Laddar media…</p>
        ) : media.items.length > 0 ? (
          <DailyGallery
            date={dateKey}
            items={media.items}
            onDeleted={media.removeItem}
          />
        ) : (
          <p className="text-sm text-app-muted mt-4">
            Inget uppladdat från den här dagen ännu.
            {summary && !summary.isForecast && summary.thresholdWindow && (
              <> Var du ute? Ladda upp!</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
