import { useMemo } from 'react';
import { addMinutes, roundToNearestMinutes, format, isToday } from 'date-fns';
import { WindData } from '../types/WindData';

interface UseProcessedWindDataParams {
  windData: WindData[] | undefined;
  forecastData: WindData[] | undefined;
  todayTimeWindow: { start: Date; end: Date } | null;
  viewDateRange: { start: Date; end: Date }; // The active view range (e.g. 1 day or 7 days)
}

export function useProcessedWindData({
  windData,
  forecastData,
  todayTimeWindow,
  viewDateRange
}: UseProcessedWindDataParams) {

  const processedForecastData = useMemo(() => {
    if (!forecastData) return [];

    const seenTimes = new Set<number>();
    const rangeStart = todayTimeWindow ? todayTimeWindow.start : viewDateRange.start;
    const rangeEnd = todayTimeWindow ? todayTimeWindow.end : viewDateRange.end;

    try {
      return forecastData
        .filter(f => {
          if (!f || typeof f !== 'object') return false;
          if (!f.time || typeof f.time !== 'object') return false;
          if (typeof f.windSpeed !== 'number') return false;
          if (typeof f.windDirection !== 'number') return false;

          // Check time range
          if (f.time < rangeStart || f.time > rangeEnd) return false;

          return true;
        })
        .filter((f): f is NonNullable<typeof f> => {
          const timeStamp = f.time.getTime();
          if (seenTimes.has(timeStamp)) return false;
          seenTimes.add(timeStamp);

          return isToday(f.time) || f.time > new Date();
        })
        .sort((a, b) => a.time.getTime() - b.time.getTime());
    } catch (error) {
      console.error('Error processing forecast data:', error);
      return [];
    }
  }, [forecastData, todayTimeWindow, viewDateRange]);

  const processedWindData = useMemo(() => {
    if (!windData) return [];

    const seenTimes = new Set<number>();
    // Note: We generally don't filter observed data strictly by viewDateRange if it was already fetched for that day, 
    // but consistency is good. However, observed data is usually historical.

    // If todayTimeWindow is active (e.g. Today view), filter strictly.
    // If navigating history (viewDateRange), we might want to be more lenient or filter by that day.

    const rangeStart = todayTimeWindow ? todayTimeWindow.start : viewDateRange.start;
    const rangeEnd = todayTimeWindow ? todayTimeWindow.end : viewDateRange.end;

    return windData
      .filter(data => {
        if (!data?.time || isNaN(data.time.getTime())) return false;
        if (typeof data.windSpeed !== 'number') return false;

        // Filter to range
        if (data.time < rangeStart || data.time > rangeEnd) return false;

        const timeStamp = data.time.getTime();
        if (seenTimes.has(timeStamp)) return false;
        seenTimes.add(timeStamp);

        return true;
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [windData, todayTimeWindow, viewDateRange]);

  // Aggregated Observed Data for the Chart (15-minute intervals)
  const aggregatedWindData = useMemo(() => {
    if (!processedWindData.length) return [];

    const aggregatedData = [];
    let currentIntervalStart = roundToNearestMinutes(processedWindData[0].time, { nearestTo: 15 });
    let nextIntervalStart = addMinutes(currentIntervalStart, 15);
    let sumWindSpeed = 0;
    let sumWindGust = 0;
    let sumWindDirectionSin = 0;
    let sumWindDirectionCos = 0;
    let count = 0;

    processedWindData.forEach(data => {
      while (data.time >= nextIntervalStart) {
        if (count > 0) {
          const avgWindDirection =
            (Math.atan2(sumWindDirectionSin / count, sumWindDirectionCos / count) * 180) / Math.PI;
          const adjustedWindDirection = (avgWindDirection + 360) % 360;

          aggregatedData.push({
            time: currentIntervalStart,
            windSpeed: sumWindSpeed / count,
            windGust: sumWindGust / count,
            windDirection: adjustedWindDirection,
            isForecast: false,
          });
        }
        // Move to the next interval
        currentIntervalStart = nextIntervalStart;
        nextIntervalStart = addMinutes(currentIntervalStart, 15);
        sumWindSpeed = 0;
        sumWindGust = 0;
        sumWindDirectionSin = 0;
        sumWindDirectionCos = 0;
        count = 0;
      }

      sumWindSpeed += data.windSpeed;
      sumWindGust += data.windGust;
      // Convert wind direction to radians for averaging
      const windDirRadians = (data.windDirection * Math.PI) / 180;
      sumWindDirectionSin += Math.sin(windDirRadians);
      sumWindDirectionCos += Math.cos(windDirRadians);
      count += 1;
    });

    // Add the last aggregated data point
    if (count > 0) {
      const avgWindDirection =
        (Math.atan2(sumWindDirectionSin / count, sumWindDirectionCos / count) * 180) / Math.PI;
      const adjustedWindDirection = (avgWindDirection + 360) % 360;

      aggregatedData.push({
        time: currentIntervalStart,
        windSpeed: sumWindSpeed / count,
        windGust: sumWindGust / count,
        windDirection: adjustedWindDirection,
        isForecast: false,
      });
    }

    return aggregatedData;
  }, [processedWindData]);

  // Group wind data by hour
  const groupedWindData = useMemo(() => {
    if (!processedWindData.length) return {};

    return processedWindData.reduce((groups, item) => {
      const hourKey = format(item.time, 'yyyy-MM-dd HH:00');
      if (!groups[hourKey]) groups[hourKey] = { best: item, records: [] };

      groups[hourKey].records.push(item);
      if (item.windSpeed > groups[hourKey].best.windSpeed) {
        groups[hourKey].best = item;
      }

      return groups;
    }, {} as Record<string, { best: WindData; records: WindData[] }>);
  }, [processedWindData]);

  const groupedByDate = useMemo(() => {
    const result: Record<string, { best: WindData; records: WindData[] }[]> = {};
    Object.entries(groupedWindData).forEach(([hourKey, group]) => {
      const dateKey = hourKey.substring(0, 10);
      if (!result[dateKey]) {
        result[dateKey] = [];
      }
      result[dateKey].push(group);
    });
    return result;
  }, [groupedWindData]);

  const groupedForecastData = useMemo(() => {
    if (!processedForecastData.length) return {};

    return processedForecastData.reduce((groups, item) => {
      const hourKey = format(item.time, 'yyyy-MM-dd HH:00');
      if (!groups[hourKey]) groups[hourKey] = { best: item, records: [] };

      groups[hourKey].records.push(item);
      if (item.windSpeed > groups[hourKey].best.windSpeed) {
        groups[hourKey].best = item;
      }

      return groups;
    }, {} as Record<string, { best: WindData; records: WindData[] }>);
  }, [processedForecastData]);

  return {
    processedForecastData,
    processedWindData,
    aggregatedWindData,
    groupedWindData,
    groupedByDate,
    groupedForecastData
  };
}
