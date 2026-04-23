import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { Clock, Moon, Compass, ArrowUp } from 'lucide-react';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { getDirectionLabel } from '../../utils/windDataConverter';

const getWindColor = (adjustedWind: number): string => {
  if (!adjustedWind || adjustedWind < 11.0) return '#ECEFF1';
  if (adjustedWind >= 19.0) return '#5E35B1';
  if (adjustedWind >= 18.5) return '#8E24AA';
  if (adjustedWind >= 17.0) return '#D81B60';
  if (adjustedWind >= 16.5) return '#E53935';
  if (adjustedWind >= 16.0) return '#F4511E';
  if (adjustedWind >= 15.5) return '#FB8C00';
  if (adjustedWind >= 15.0) return '#FFB300';
  if (adjustedWind >= 14.5) return '#FDD835';
  if (adjustedWind >= 13.0) return '#43A047';
  if (adjustedWind >= 12.5) return '#66BB6A';
  if (adjustedWind >= 12.0) return '#81C784';
  if (adjustedWind >= 11.5) return '#A5D6A7';
  if (adjustedWind >= 11.0) return '#C8E6C9';
  return '#ECEFF1';
};



const getNightZones = (data: TimelinePoint[]) => {
  const zones: Array<{ start: number; end: number; startTimeStr: string; endTimeStr: string }> = [];
  let currentZone: { start: number; startTimeStr: string } | null = null;

  data.forEach((point) => {
    if (!point.isDaylight) {
      if (!currentZone) {
        currentZone = { start: point.time.getTime(), startTimeStr: point.timeStr };
      }
    } else {
      if (currentZone) {
        zones.push({
          start: currentZone!.start,
          startTimeStr: currentZone!.startTimeStr,
          end: point.time.getTime(),
          endTimeStr: point.timeStr
        });
        currentZone = null;
      }
    }
  });

  if (currentZone) {
    zones.push({
      start: (currentZone as any).start,
      startTimeStr: (currentZone as any).startTimeStr,
      end: data[data.length - 1].time.getTime(),
      endTimeStr: data[data.length - 1].timeStr
    });
  }

  return zones;
};

