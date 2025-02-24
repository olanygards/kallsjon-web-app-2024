import { useState, useEffect, useRef } from 'react';
import { WindData } from '../types/WindData';

interface SmhiForecastData {
  validTime: string;
  parameters: Array<{
    name: string;
    values: number[];
  }>;
}

interface UseForecastProps {
  startDate: Date;
  endDate: Date;
}

export function useForecast({ startDate, endDate }: UseForecastProps) {
  const [data, setData] = useState<WindData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cleanup any existing controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    async function fetchForecast() {
      try {
        abortControllerRef.current = new AbortController();
        const response = await fetch(
          'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/13.8/lat/63.3/data.json',
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch forecast data');
        }

        const result = await response.json();
        const forecastData = result.timeSeries as SmhiForecastData[];

        // Convert SmhiForecastData to WindData
        const windData = forecastData
          .filter(f => {
            const time = new Date(f.validTime);
            return time >= startDate && time <= endDate;
          })
          .map(f => {
            const time = new Date(f.validTime);
            const windSpeed = f.parameters.find(p => p.name === 'ws')?.values[0] ?? 0;
            const windDirection = f.parameters.find(p => p.name === 'wd')?.values[0] ?? 0;
            const windGust = windSpeed * 1.5; // Estimate gust as 1.5x wind speed

            return {
              time,
              windSpeed,
              windDirection,
              windGust,
              isForecast: true,
            };
          });

        setData(windData);
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error fetching forecast:', err);
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchForecast();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [startDate, endDate]);

  return { data, loading, error };
}