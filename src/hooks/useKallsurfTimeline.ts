import { useMemo, useState, useEffect } from 'react';
import { addHours, format, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, subDays, startOfHour, subHours } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useWindData } from './useWindData';
import { useMonthlyStats } from './useMonthlyStats';
import { useForecastModels } from './useForecastModels';
import { useProcessedWindData } from './useProcessedWindData';
import { KALLSJON } from '../config/constants';
import { ForecastModel } from '../types/WindData';
import { windPointsToWindData } from '../utils/windDataConverter';
import { getSunTimes } from '../utils/sunTimes';

// Trösklar för surfbarhet
const THRESHOLDS = {
  MIN_WORTH_WATCHING: 6,
  SURF_OK_AVG: 8,
  SURF_GOOD_AVG: 10,
  SURF_GUST: 15
};

type Surfability = 'none' | 'watching' | 'ok' | 'good';

// Konfiguration
const CONFIG = {
  ACTIVE_HISTORY_HOURS: 6,
  ACTIVE_FORECAST_HOURS: 168, // 7 dygn — krävs för "Kommande 7 dagar" (bästa vind per dag)
  POINTS_PER_HOUR: 12 // 5-minuters upplösning = 12 punkter per timme
};



// Kontrollerar om tiden är surfbar (dagsljus)
const isSurfableTime = (date: Date): boolean => {
  const times = getSunTimes(date);
  const hourVal = date.getHours() + date.getMinutes() / 60;

  if (times.set > 23 || times.rise < 3) {
    return hourVal > times.rise || hourVal < times.set;
  }
  return hourVal >= times.rise && hourVal < times.lastLight;
};

// Beräknar surfbarhet baserat på trösklar
const getSurfability = (avg: number, gust: number): 'none' | 'watching' | 'ok' | 'good' => {
  if (avg >= THRESHOLDS.SURF_GOOD_AVG || gust >= THRESHOLDS.SURF_GUST) {
    return 'good';
  }
  if (avg >= THRESHOLDS.SURF_OK_AVG) {
    return 'ok';
  }
  if (avg >= THRESHOLDS.MIN_WORTH_WATCHING) {
    return 'watching';
  }
  return 'none';
};

// Timeline data point interface
export interface TimelinePoint {
  time: Date;
  timeStr: string;
  day: string;
  avg: number;
  gust: number;
  dir: number;
  isDaylight: boolean;
  isNow: boolean;
  surfability: 'none' | 'watching' | 'ok' | 'good';
  isForecast: boolean;
}

// Hourly bucket interface
export interface HourlyBucket {
  time: Date;
  timeStr: string;
  day: string;
  avg: number;
  gust: number;
  dir: number;
  isDaylight: boolean;
  surfability: 'none' | 'watching' | 'ok' | 'good';
  isForecast: boolean;
}

// Daily summary interface
export interface DailySummary {
  date: Date;
  dateStr: string;
  maxAvg: number;
  avgAvg: number;
  maxGust: number;
  bestSurfability: 'none' | 'watching' | 'ok' | 'good';
}

