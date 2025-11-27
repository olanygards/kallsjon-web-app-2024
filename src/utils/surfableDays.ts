import { parseISO } from 'date-fns';

/**
 * Ice configuration per year
 * Defines when the lake is frozen and not surfable
 */
export interface IceConfig {
    [year: number]: {
        start: string; // ISO date string, e.g. "2024-02-15"
        end: string;   // ISO date string, e.g. "2024-04-15"
    };
}

/**
 * Default ice period configuration
 * Lake is typically frozen from mid-February to mid-April
 */
export const DEFAULT_ICE_CONFIG: IceConfig = {
    // Add specific years if they differ from default
    // 2024: { start: '2024-02-10', end: '2024-04-20' }, // Example: longer freeze
};

/**
 * Default ice period dates (used if year not in config)
 */
const DEFAULT_ICE_START_MONTH = 1;  // February (0-indexed)
const DEFAULT_ICE_START_DAY = 15;
const DEFAULT_ICE_END_MONTH = 3;    // April (0-indexed)
const DEFAULT_ICE_END_DAY = 15;

/**
 * Check if a date falls within the ice period (lake frozen, not surfable)
 */
export function isIcePeriod(date: Date | string, iceConfig: IceConfig = DEFAULT_ICE_CONFIG): boolean {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const year = dateObj.getFullYear();

    // Check if there's a specific config for this year
    const yearConfig = iceConfig[year];

    if (yearConfig) {
        const iceStart = parseISO(yearConfig.start);
        const iceEnd = parseISO(yearConfig.end);
        return dateObj >= iceStart && dateObj <= iceEnd;
    }

    // Use default period: Feb 15 - Apr 15
    const iceStart = new Date(year, DEFAULT_ICE_START_MONTH, DEFAULT_ICE_START_DAY);
    const iceEnd = new Date(year, DEFAULT_ICE_END_MONTH, DEFAULT_ICE_END_DAY);

    return dateObj >= iceStart && dateObj <= iceEnd;
}

/**
 * Filter array of dates/objects with dates to remove ice period
 */
export function filterSurfableDays<T extends { date: string } | string>(
    items: T[],
    iceConfig?: IceConfig
): T[] {
    return items.filter(item => {
        const date = typeof item === 'string' ? item : item.date;
        return !isIcePeriod(date, iceConfig);
    });
}

/**
 * Get ice period info for a specific year
 */
export function getIcePeriodForYear(year: number, iceConfig: IceConfig = DEFAULT_ICE_CONFIG) {
    const yearConfig = iceConfig[year];

    if (yearConfig) {
        return {
            start: parseISO(yearConfig.start),
            end: parseISO(yearConfig.end)
        };
    }

    return {
        start: new Date(year, DEFAULT_ICE_START_MONTH, DEFAULT_ICE_START_DAY),
        end: new Date(year, DEFAULT_ICE_END_MONTH, DEFAULT_ICE_END_DAY)
    };
}
