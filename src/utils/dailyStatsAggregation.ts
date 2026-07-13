import { parseISO } from 'date-fns';
import { getEffectiveLevelIndex, WIND_SCALE_LEVELS } from '../config/windScale';
import { isDaylightAtKallsjon } from './daylightCalculations';

export const SURFABLE_LEVEL_INDEX = WIND_SCALE_LEVELS.findIndex((l) => l.id === 'surfable');

export interface WindInterval {
  force: number;
  forceMax: number;
  direction: number;
  time: Date;
}

export interface DailyStatsAggregation {
  date: string;
  year: number;
  month: number;
  maxForce: number;
  maxForceTime: Date;
  avgForce: number;
  minForce: number;
  maxForceDirection: number;
  maxGust: number;
  maxGustTime: Date;
  dataPointsCount: number;
  hasStrongWind: boolean;
  hasGaleForce: boolean;
  hasDaylightWind10Plus: boolean;
  isSurfableDay: boolean;
  surfableMinutes: number;
  surfableMinutesDaylight: number;
  peakLevelIndex: number;
  peakLevelIndexDaylight: number;
  windowFrom: Date | null;
  windowTo: Date | null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Aggregerar 5-minutersintervall till dagsstatistik.
 * Surfbarhet via getEffectiveLevelIndex — samma logik i script, klient och (framtida) Cloud Function.
 */
export function aggregateWindIntervals(
  intervals: WindInterval[],
  dateStr: string
): DailyStatsAggregation {
  if (intervals.length === 0) {
    throw new Error(`No wind intervals for ${dateStr}`);
  }

  const sorted = [...intervals].sort((a, b) => a.time.getTime() - b.time.getTime());

  let maxForce = 0;
  let maxForceTime = sorted[0].time;
  let maxForceDirection = 0;
  let maxGust = 0;
  let maxGustTime = sorted[0].time;
  let sumForce = 0;
  let minForce = Infinity;
  let hasDaylightWind10Plus = false;

  let surfableMinutes = 0;
  let surfableMinutesDaylight = 0;
  let peakLevelIndex = 0;
  let peakLevelIndexDaylight = 0;
  let windowFrom: Date | null = null;
  let windowTo: Date | null = null;

  for (const interval of sorted) {
    const force = interval.force || 0;
    const gust = interval.forceMax ?? force;
    const { time: measurementTime } = interval;
    const levelIndex = getEffectiveLevelIndex(force, gust);
    const daylight = isDaylightAtKallsjon(measurementTime);
    const surfable = levelIndex >= SURFABLE_LEVEL_INDEX;

    if (force > maxForce) {
      maxForce = force;
      maxForceTime = measurementTime;
      maxForceDirection = interval.direction || 0;
    }

    if (gust > maxGust) {
      maxGust = gust;
      maxGustTime = measurementTime;
    }

    if (force >= 10 && daylight) {
      hasDaylightWind10Plus = true;
    }

    if (force < minForce) minForce = force;
    sumForce += force;

    if (levelIndex > peakLevelIndex) peakLevelIndex = levelIndex;
    if (daylight && levelIndex > peakLevelIndexDaylight) {
      peakLevelIndexDaylight = levelIndex;
    }

    if (surfable) {
      surfableMinutes += 5;
      if (!windowFrom) windowFrom = measurementTime;
      windowTo = measurementTime;
      if (daylight) surfableMinutesDaylight += 5;
    }
  }

  const avgForce = sumForce / sorted.length;
  const parsedDate = parseISO(dateStr);

  return {
    date: dateStr,
    year: parsedDate.getFullYear(),
    month: parsedDate.getMonth() + 1,
    maxForce: round1(maxForce),
    maxForceTime,
    avgForce: round1(avgForce),
    minForce: round1(minForce === Infinity ? 0 : minForce),
    maxForceDirection,
    maxGust: round1(maxGust),
    maxGustTime,
    dataPointsCount: sorted.length,
    hasStrongWind: maxForce >= 10,
    hasGaleForce: maxForce >= 15,
    hasDaylightWind10Plus,
    isSurfableDay: surfableMinutes > 0,
    surfableMinutes,
    surfableMinutesDaylight,
    peakLevelIndex,
    peakLevelIndexDaylight,
    windowFrom,
    windowTo,
  };
}