export function useKallsurfTimeline(viewDate?: Date, selectedDate?: Date | null) {
  // Använd state för 'now' för att undvika onödiga re-renders
  const [now, setNow] = useState(new Date());

  // Uppdatera 'now' varje 30 sekunder för att hålla UI uppdaterat med senaste data
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000); // 30 sekunder
    return () => clearInterval(timer);
  }, []);

  // Beräkna datumintervall för historik
  // Om en specifik dag är vald: hämta hela månadens data för kalenderfärgläggning
  // Annars: för översikt (current month) hämta senaste 7 dagar, 
  //         för kalender (other month) hämta från månadens början
  const { historyStart, historyEnd, isCalendarView } = useMemo(() => {
    // Om vi har en specifik vald dag, hämta hela månadens data
    // (så att vi kan färglägga hela kalendern samtidigt som vi visar dagen)
    if (selectedDate) {
      return {
        historyStart: startOfDay(selectedDate), // Only fetch ONE day of detailed data
        historyEnd: endOfDay(selectedDate),
        isCalendarView: true
      };
    }

    const targetDate = viewDate || now;
    const monthStart = startOfMonth(targetDate);
    const sevenDaysAgo = subDays(now, 7);

    // Är vi i kalendervy för en annan månad än nuvarande?
    const currentMonth = startOfMonth(now);
    const viewingDifferentMonth = monthStart.getTime() !== currentMonth.getTime();

    // Om vi tittar på en annan månad: hämta från månadens början (kalendervy)
    // Annars: hämta senaste 7 dagar (översikt)
    if (viewingDifferentMonth) {
      return {
        historyStart: monthStart,
        historyEnd: endOfMonth(targetDate),
        isCalendarView: true
      };
    }

    return {
      historyStart: sevenDaysAgo,
      historyEnd: now,
      isCalendarView: false
    };
  }, [now, viewDate, selectedDate]);

  const forecastEnd = addHours(now, CONFIG.ACTIVE_FORECAST_HOURS);

  // Beräkna minForce baserat på användningsfall
  // Vald dag: all data (0) - behövs för full graf OCH kalenderfärgläggning
  // Kalendervy (annan månad): bara intressanta dagar (≥9 m/s)
  // Översikt: all data (0 m/s)
  const minForce = useMemo(() => {
    // Om en specifik dag är vald: hämta ALL data för hela månaden
    // (både för grafen OCH för att färglägga kalendern)
    if (selectedDate) {
      return 0;
    }

    // Om vi är i kalendervy för en annan månad: filtrera på ≥9 m/s
    if (isCalendarView) {
      return 9;
    }

    // Översiktsvy: all data
    return 0;
  }, [selectedDate, isCalendarView]);

  // Split data fetching into Archive (stable, cached) and Live (dynamic, frequent)

  // The split point is 2 hours ago. Data before this is "archive", after is "live".
  const splitPoint = useMemo(() => {
    return startOfHour(subHours(now, 2));
  }, [now]);

  // 1. Archive Data
  // Range: [historyStart, min(historyEnd, splitPoint)]
  const archiveEnd = useMemo(() => {
    return historyEnd < splitPoint ? historyEnd : splitPoint;
  }, [historyEnd, splitPoint]);

  const {
    data: archiveWindData,
    loading: archiveLoading,
    error: archiveError
  } = useWindData({
    startDate: historyStart,
    endDate: archiveEnd,
    minForce
  });

  // 2. Live Data
  // Range: [max(historyStart, splitPoint), historyEnd]
  // Only fetch if historyEnd is actually after the split point
  const shouldFetchLive = historyEnd > splitPoint;
  const liveStart = useMemo(() => {
    return historyStart > splitPoint ? historyStart : splitPoint;
  }, [historyStart, splitPoint]);

  const {
    data: liveWindData,
    loading: liveLoading,
    error: liveError
  } = useWindData({
    startDate: liveStart,
    endDate: historyEnd,
    minForce: shouldFetchLive ? minForce : 999 // Hack: use high minForce to effectively skip query if not needed, or handle in useWindData
  });

  // Merge data
  const windData = useMemo(() => {
    // If we shouldn't fetch live data, just use archive
    if (!shouldFetchLive) {
      return archiveWindData;
    }
    return [...archiveWindData, ...liveWindData].sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [archiveWindData, liveWindData, shouldFetchLive]);

  const windLoading = archiveLoading || (shouldFetchLive && liveLoading);
  const windError = archiveError || (shouldFetchLive && liveError);

  // Hämta prognosdata (6h framåt)
  const {
    dataByModel,
    loadingByModel,
    errors: modelErrors
  } = useForecastModels({
    lat: KALLSJON.lat,
    lon: KALLSJON.lon,
    startDate: startOfHour(now), // Stable start time (updates hourly) to prevent re-fetching every 30s
    endDate: forecastEnd,
    // SMHI does not allow direct browser CORS in production; use MET Norway in PROD.
    enabledModels: import.meta.env.PROD
      ? [ForecastModel.MET_NORWAY]
      : [ForecastModel.SMHI, ForecastModel.MET_NORWAY]
  });

  // Konvertera prognosdata till WindData format
  const forecastDataRaw = useMemo(() => {
    const consensus = dataByModel[ForecastModel.CONSENSUS] || [];
    if (consensus.length > 0) {
      return windPointsToWindData(consensus);
    }
    // Fallback till MET Norway (och SMHI i dev) om consensus saknas
    const met = dataByModel[ForecastModel.MET_NORWAY] || [];
    if (met.length > 0) return windPointsToWindData(met);
    const smhi = dataByModel[ForecastModel.SMHI] || [];
    return windPointsToWindData(smhi);
  }, [dataByModel]);

  // Processa data
  const { processedWindData, processedForecastData } = useProcessedWindData({
    windData,
    forecastData: forecastDataRaw,
    todayTimeWindow: { start: historyStart, end: forecastEnd },
    viewDateRange: { start: historyStart, end: forecastEnd }
  });

  // Kombinera och processa till timeline med 5-minuters upplösning
  const timeline = useMemo<TimelinePoint[]>(() => {
    const points: TimelinePoint[] = [];
    const nowTime = now.getTime();

    // Lägg till historik (observerad data)
    processedWindData.forEach(data => {
      const time = data.time;
      const avg = data.windSpeed;
      const gust = data.windGust;
      const dir = data.windDirection;

      points.push({
        time,
        timeStr: format(time, 'HH:mm'),
        day: format(time, 'EEE', { locale: sv }).replace('.', ''),
        avg,
        gust,
        dir,
        isDaylight: isSurfableTime(time),
        isNow: Math.abs(time.getTime() - nowTime) < 5 * 60 * 1000, // 5 min tolerans
        surfability: getSurfability(avg, gust),
        isForecast: false
      });
    });

    // Lägg till prognos
    processedForecastData.forEach(data => {
      const time = data.time;
      const avg = data.windSpeed;
      const gust = data.windGust;
      const dir = data.windDirection;

      points.push({
        time,
        timeStr: format(time, 'HH:mm'),
        day: format(time, 'EEE', { locale: sv }).replace('.', ''),
        avg,
        gust,
        dir,
        isDaylight: isSurfableTime(time),
        isNow: Math.abs(time.getTime() - nowTime) < 5 * 60 * 1000,
        surfability: getSurfability(avg, gust),
        isForecast: true
      });
    });

    // Sortera efter tid och ta bort duplicater
    const uniquePoints = new Map<number, TimelinePoint>();
    points.forEach(point => {
      const timeKey = Math.floor(point.time.getTime() / (5 * 60 * 1000)); // 5-min buckets
      if (!uniquePoints.has(timeKey) || point.isForecast === false) {
        uniquePoints.set(timeKey, point);
      }
    });

    return Array.from(uniquePoints.values())
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [processedWindData, processedForecastData, now]);

  // Gruppera till timvis buckets
  const hourlyBuckets = useMemo<HourlyBucket[]>(() => {
    const buckets = new Map<string, TimelinePoint[]>();

    timeline.forEach(point => {
      const hourKey = format(point.time, 'yyyy-MM-dd HH:00');
      if (!buckets.has(hourKey)) {
        buckets.set(hourKey, []);
      }
      buckets.get(hourKey)!.push(point);
    });

    return Array.from(buckets.entries())
      .map(([_, points]) => {
        const avg = points.reduce((sum, p) => sum + p.avg, 0) / points.length;
        const gust = Math.max(...points.map(p => p.gust));
        const dir = points[0].dir; // Ta första riktningen
        const isDaylight = points.some(p => p.isDaylight);
        const surfability = points.reduce<Surfability>((best, p) => {
          const order = { none: 0, watching: 1, ok: 2, good: 3 };
          return order[p.surfability] > order[best] ? p.surfability : best;
        }, 'none');
        const isForecast = points[0].isForecast;

        return {
          time: points[0].time,
          timeStr: format(points[0].time, 'HH:mm'),
          day: format(points[0].time, 'EEE', { locale: sv }).replace('.', ''),
          avg,
          gust,
          dir,
          isDaylight,
          surfability,
          isForecast
        };
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [timeline]);

  // Månads-aggregat för kalendern
  // För historiska månader: använd useMonthlyStats (från dailyStats collection)
  // För nuvarande månad: beräkna från timeline (som vi ändå har)

  const { stats: monthlyStats } = useMonthlyStats(
    isCalendarView ? (viewDate || now) : new Date(0) // Only fetch if in calendar view
  );

  const dailySummary = useMemo<DailySummary[]>(() => {
    // Om vi är i kalendervy (historik), använd data från dailyStats
    if (isCalendarView && monthlyStats.length > 0) {
      return monthlyStats;
    }

    // Annars (live/översikt), beräkna från timeline som vanligt
    const targetDate = viewDate || now;
    const monthStart = startOfMonth(targetDate);
    const monthEnd = endOfMonth(targetDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return days.map(date => {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);

      // Filtrera timeline-punkter för denna dag
      const dayPoints = timeline.filter(p =>
        p.time >= dayStart && p.time <= dayEnd
      );

      if (dayPoints.length === 0) {
        return {
          date,
          dateStr: format(date, 'yyyy-MM-dd'),
          maxAvg: 0,
          avgAvg: 0,
          maxGust: 0,
          bestSurfability: 'none' as const
        };
      }

      const maxAvg = Math.max(...dayPoints.map(p => p.avg));
      const avgAvg = dayPoints.reduce((sum, p) => sum + p.avg, 0) / dayPoints.length;
      const maxGust = Math.max(...dayPoints.map(p => p.gust));
      const bestSurfability = dayPoints.reduce<Surfability>((best, p) => {
        const order = { none: 0, watching: 1, ok: 2, good: 3 };
        return order[p.surfability] > order[best] ? p.surfability : best;
      }, 'none');

      return {
        date,
        dateStr: format(date, 'yyyy-MM-dd'),
        maxAvg,
        avgAvg,
        maxGust,
        bestSurfability
      };
    });
  }, [timeline, now, viewDate]);

  // Nuvarande vinddata
  const currentWind = useMemo(() => {
    // First, try to find an OBSERVED point marked as "now" (within 5 min of current time)
    // Never use forecast data for "now"
    const nowPoint = timeline.find(p => p.isNow && !p.isForecast);
    if (nowPoint) {
      return {
        avg: nowPoint.avg,
        gust: nowPoint.gust,
        dir: nowPoint.dir,
        isDaylight: nowPoint.isDaylight,
        time: nowPoint.time
      };
    }

    // If no exact "now" point, find the latest OBSERVED (non-forecast) data
    // This ensures we show actual measurements, not forecast data
    const observedPoints = timeline.filter(p => !p.isForecast);
    const latestObserved = observedPoints.length > 0
      ? observedPoints[observedPoints.length - 1]
      : null;

    if (latestObserved) {
      return {
        avg: latestObserved.avg,
        gust: latestObserved.gust,
        dir: latestObserved.dir,
        isDaylight: latestObserved.isDaylight,
        time: latestObserved.time
      };
    }

    // Fallback if no observed data exists
    return { avg: 0, gust: 0, dir: 0, isDaylight: true, time: new Date() };
  }, [timeline]);

  const loading = windLoading || (Object.values(loadingByModel).some(l => l) && timeline.length === 0);
  // Endast kritiskt fel om vi inte kan hämta observerad vinddata
  const error = windError;
  // Varning endast om prognos verkligen saknas (inte bara "en modell failade" men vi har fallback-data)
  const warning = forecastDataRaw.length === 0
    ? (Object.values(modelErrors).find(e => e !== null) || null)
    : null;

  return {
    timeline,
    hourlyBuckets,
    dailySummary,
    currentWind,
    loading,
    error,
    warning,
    thresholds: THRESHOLDS
  };
}