const CustomAxisTick = ({
  x,
  y,
  payload,
  data
}: {
  x?: number;
  y?: number;
  payload?: any;
  data: any[];
}) => {
  const index = payload.index;
  const item = data && data[index];

  if (!item || typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return null;

  return (
    <g>
      <text x={x} y={y} dy={16} textAnchor="middle" fill="#34d399" fontSize={10} fontWeight="bold">
        {payload.value}
      </text>
      <g transform={`translate(${x}, ${y + 28}) rotate(${item.dir ? item.dir + 180 : 180})`}>
        <path d="M0 -4 L-3 3 L0 1 L3 3 Z" fill="#059669" />
      </g>
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const avgData = payload.find((p: any) => p.dataKey === 'pastAvg' || p.dataKey === 'futureAvg' || p.dataKey === 'avg');
    const gustData = payload.find((p: any) => p.dataKey === 'pastGust' || p.dataKey === 'futureGust' || p.dataKey === 'gust');
    const isForecast = payload.some((p: any) => p.dataKey && p.dataKey.includes('future') && p.value !== null);

    const dataPoint = payload[0]?.payload;
    const isDark = dataPoint && dataPoint.isDaylight === false;
    const dayName = dataPoint?.day || '';
    const dir = dataPoint?.dir || 0;

    return (
      <div className="bg-emerald-900/95 border border-emerald-700 p-3 rounded-xl shadow-2xl backdrop-blur-sm min-w-[140px]">
        <div className="flex justify-between items-center mb-2 gap-3">
          <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            {dayName && <span className="text-emerald-300">{dayName}</span>}
            <Clock size={12} className="ml-1" /> {dataPoint?.timeStr || label}
          </p>
          <div className="flex gap-1">
            {isDark && (
              <span className="text-[10px] bg-emerald-800 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-700 flex items-center gap-1">
                <Moon size={8} />
              </span>
            )}
            {isForecast && (
              <span className="text-[10px] bg-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-700">
                PROG
              </span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {avgData && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-emerald-400">Medel</span>
              <span
                className="text-sm font-bold"
                style={{ color: avgData.value >= 11 ? getWindColor(avgData.value) : '#34d399' }}
              >
                {avgData.value} m/s
              </span>
            </div>
          )}
          {gustData && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400">Byvind</span>
              <span className="text-sm font-bold text-white">{gustData.value} m/s</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-emerald-800">
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <Compass size={10} /> Riktning
            </span>
            <span className="text-xs font-mono text-emerald-300 flex items-center gap-1">
              {Math.round(dir)}° {getDirectionLabel(dir)}
              <div className="inline-block" style={{ transform: `rotate(${dir + 180}deg)` }}>
                <ArrowUp size={12} className="text-emerald-400" />
              </div>
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface WindOverviewChartProps {
  timeline: TimelinePoint[];
  thresholds: {
    SURF_OK_AVG: number;
  };
}

export function WindOverviewChart({ timeline, thresholds }: WindOverviewChartProps) {
  const chartData = useMemo(() => {
    const nowTime = new Date().getTime();
    const sixHoursAgo = nowTime - 6 * 60 * 60 * 1000;

    // Filter timeline to show only relevant data (last 6h + next 12h)
    const twelveHoursFuture = nowTime + 12 * 60 * 60 * 1000;
    const relevantPoints = timeline.filter(p =>
      p.time.getTime() >= sixHoursAgo && p.time.getTime() <= twelveHoursFuture
    );

    // Find the index of the last observed point (not forecast) to connect the lines
    let lastObservedIndex = -1;
    for (let i = relevantPoints.length - 1; i >= 0; i--) {
      if (!relevantPoints[i].isForecast) {
        lastObservedIndex = i;
        break;
      }
    }

    return relevantPoints.map((point, index) => {
      // Observed data (solid line) includes all non-forecast points
      const isObserved = !point.isForecast;

      // Future data (dashed line) includes forecast points AND the last observed point (to connect the lines)
      const isFuture = point.isForecast || index === lastObservedIndex;

      return {
        time: point.timeStr,
        fullDate: point.time,
        pastAvg: isObserved ? point.avg : null,
        pastGust: isObserved ? point.gust : null,
        futureAvg: isFuture ? point.avg : null,
        futureGust: isFuture ? point.gust : null,
        isDaylight: point.isDaylight,
        day: point.day,
        dir: point.dir,
        isForecast: point.isForecast
      };
    });
  }, [timeline]);

  if (chartData.length === 0) {
    return (
      <div className="bg-emerald-900 border border-emerald-800 rounded-2xl p-4">
        <div className="text-emerald-500 text-sm">Ingen data</div>
      </div>
    );
  }

  const nightZones = useMemo(() => getNightZones(timeline), [timeline]);
  const nowLineTime = useMemo(() => {
    const nowPoint = timeline.find(p => p.isNow);
    return nowPoint ? nowPoint.timeStr : null;
  }, [timeline]);

  return (
    <div className="bg-emerald-900 border border-emerald-800 rounded-2xl p-4 pb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-emerald-400 text-xs font-bold uppercase flex items-center gap-2">
          Trend senaste 6h
        </h3>
      </div>
      <div className="h-56 min-h-56 w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50}>
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 20, bottom: 0 }}>
            <defs>
              <linearGradient id="pastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="futureGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#34d399"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={35} // Show every ~3 hours (assuming 5 min intervals)
              tickFormatter={(val) => val}
              tick={<CustomAxisTick data={chartData} />}
              height={40}
            />
            <YAxis
              orientation="right"
              tick={{ fontSize: 10, fill: '#34d399' }}
              tickLine={false}
              axisLine={false}
              domain={['dataMin - 2', 'dataMax + 2']}
            />
            <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 10 }} />

            {nightZones.map((zone, i) => (
              <ReferenceArea
                key={i}
                x1={zone.start}
                x2={zone.end}
                fill="#000000"
                fillOpacity={0.2}
              />
            ))}

            <ReferenceLine y={thresholds.SURF_OK_AVG} stroke="#065f46" strokeDasharray="3 3" />
            {nowLineTime && (
              <ReferenceLine
                x={nowLineTime}
                stroke="#34d399"
                strokeDasharray="2 2"
                label={{ value: 'NU', position: 'insideTop', fill: '#34d399', fontSize: 10 }}
              />
            )}

            <Area
              type="monotone"
              dataKey="pastAvg"
              stroke="#34d399"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#pastGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="pastGust"
              stroke="#6ee7b7"
              strokeWidth={1}
              fill="transparent"
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Area
              type="monotone"
              dataKey="futureAvg"
              stroke="#059669"
              strokeWidth={2}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#futureGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#fff' }}
            />
            <Area
              type="monotone"
              dataKey="futureGust"
              stroke="#047857"
              strokeWidth={1}
              strokeDasharray="5 5"
              fill="transparent"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

