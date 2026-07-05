import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { ArrowUp } from 'lucide-react';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { AVG_SURFABLE_MS, APP_THEME } from '../../config/windScale';
import { getSunTimes, formatDecimalTime } from '../../utils/sunTimes';

const INK = APP_THEME.text;

/** Kortriktning för avläsningsraden */
const getShortDirection = (degrees: number): string => {
  if (degrees === 0) return '–';
  const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
  return dirs[Math.round(degrees / 22.5) % 16];
};

/** Tidsfönster enligt UX-skiss v1.4 (3a #4) — valet minns */
const WINDOWS = [
  { id: '3-6', label: '−3 h +6 h', past: 3, future: 6 },
  { id: '6-12', label: '−6 h +12 h', past: 6, future: 12 },
  { id: '12-24', label: '−12 h +24 h', past: 12, future: 24 },
] as const;
type WindowId = typeof WINDOWS[number]['id'];

const WINDOW_STORAGE_KEY = 'kallifornia.trendWindow';

const loadWindow = (): WindowId => {
  try {
    const saved = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (saved && WINDOWS.some(w => w.id === saved)) return saved as WindowId;
  } catch { /* localStorage kan saknas (SSR/privat läge) */ }
  return '6-12';
};

interface ChartPoint {
  timeMs: number;
  timeStr: string;
  day: string;
  pastAvg: number | null;
  pastGust: number | null;
  futureAvg: number | null;
  futureGust: number | null;
  avg: number;
  gust: number;
  dir: number;
  isDaylight: boolean;
  isForecast: boolean;
}

const getNightZones = (data: ChartPoint[]) => {
  const zones: Array<{ start: number; end: number }> = [];
  let start: number | null = null;

  data.forEach(point => {
    if (!point.isDaylight && start === null) start = point.timeMs;
    if (point.isDaylight && start !== null) {
      zones.push({ start, end: point.timeMs });
      start = null;
    }
  });
  if (start !== null && data.length > 0) {
    zones.push({ start, end: data[data.length - 1].timeMs });
  }
  return zones;
};

/**
 * Osynlig tooltip som synkar aktiv datapunkt till scrubb-avläsningen.
 * Recharts driver tooltipen för både mus (hover) och finger (touch-drag),
 * så detta fungerar på iPhone — till skillnad från chartens onMouseMove.
 */
function ScrubSync({
  active,
  payload,
  onScrub,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  onScrub: (point: ChartPoint | null) => void;
}) {
  const point = active && payload && payload.length > 0 ? payload[0].payload ?? null : null;

  useEffect(() => {
    onScrub(point);
  }, [point, onScrub]);

  return null;
}

interface WindOverviewChartProps {
  timeline: TimelinePoint[];
}

/**
 * "Utveckling kring nu" enligt UX-skiss v1.4: observation heldragen,
 * prognos streckad, NU-linje, tre valbara fönster och en fast avläsning
 * uppe till höger (aldrig en tooltip som skymmer kurvan). Scrubb i grafen
 * flyttar avläsningen; släpp återgår till NU.
 */
