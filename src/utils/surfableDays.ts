import { parseISO } from 'date-fns';
import {
  DEFAULT_ICE_CONFIG,
  DEFAULT_ICE_END_DAY,
  DEFAULT_ICE_END_MONTH,
  DEFAULT_ICE_START_DAY,
  DEFAULT_ICE_START_MONTH,
  type IceConfig,
} from '../config/iceConfig';

export type { IceConfig };
export { DEFAULT_ICE_CONFIG } from '../config/iceConfig';

export function isIcePeriod(date: Date | string, iceConfig: IceConfig = DEFAULT_ICE_CONFIG): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const year = dateObj.getFullYear();
  const yearConfig = iceConfig[year];

  if (yearConfig) {
    const iceStart = parseISO(yearConfig.start);
    const iceEnd = parseISO(yearConfig.end);
    return dateObj >= iceStart && dateObj <= iceEnd;
  }

  const iceStart = new Date(year, DEFAULT_ICE_START_MONTH, DEFAULT_ICE_START_DAY);
  const iceEnd = new Date(year, DEFAULT_ICE_END_MONTH, DEFAULT_ICE_END_DAY);
  return dateObj >= iceStart && dateObj <= iceEnd;
}

export function filterSurfableDays<T extends { date: string } | string>(
  items: T[],
  iceConfig?: IceConfig
): T[] {
  return items.filter((item) => {
    const date = typeof item === 'string' ? item : item.date;
    return !isIcePeriod(date, iceConfig);
  });
}

export function getIcePeriodForYear(year: number, iceConfig: IceConfig = DEFAULT_ICE_CONFIG) {
  const yearConfig = iceConfig[year];

  if (yearConfig) {
    return {
      start: parseISO(yearConfig.start),
      end: parseISO(yearConfig.end),
    };
  }

  return {
    start: new Date(year, DEFAULT_ICE_START_MONTH, DEFAULT_ICE_START_DAY),
    end: new Date(year, DEFAULT_ICE_END_MONTH, DEFAULT_ICE_END_DAY),
  };
}
