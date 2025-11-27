import SunCalc from 'suncalc';

/**
 * Källsjön coordinates
 */
export const KALLSJON_LAT = 63.637993;
export const KALLSJON_LON = 13.033151;

/**
 * Check if a specific time is during daylight hours at Källsjön
 */
export function isDaylightAtKallsjon(date: Date): boolean {
    const times = SunCalc.getTimes(date, KALLSJON_LAT, KALLSJON_LON);
    return date >= times.sunrise && date <= times.sunset;
}

/**
 * Get sunrise and sunset times for a specific date at Källsjön
 */
export function getSunTimesForKallsjon(date: Date) {
    const times = SunCalc.getTimes(date, KALLSJON_LAT, KALLSJON_LON);
    return {
        sunrise: times.sunrise,
        sunset: times.sunset,
        daylightDuration: times.sunset.getTime() - times.sunrise.getTime()
    };
}

/**
 * Check if the max wind for a day occurred during daylight
 * Used for filtering "surfable in daylight" days
 */
export function isMaxWindDuringDaylight(maxForceTime: Date): boolean {
    return isDaylightAtKallsjon(maxForceTime);
}

/**
 * Get daylight hours for a specific date (for display purposes)
 */
export function getDaylightHours(date: Date): number {
    const { daylightDuration } = getSunTimesForKallsjon(date);
    return daylightDuration / (1000 * 60 * 60); // Convert ms to hours
}

/**
 * Check if a day has reasonable daylight for surfing (> 6 hours)
 * Helps exclude deep winter days with very short daylight
 */
export function hasReasonableDaylight(date: Date): boolean {
    const hours = getDaylightHours(date);
    return hours > 6;
}
