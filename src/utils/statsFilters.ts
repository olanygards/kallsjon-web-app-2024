import type { DailyStats } from '../hooks/useDailyStats';
import { WIND_SCALE_LEVELS } from '../config/windScale';
import { filterSurfableDays } from './surfableDays';
import { degreesToSector8, type WindSector8 } from './windDirection8';

export type StatsYearFilter = number | 'all';
export type StatsSortMode = 'maxForce' | 'maxGust' | 'surfableMinutes';

export interface StatsFilters {
  excludeIce: boolean;
  daylightOnly: boolean;
  minLevelIndex: number;
  directions: WindSector8[];
  year: StatsYearFilter;
}

export const STATS_FILTERS_STORAGE_KEY = 'kallifornia.stats.filters.v1';

export const MIN_LEVEL_PRESETS = [
  { id: 'surfable', label: 'Surfbart ≥ 10', index: WIND_SCALE_LEVELS.findIndex((l) => l.id === 'surfable') },
  { id: 'good', label: 'Bra ≥ 12', index: WIND_SCALE_LEVELS.findIndex((l) => l.id === 'good') },
  { id: 'great', label: 'Riktigt bra ≥ 15', index: WIND_SCALE_LEVELS.findIndex((l) => l.id === 'great') },
] as const;

export const DEFAULT_STATS_FILTERS: StatsFilters = {
  excludeIce: true,
  daylightOnly: true,
  minLevelIndex: MIN_LEVEL_PRESETS[0].index,
  directions: [],
  year: 'all',
};

export interface StatsFilterResult {
  days: DailyStats[];
  total: number;
}

function passesDaylight(day: DailyStats): boolean {
  return (day.surfableMinutesDaylight ?? 0) > 0;
}

function getPeakLevelIndex(day: DailyStats, daylightOnly: boolean): number {
  if (daylightOnly && day.peakLevelIndexDaylight !== undefined) {
    return day.peakLevelIndexDaylight;
  }
  return day.peakLevelIndex ?? 0;
}

function passesMinLevel(day: DailyStats, minLevelIndex: number, daylightOnly: boolean): boolean {
  return getPeakLevelIndex(day, daylightOnly) >= minLevelIndex;
}

function passesDirection(day: DailyStats, directions: WindSector8[]): boolean {
  if (directions.length === 0) return true;
  return directions.includes(degreesToSector8(day.maxForceDirection));
}

function passesYear(day: DailyStats, year: StatsYearFilter): boolean {
  if (year === 'all') return true;
  return day.year === year;
}

export function applyStatsFilters(days: DailyStats[], filters: StatsFilters): StatsFilterResult {
  const total = days.length;
  let filtered = [...days];

  if (filters.excludeIce) {
    filtered = filterSurfableDays(filtered);
  }

  if (filters.daylightOnly) {
    filtered = filtered.filter(passesDaylight);
  }

  filtered = filtered.filter(
    (day) =>
      passesMinLevel(day, filters.minLevelIndex, filters.daylightOnly) &&
      passesDirection(day, filters.directions) &&
      passesYear(day, filters.year)
  );

  return { days: filtered, total };
}

export function countActiveSheetFilters(filters: StatsFilters): number {
  let count = 0;
  if (filters.directions.length > 0) count++;
  if (filters.year !== 'all') count++;
  if (!filters.excludeIce) count++;
  if (!filters.daylightOnly) count++;
  const defaultMin = DEFAULT_STATS_FILTERS.minLevelIndex;
  if (filters.minLevelIndex !== defaultMin) count++;
  return count;
}

export function formatSurfableHours(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return '0 h';
  const hours = minutes / 60;
  return `${hours.toFixed(1).replace('.', ',')} h`;
}

export function describeEmptyFilters(filters: StatsFilters): string {
  const parts: string[] = [];
  if (filters.directions.length > 0) parts.push(filters.directions.join(', '));
  const preset = MIN_LEVEL_PRESETS.find((p) => p.index === filters.minLevelIndex);
  if (preset && preset.index !== DEFAULT_STATS_FILTERS.minLevelIndex) {
    parts.push(preset.label);
  }
  if (filters.year !== 'all') parts.push(String(filters.year));
  return parts.length > 0 ? parts.join(' och ') : 'dina filter';
}
