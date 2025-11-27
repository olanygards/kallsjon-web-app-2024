import { startOfDay, endOfDay, addHours, subHours, addDays, isToday, isSameDay } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const STOCKHOLM_TZ = 'Europe/Stockholm';

/**
 * Beräknar startdatum baserat på timeRange
 * @param currentDate Aktuellt datum
 * @param timeRange Tidsperiod (1, 2, 3, 7 dagar)
 * @returns Startdatum för datahämtning
 */
export function getStartDate(currentDate: Date, timeRange: 1 | 2 | 3 | 7): Date {
  const now = new Date();

  if (timeRange === 1) {
    // Om det är idag: visa senaste 6h men inte tidigare än dagens start
    if (isToday(currentDate)) {
      const sixHoursAgo = subHours(now, 6);
      const dayStart = startOfDay(currentDate);
      return sixHoursAgo > dayStart ? sixHoursAgo : dayStart;
    }
    
    // Om det är en annan dag: visa hela dagen från start
    return startOfDay(currentDate);
  }

  // För längre tidsvyer: börja från vald dag eller nu
  if (isSameDay(currentDate, now)) {
    // Om det är idag: börja från närmaste heltimme
    const zonedNow = toZonedTime(now, STOCKHOLM_TZ);
    const roundedToHour = new Date(zonedNow);
    roundedToHour.setMinutes(0, 0, 0);
    return fromZonedTime(roundedToHour, STOCKHOLM_TZ);
  }
  
  // Om annan dag: börja från start av den dagen
  return startOfDay(currentDate);
}

/**
 * Beräknar slutdatum baserat på timeRange
 * @param currentDate Aktuellt datum
 * @param timeRange Tidsperiod (1, 2, 3, 7 dagar)
 * @returns Slutdatum för datahämtning
 */
export function getEndDate(currentDate: Date, timeRange: 1 | 2 | 3 | 7): Date {
  if (timeRange === 1) {
    // För 24h-vy: visa till slutet av den valda dagen
    return endOfDay(currentDate);
  }

  // För längre tidsvyer: lägg till X dagar från startdatum
  const startDate = getStartDate(currentDate, timeRange);
  return addHours(startDate, timeRange * 24);
}

/**
 * Beräknar slutdatum för extended view (flera dagar)
 * @param startDate Startdatum
 * @param days Antal dagar
 * @returns Slutdatum
 */
export function getExtendedEndDate(startDate: Date, days: number): Date {
  return endOfDay(addDays(startDate, days));
}

