import { useMemo } from 'react';
import { parseISO, format, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ForecastDataset } from '../types/WindData';
import { round05, circularMean } from '../utils/timeUtils';
import { WIND_CALENDAR_COLORS } from '../config/constants';

export interface WindyDay {
  date: string;         // yyyy-MM-dd
  dateObj: Date;
  maxGust: number;
  avgWind: number;      // Medelvind för dagen
  windDirection: number | null; // Genomsnittlig vindriktning
  peakTime: string;     // Tid för högsta byvinden (HH:mm)
  color: string;
  spread: number;
  modelCount: number;
  label: string;        // "mån 11 nov"
}

export function useWindCalendarDays(
  datasets: ForecastDataset[],
  modelSpread: Record<string, number> = {},
  daysCount: number = 10
): WindyDay[] {
  return useMemo(() => {
    if (!datasets || datasets.length === 0) return [];

    // Filtrera bort tomma datasets
    const validDatasets = datasets.filter(ds => ds.data && ds.data.length > 0);
    if (validDatasets.length === 0) return [];

    // Gruppera per dag (lokaltid)
    const dayMap = new Map<string, {
      maxGust: number;
      maxGustTime: string;
      winds: number[];
      directions: number[];
      spreads: number[]
    }>();

    validDatasets.forEach(dataset => {
      dataset.data.forEach(point => {
        // Check for valid point structure
        if (!point || (!point.time && !(point as any).date)) return;

        // Handle Date object (from Observed) vs ISO string (from Forecast)
        let date: Date;
        let timeStr: string;

        if ((point.time as any) instanceof Date) {
          date = point.time as unknown as Date;
          timeStr = (point.time as unknown as Date).toISOString();
        } else {
          date = parseISO(point.time);
          timeStr = point.time;
        }

        const dayKey = format(startOfDay(date), 'yyyy-MM-dd');

        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, {
            maxGust: 0,
            maxGustTime: timeStr,
            winds: [],
            directions: [],
            spreads: []
          });
        }

        const dayData = dayMap.get(dayKey)!;
        const gustOrWind = point.gust !== null ? point.gust : point.wind;

        // Uppdatera max byvind och tid
        if (gustOrWind > dayData.maxGust) {
          dayData.maxGust = gustOrWind;
          dayData.maxGustTime = timeStr;
        }

        // Samla medelvind
        dayData.winds.push(point.wind);

        // Samla vindriktningar
        if (point.dir !== null) {
          dayData.directions.push(point.dir);
        }

        // Lägg till spread för denna timme om den finns
        const spreadValue = modelSpread[timeStr];
        if (spreadValue !== undefined) {
          dayData.spreads.push(spreadValue);
        }
      });
    });

    // Konvertera till array och sortera
    const days: WindyDay[] = Array.from(dayMap.entries())
      .map(([dateStr, data]) => {
        const dateObj = parseISO(dateStr);
        const maxGust = round05(data.maxGust);

        // Beräkna medelvind
        const avgWind = data.winds.length > 0
          ? round05(data.winds.reduce((a, b) => a + b, 0) / data.winds.length)
          : 0;

        // Beräkna genomsnittlig vindriktning (cirkulärt medel)
        const avgDirection = data.directions.length > 0
          ? circularMean(data.directions)
          : null;

        // Hämta tid för högsta byvinden
        // Handle both ISO string and Date object for parsing time
        let peakTimeStr = '';
        try {
          // Try parsing as ISO
          peakTimeStr = format(parseISO(data.maxGustTime), 'HH:mm');
        } catch (e) {
          // Fallback if it's not parseable by parseISO (e.g. it was constructed differently)
          // But here maxGustTime was set from point.time which was unified to string above.
          // However, let's be safe if parseISO fails (e.g. "Invalid Date")
          peakTimeStr = '--:--';
        }

        // Beräkna medel-spread för dagen
        const avgSpread = data.spreads.length > 0
          ? data.spreads.reduce((a, b) => a + b, 0) / data.spreads.length
          : 0;

        // Färgkodning baserat på vindstyrka
        let color: string = WIND_CALENDAR_COLORS.BELOW_10;
        if (maxGust >= 16) {
          color = WIND_CALENDAR_COLORS.RANGE_16_PLUS;
        } else if (maxGust >= 14) {
          color = WIND_CALENDAR_COLORS.RANGE_14_15;
        } else if (maxGust >= 12) {
          color = WIND_CALENDAR_COLORS.RANGE_12_13;
        } else if (maxGust >= 10) {
          color = WIND_CALENDAR_COLORS.RANGE_10_11;
        }

        return {
          date: dateStr,
          dateObj,
          maxGust,
          avgWind,
          windDirection: avgDirection,
          peakTime: peakTimeStr,
          color,
          spread: round05(avgSpread),
          modelCount: validDatasets.length,
          label: format(dateObj, 'EEE d MMM', { locale: sv })
        };
      })
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .slice(0, daysCount);

    return days;
  }, [datasets, modelSpread, daysCount]);
}