export function WindOverviewChart({ timeline }: WindOverviewChartProps) {
  const [windowId, setWindowId] = useState<WindowId>(loadWindow);
  const [scrub, setScrubState] = useState<ChartPoint | null>(null);

  // Stabil callback som bara uppdaterar när tidpunkten faktiskt ändras
  const setScrub = useMemo(() => {
    return (point: ChartPoint | null) => {
      setScrubState(prev => (prev?.timeMs === point?.timeMs ? prev : point));
    };
  }, []);

  const selectWindow = (id: WindowId) => {
    setWindowId(id);
    try { localStorage.setItem(WINDOW_STORAGE_KEY, id); } catch { /* ignore */ }
  };

  const win = WINDOWS.find(w => w.id === windowId)!;

  const chartData = useMemo<ChartPoint[]>(() => {
    const nowMs = Date.now();
    const startMs = nowMs - win.past * 60 * 60 * 1000;
    const endMs = nowMs + win.future * 60 * 60 * 1000;

    const relevant = timeline.filter(p => {
      const t = p.time.getTime();
      return t >= startMs && t <= endMs;
    });

    let lastObservedIndex = -1;
    for (let i = relevant.length - 1; i >= 0; i--) {
      if (!relevant[i].isForecast) { lastObservedIndex = i; break; }
    }

    return relevant.map((point, index) => {
      const isObserved = !point.isForecast;
      const isFuture = point.isForecast || index === lastObservedIndex;

      return {
        timeMs: point.time.getTime(),
        timeStr: point.timeStr,
        day: point.day,
        pastAvg: isObserved ? point.avg : null,
        pastGust: isObserved ? point.gust : null,
        futureAvg: isFuture ? point.avg : null,
        futureGust: isFuture ? point.gust : null,
        avg: point.avg,
        gust: point.gust,
        dir: point.dir,
        isDaylight: point.isDaylight,
        isForecast: point.isForecast,
      };
    });
  }, [timeline, win]);

  const nightZones = useMemo(() => getNightZones(chartData), [chartData]);

  const nowPoint = useMemo(() => {
    const observed = chartData.filter(p => !p.isForecast);
    return observed.length > 0 ? observed[observed.length - 1] : null;
  }, [chartData]);

  const sunTimes = getSunTimes(new Date());

  if (chartData.length === 0) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
        <div className="text-app-subtle text-sm">Ingen data i valt fönster</div>
      </div>
    );
  }

  // Avläsning: scrubbpunkt om finger/mus är i grafen, annars NU
  const readout = scrub ?? nowPoint;
  const readoutLabel = scrub
    ? `${scrub.day} · ${scrub.timeStr} · ${scrub.isForecast ? 'PROG' : 'OBS'}`
    : nowPoint
      ? `NU · ${nowPoint.timeStr} · OBS`
      : '';

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-3 gap-2">
        <h3 className="text-app-text text-xs font-bold uppercase tracking-wider pt-0.5">
          Utveckling kring nu
        </h3>
        {readout && (
          <div className="text-right font-mono leading-tight flex-shrink-0">
            <span className="block text-[9px] font-bold tracking-wider text-app-subtle uppercase">
              {readoutLabel}
            </span>
            <span className="text-sm font-bold text-app-text">
              {readout.avg.toFixed(1).replace('.', ',')} / {readout.gust.toFixed(1).replace('.', ',')}
            </span>
            <span className="text-[10px] text-app-muted ml-1 inline-flex items-center gap-0.5">
              <span
                className="inline-flex"
                style={{ transform: `rotate(${readout.dir + 180}deg)` }}
              >
                <ArrowUp size={9} strokeWidth={3} />
              </span>
              {getShortDirection(readout.dir)}
            </span>
          </div>
        )}
      </div>

      {/* Fönsterväxlare */}
      <div className="grid grid-cols-3 border border-app-border rounded-lg overflow-hidden mb-3 text-[11px]">
        {WINDOWS.map(w => (
          <button
            key={w.id}
            onClick={() => selectWindow(w.id)}
            className={`py-1.5 text-center transition-colors ${w.id === windowId
              ? 'bg-app-text text-white font-bold'
              : 'bg-app-surface text-app-muted hover:text-app-text'
              } border-l border-app-border first:border-l-0`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Släpp med fingret → avläsningen återgår till NU */}
      <div
        className="h-48 min-h-48 w-full"
        onTouchEnd={() => setScrub(null)}
        onTouchCancel={() => setScrub(null)}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180} debounce={50}>
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 0, left: -18, bottom: 0 }}
            onMouseLeave={() => setScrub(null)}
          >
            <CartesianGrid strokeDasharray="2 3" stroke={APP_THEME.borderMuted} vertical={false} />
            <XAxis
              dataKey="timeMs"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              stroke={APP_THEME.textSubtle}
              fontSize={9}
              tickLine={false}
              axisLine={false}
              tickCount={5}
              tickFormatter={(ms: number) =>
                new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
              }
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
            {/* Tooltip utan synligt innehåll — driver scrubb-avläsningen (mus + touch) */}
            <Tooltip
              content={<ScrubSync onScrub={setScrub} />}
              cursor={{ stroke: INK, strokeWidth: 1, strokeDasharray: '2 2' }}
              isAnimationActive={false}
            />

            {nightZones.map((zone, i) => (
              <ReferenceArea key={i} x1={zone.start} x2={zone.end} fill="#000000" fillOpacity={0.05} />
            ))}

            <ReferenceLine
              y={AVG_SURFABLE_MS}
              stroke={APP_THEME.accentFlag.blue}
              strokeDasharray="4 3"
              strokeOpacity={0.6}
            />
            {nowPoint && (
              <ReferenceLine
                x={nowPoint.timeMs}
                stroke={INK}
                strokeWidth={1.2}
                label={{ value: 'NU', position: 'insideTopLeft', fill: INK, fontSize: 9, fontWeight: 700, offset: 4 }}
              />
            )}

            {/* Diskret fyllnad under observerad medelvind */}
            <Area
              type="monotone"
              dataKey="pastAvg"
              stroke="none"
              fill={APP_THEME.accentFlag.blue}
              fillOpacity={0.06}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="pastGust"
              stroke={APP_THEME.textSubtle}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="pastAvg"
              stroke={INK}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="futureGust"
              stroke={APP_THEME.textSubtle}
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="futureAvg"
              stroke={INK}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center mt-1 text-[9px] text-app-subtle">
        <span>obs, heldragen</span>
        <span>☀ ljust till {formatDecimalTime(sunTimes.set)}</span>
        <span>prognos, streckad</span>
      </div>
    </div>
  );
}
