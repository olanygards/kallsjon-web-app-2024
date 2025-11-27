import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { WindPoint } from '../types/WindData';

const STOCKHOLM_TZ = 'Europe/Stockholm';

/**
 * Konverterar grader till radianer
 */
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Konverterar radianer till grader
 */
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Beräknar cirkulärt medelvärde för vindriktningar (undviker 0/360-problem)
 * @param degs Array av vindriktningar i grader (0-360)
 * @returns Cirkulärt medelvärde eller null om ingen giltig data
 */
export function circularMean(degs: number[]): number | null {
  const valid = degs.filter(d => d >= 0 && d <= 360);
  if (!valid.length) return null;

  const x = valid.reduce((s, d) => s + Math.cos(toRad(d)), 0);
  const y = valid.reduce((s, d) => s + Math.sin(toRad(d)), 0);
  const mean = (toDeg(Math.atan2(y, x)) + 360) % 360;
  
  return mean;
}

/**
 * Resamplar vinddata till heltimmar med medelvärden
 * @param points Array av WindPoint
 * @returns Resamplade punkter på heltimmar
 */
export function resampleToHourly(points: WindPoint[]): WindPoint[] {
  if (!points.length) return [];

  // Gruppera per heltimme (lokaltid Stockholm)
  const hourlyGroups = new Map<string, WindPoint[]>();

  points.forEach(point => {
    const date = parseISO(point.time);
    const zonedDate = toZonedTime(date, STOCKHOLM_TZ);
    // Avrunda till närmaste heltimme
    const rounded = new Date(zonedDate);
    rounded.setMinutes(0, 0, 0);
    const hourKey = formatTz(
      rounded,
      'yyyy-MM-dd HH:00:00',
      { timeZone: STOCKHOLM_TZ }
    );

    if (!hourlyGroups.has(hourKey)) {
      hourlyGroups.set(hourKey, []);
    }
    hourlyGroups.get(hourKey)!.push(point);
  });

  // Beräkna medelvärden per timme
  const resampled: WindPoint[] = [];

  hourlyGroups.forEach((group, hourKey) => {
    const winds = group.map(p => p.wind);
    const gusts = group.map(p => p.gust).filter((g): g is number => g !== null);
    const dirs = group.map(p => p.dir).filter((d): d is number => d !== null);

    const avgWind = winds.reduce((a, b) => a + b, 0) / winds.length;
    const maxGust = gusts.length > 0 ? Math.max(...gusts) : null;
    const avgDir = dirs.length > 0 ? circularMean(dirs) : null;

    // Konvertera tillbaka till UTC ISO string
    const zonedDate = parseISO(hourKey);
    const utcDate = fromZonedTime(zonedDate, STOCKHOLM_TZ);

    resampled.push({
      time: utcDate.toISOString(),
      wind: avgWind,
      gust: maxGust,
      dir: avgDir,
      source: group[0].source,
      runTimestamp: group[0].runTimestamp
    });
  });

  return resampled.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Genererar cache-nyckel för prognosdata
 */
export function getCacheKey(
  model: string,
  lat: number,
  lon: number,
  runTimestamp: string | undefined,
  bucket15m: number
): string {
  const runIso = runTimestamp || 'unknown';
  return `${model}_${lat}_${lon}_${runIso}_${bucket15m}`;
}

/**
 * Avrundar till närmaste 0.5 m/s
 */
export function round05(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Validerar en WindPoint
 */
export function validateWindPoint(point: WindPoint): boolean {
  // Validera wind
  if (typeof point.wind !== 'number' || point.wind < 0 || point.wind > 50) {
    return false;
  }

  // Validera gust
  if (point.gust !== null && (point.gust < 0 || point.gust > 50)) {
    return false;
  }

  // Validera dir
  if (point.dir !== null && (point.dir < 0 || point.dir > 360)) {
    return false;
  }

  // Validera time
  if (!point.time || typeof point.time !== 'string') {
    return false;
  }

  return true;
}

/**
 * Beräknar 15-minuters bucket för cache
 */
export function get15MinBucket(date: Date = new Date()): number {
  return Math.floor(date.getTime() / (15 * 60 * 1000));
}

