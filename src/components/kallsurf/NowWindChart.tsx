import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { buildNowWindChartData, NowWindBar } from '../../utils/nowWindChartData';
import { getWindColor } from '../../utils/windColors';
import { APP_THEME } from '../../config/windScale';

const GUST_GRAY = '#D4D4D4';
const GAP_COLOR = '#E8E8E6';

const formatMs = (n: number) => n.toFixed(1).replace('.', ',');

function renderAvgBar(props: unknown) {
  return <WindBarShape {...(props as BarShapeProps)} dataKey="avgBar" />;
}

function renderGustBar(props: unknown) {
  return <WindBarShape {...(props as BarShapeProps)} dataKey="gustDeltaBar" />;
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: NowWindBar;
  dataKey?: string;
}

function WindBarShape({ x = 0, y = 0, width = 0, height = 0, payload, dataKey }: BarShapeProps) {
  if (!payload || height <= 0) return null;

  const isAvg = dataKey === 'avgBar';
  const w = Math.max(width - 1, 1);

  if (payload.isGap) {
    if (!isAvg) return null;
    return (
      <rect
        x={x + 0.5}
        y={y + height - 2}
        width={w}
        height={2}
        fill={GAP_COLOR}
        rx={0.5}
      />
    );
  }

  if (payload.isForecast) {
    const stroke = isAvg && payload.avg != null
      ? getWindColor(payload.avg)
      : GUST_GRAY;
    return (
      <rect
        x={x + 0.5}
        y={y}
        width={w}
        height={height}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        rx={1}
      />
    );
  }

  const fill = isAvg && payload.avg != null
    ? getWindColor(payload.avg)
    : GUST_GRAY;

  return (
    <rect
      x={x + 0.5}
      y={y}
      width={w}
      height={height}
      fill={fill}
      rx={1}
    />
  );
}

interface NowWindChartProps {
  timeline: TimelinePoint[];
}

export function NowWindChart({ timeline }: NowWindChartProps) {
  const chartData = useMemo(() => buildNowWindChartData(timeline), [timeline]);
  const { bars, nuLineLabel, yMax, summary, hasForecast } = chartData;

  if (bars.length === 0) {
    return (
      <div className="text-app-subtle text-sm py-4">Ingen vinddata tillgänglig</div>
    );
  }

  const xTicks = bars
    .filter((b) => b.time.getMinutes() % 10 === 0)
    .map((b) => b.timeStr);

  return (
    <div>
      <div className="flex text-[9px] uppercase tracking-wider text-app-subtle font-bold mb-1">
        <span className="flex-[12] text-left">← senaste timmen</span>
        <span className="w-8 text-center text-app-text">NU</span>
        <span className="flex-[6] text-right">nästa 30 min →</span>
      </div>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <ComposedChart
              data={bars}
              margin={{ top: 14, right: 2, left: -22, bottom: 0 }}
              barCategoryGap="8%"
              barGap={0}
            >
              <CartesianGrid strokeDasharray="2 3" stroke={APP_THEME.borderMuted} vertical={false} />
              <XAxis
                dataKey="timeStr"
                stroke={APP_THEME.textSubtle}
                fontSize={8}
                tickLine={false}
                axisLine={false}
                ticks={xTicks}
                interval={0}
              />
              <YAxis
                orientation="left"
                tick={{ fontSize: 8, fill: APP_THEME.textSubtle, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                domain={[0, yMax]}
                allowDecimals={false}
                tickCount={5}
                width={28}
                label={{
                  value: 'm/s',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 12,
                  style: { fontSize: 8, fill: APP_THEME.textSubtle },
                }}
              />

              <ReferenceLine
                x={nuLineLabel}
                stroke={APP_THEME.text}
                strokeWidth={1.2}
                label={{
                  value: 'NU',
                  position: 'insideTop',
                  fill: APP_THEME.text,
                  fontSize: 8,
                  fontWeight: 700,
                  offset: 2,
                }}
              />

              <Bar
                dataKey="avgBar"
                stackId="wind"
                minPointSize={2}
                shape={renderAvgBar}
                isAnimationActive={false}
              />
              <Bar
                dataKey="gustDeltaBar"
                stackId="wind"
                shape={renderGustBar}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <span className="uppercase tracking-wider font-bold text-app-subtle flex-shrink-0">
          Senaste timmen
        </span>
        {summary.avgMin != null && summary.avgMax != null ? (
          <span className="flex items-center gap-1.5 text-app-text">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getWindColor((summary.avgMin + summary.avgMax) / 2) }}
            />
            <span className="font-mono">
              {formatMs(summary.avgMin)} — {formatMs(summary.avgMax)} m/s
            </span>
          </span>
        ) : (
          <span className="text-app-subtle">Ingen observation</span>
        )}
        {summary.gustMin != null && summary.gustMax != null && (
          <span className="flex items-center gap-1.5 text-app-text">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: GUST_GRAY }} />
            <span className="font-mono">
              {formatMs(summary.gustMin)} — {formatMs(summary.gustMax)} m/s
            </span>
            <span className="text-app-muted">(by)</span>
          </span>
        )}
        {!hasForecast && (
          <span className="text-app-subtle w-full">Prognos saknas</span>
        )}
      </div>
    </div>
  );
}
