import { addMinutes, format } from 'date-fns';
import { TimelinePoint } from '../hooks/useKallsurfTimeline';

export interface ForecastHourPoint {
  time: Date;
  avg: number;
  gust: number;
  dir: number;
}

const FIVE_MIN_MS = 5 * 60 * 1000;
const BUCKET_TOLERANCE_MS = 2.5 * 60 * 1000;
const OBS_BUCKETS = 12;
const FORECAST_BUCKETS = 6;

export interface NowWindBar {
  time: Date;
  timeMs: number;
  timeStr: string;
  avg: number | null;
  gust: number | null;
  gustDelta: number | null;
  avgBar: number;
  gustDeltaBar: number;
  dir: number | null;
  isForecast: boolean;
  isGap: boolean;
}

export interface NowWindHourSummary {
  avgMin: number | null;
  avgMax: number | null;
  gustMin: number | null;
  gustMax: number | null;
}

export interface NowWindChartData {
  bars: NowWindBar[];
  nowMs: number;
  nuLineLabel: string;
  yMax: number;
  summary: NowWindHourSummary;
  hasForecast: boolean;
}

function snap5(date: Date): Date {
  return new Date(Math.floor(date.getTime() / FIVE_MIN_MS) * FIVE_MIN_MS);
}

function bucketKey(time: Date): number {
  return Math.floor(time.getTime() / FIVE_MIN_MS);
}

function gustDelta(avg: number, gust: number): number {
  return Math.max(0, gust - avg);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

function interpolateForecast(
  forecastPoints: ForecastHourPoint[],
  target: Date,
  bridge?: ForecastHourPoint | null
): { avg: number; gust: number; dir: number } | null {
  if (forecastPoints.length === 0 && !bridge) return null;

  const targetMs = target.getTime();
  const sorted = [...forecastPoints].sort((a, b) => a.time.getTime() - b.time.getTime());

  const exact = sorted.find((p) => p.time.getTime() === targetMs);
  if (exact) {
    return { avg: exact.avg, gust: exact.gust, dir: exact.dir };
  }

  let before: ForecastHourPoint | null = null;
  let after: ForecastHourPoint | null = null;

  for (const point of sorted) {
    const ms = point.time.getTime();
    if (ms <= targetMs) before = point;
    if (ms >= targetMs && !after) {
      after = point;
      break;
    }
  }

  if (!before && bridge && bridge.time.getTime() <= targetMs) {
    before = bridge;
  }

  if (before && after && before.time.getTime() !== after.time.getTime()) {
    const span = after.time.getTime() - before.time.getTime();
    const t = (targetMs - before.time.getTime()) / span;
    return {
      avg: lerp(before.avg, after.avg, t),
      gust: lerp(before.gust, after.gust, t),
      dir: lerpAngle(before.dir, after.dir, t),
    };
  }

  if (before) return { avg: before.avg, gust: before.gust, dir: before.dir };
  if (after) return { avg: after.avg, gust: after.gust, dir: after.dir };

  return null;
}

function timelineForecastToHourly(points: TimelinePoint[]): ForecastHourPoint[] {
  return points.map((p) => ({
    time: p.time,
    avg: p.avg,
    gust: p.gust,
    dir: p.dir,
  }));
}

function buildBar(
  time: Date,
  avg: number | null,
  gust: number | null,
  dir: number | null,
  isForecast: boolean,
  isGap: boolean
): NowWindBar {
  const avgVal = isGap ? null : avg;
  const gustVal = isGap ? null : gust;
  const delta = avgVal != null && gustVal != null ? gustDelta(avgVal, gustVal) : null;

  return {
    time,
    timeMs: time.getTime(),
    timeStr: format(time, 'HH:mm'),
    avg: avgVal,
    gust: gustVal,
    gustDelta: delta,
    avgBar: isGap ? 0.01 : (avgVal ?? 0),
    gustDeltaBar: delta ?? 0,
    dir,
    isForecast,
    isGap,
  };
}

export function buildNowWindChartData(
  timeline: TimelinePoint[],
  forecastHourly: ForecastHourPoint[] = [],
  now: Date = new Date()
): NowWindChartData {
  const nowSnap = snap5(now);
  const nowMs = now.getTime();
  const nuLineLabel = format(nowSnap, 'HH:mm');

  const bucketTimes: Array<{ time: Date; isForecast: boolean }> = [];

  for (let i = OBS_BUCKETS - 1; i >= 0; i--) {
    bucketTimes.push({ time: addMinutes(nowSnap, -i * 5), isForecast: false });
  }
  for (let i = 1; i <= FORECAST_BUCKETS; i++) {
    bucketTimes.push({ time: addMinutes(nowSnap, i * 5), isForecast: true });
  }

  const observed = timeline.filter((p) => !p.isForecast);
  const forecast = forecastHourly.length > 0
    ? forecastHourly
    : timelineForecastToHourly(timeline.filter((p) => p.isForecast));

  const obsByBucket = new Map<number, TimelinePoint>();
  observed.forEach((point) => {
    const key = bucketKey(point.time);
    const existing = obsByBucket.get(key);
    if (!existing || point.time.getTime() > existing.time.getTime()) {
      obsByBucket.set(key, point);
    }
  });

  const bars: NowWindBar[] = [];

  for (const { time, isForecast } of bucketTimes) {
    if (!isForecast) {
      const key = bucketKey(time);
      const match = obsByBucket.get(key);
      if (!match) {
        bars.push(buildBar(time, null, null, null, false, true));
        continue;
      }

      const withinTolerance = Math.abs(match.time.getTime() - time.getTime()) <= BUCKET_TOLERANCE_MS;
      if (!withinTolerance) {
        bars.push(buildBar(time, null, null, null, false, true));
        continue;
      }

      bars.push(buildBar(time, match.avg, match.gust, match.dir, false, false));
      continue;
    }

    const lastObs = [...bars].reverse().find((b) => !b.isForecast && !b.isGap && b.avg != null && b.gust != null && b.dir != null);
    const bridge: ForecastHourPoint | null = lastObs
      ? { time: nowSnap, avg: lastObs.avg!, gust: lastObs.gust!, dir: lastObs.dir! }
      : null;

    const interpolated = interpolateForecast(forecast, time, bridge);
    if (!interpolated) {
      bars.push(buildBar(time, null, null, null, true, true));
      continue;
    }

    bars.push(buildBar(time, interpolated.avg, interpolated.gust, interpolated.dir, true, false));
  }

  const validObs = bars.filter((b) => !b.isForecast && !b.isGap && b.avg != null && b.gust != null);
  const validGusts = bars.filter((b) => !b.isGap && b.gust != null).map((b) => b.gust!);

  const summary: NowWindHourSummary = validObs.length > 0
    ? {
        avgMin: Math.min(...validObs.map((b) => b.avg!)),
        avgMax: Math.max(...validObs.map((b) => b.avg!)),
        gustMin: Math.min(...validObs.map((b) => b.gust!)),
        gustMax: Math.max(...validObs.map((b) => b.gust!)),
      }
    : { avgMin: null, avgMax: null, gustMin: null, gustMax: null };

  const yMax = validGusts.length > 0
    ? Math.max(15, Math.ceil(Math.max(...validGusts) + 2))
    : 15;

  const hasForecast = bars.some((b) => b.isForecast && !b.isGap);

  return { bars, nowMs, nuLineLabel, yMax, summary, hasForecast };
}
