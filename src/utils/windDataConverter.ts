import { parseISO } from 'date-fns';
import { WindData, WindPoint } from '../types/WindData';

/**
 * Konverterar WindPoint (prognosdata) till WindData (legacy format)
 * För bakåtkompatibilitet med befintliga komponenter
 */
export function windPointToWindData(point: WindPoint): WindData {
  return {
    time: parseISO(point.time),
    windSpeed: point.wind,
    windDirection: point.dir !== null ? point.dir : 0,
    windGust: point.gust !== null ? point.gust : point.wind * 1.5, // Fallback estimat
    isForecast: true
  };
}

/**
 * Konverterar array av WindPoint till WindData
 */
export function windPointsToWindData(points: WindPoint[]): WindData[] {
  return points.map(windPointToWindData);
}

export const getDirectionLabel = (degrees: number): string => {
  if (degrees === 0) return 'Växlande';

  const directions = [
    'Nordlig', 'Nordnordost', 'Nordost', 'Ostnordost',
    'Ostlig', 'Ostsydost', 'Sydost', 'Sydsydost',
    'Sydlig', 'Sydsydväst', 'Sydväst', 'Västsydväst',
    'Västlig', 'Västnordväst', 'Nordväst', 'Nordnordväst'
  ];
  // 360 degrees is North, same as 0 in the 16-sector logic if we didn't handle 0 separately.
  // But since 0 is explicitly "Växlande" (Calm/Variable) per user request, we handle it above.
  // For 360, the math below works: 360 / 22.5 = 16. 16 % 16 = 0 -> 'Nordlig'.
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
};

