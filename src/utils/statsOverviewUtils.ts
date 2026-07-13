import type { DailyStats } from '../hooks/useDailyStats';
import { format, parseISO } from 'date-fns';
import { degreesToSector8, type WindSector8 } from './windDirection8';

export interface MonthlyBarDatum {
  month: number;
  label: string;
  yearCount: number;
  averageCount: number;
}

export interface MonthListItem {
  month: number;
  label: string;
  days: number;
  bestMaxForce: number;
  inProgress: boolean;
}

function ytdCutoff(year: number, reference = new Date()): string {
  if (year < reference.getFullYear()) return `${year}-12-31`;
  return format(reference, 'yyyy-MM-dd');
}

export function countSurfableDaysYtd(days: DailyStats[], year: number, reference = new Date()): number {
  const cutoff = ytdCutoff(year, reference);
  return days.filter((d) => d.year === year && d.date <= cutoff).length;
}

export function averageYtdAcrossYears(
  days: DailyStats[],
  targetYear: number,
  reference = new Date()
): number | null {
  const otherYears = [...new Set(days.map((d) => d.year))].filter((y) => y !== targetYear);
  if (otherYears.length === 0) return null;
  const counts = otherYears.map((y) => countSurfableDaysYtd(days, y, reference));
  return Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10;
}

export function buildAverageSeasonLabel(years: number[], excludeYear: number): string {
  const seasons = years.filter((y) => y !== excludeYear).sort((a, b) => a - b);
  if (seasons.length === 0) return '';
  if (seasons.length === 1) return String(seasons[0]);
  return `${seasons[0]}–${seasons[seasons.length - 1]}`;
}

export function buildMonthlyBars(
  days: DailyStats[],
  targetYear: number
): MonthlyBarDatum[] {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  const otherYears = [...new Set(days.map((d) => d.year))].filter((y) => y !== targetYear);

  return monthLabels.map((label, index) => {
    const month = index + 1;
    const yearCount = days.filter((d) => d.year === targetYear && d.month === month).length;
    const averageCount =
      otherYears.length === 0
        ? 0
        : Math.round(
            (otherYears.reduce(
              (sum, y) => sum + days.filter((d) => d.year === y && d.month === month).length,
              0
            ) /
              otherYears.length) *
              10
          ) / 10;

    return { month, label, yearCount, averageCount };
  });
}

export function buildMonthList(days: DailyStats[], targetYear: number, reference = new Date()): MonthListItem[] {
  const monthLabels = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December',
  ];
  const inProgressMonth = reference.getFullYear() === targetYear ? reference.getMonth() + 1 : null;

  return monthLabels
    .map((label, index) => {
      const month = index + 1;
      const monthDays = days.filter((d) => d.year === targetYear && d.month === month);
      if (monthDays.length === 0 && inProgressMonth !== month) return null;
      const bestMaxForce = monthDays.reduce((best, d) => Math.max(best, d.maxForce), 0);
      return {
        month,
        label,
        days: monthDays.length,
        bestMaxForce,
        inProgress: inProgressMonth === month,
      };
    })
    .filter((item): item is MonthListItem => item !== null)
    .reverse();
}

export function findBestDay(days: DailyStats[]): DailyStats | null {
  if (days.length === 0) return null;
  return days.reduce((best, d) => (d.maxForce > best.maxForce ? d : best));
}

export function findDominantDirection(days: DailyStats[]): { sector: WindSector8; percent: number } | null {
  if (days.length === 0) return null;
  const counts = new Map<WindSector8, number>();
  days.forEach((d) => {
    const sector = degreesToSector8(d.maxForceDirection);
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  });
  let top: WindSector8 = 'V';
  let topCount = 0;
  counts.forEach((count, sector) => {
    if (count > topCount) {
      topCount = count;
      top = sector;
    }
  });
  return { sector: top, percent: Math.round((topCount / days.length) * 100) };
}

export function parseDayDate(dateStr: string): Date {
  return parseISO(dateStr);
}
