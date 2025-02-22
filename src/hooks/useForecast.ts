import { useState, useEffect, useRef } from 'react';

interface SmhiForecastData {
  validTime: string;
  parameters: Array<{
    name: string;
    values: number[];
  }>;
}

export function useForecast() {
  const [data, setData] = useState<SmhiForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cleanup any existing controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    async function fetchForecast() {
      try {
        const response = await fetch(
          "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/13.013262/lat/63.572468/data.json",
          { signal: abortController.signal }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch forecast');
        }
        
        const json = await response.json();
        // Only update state if the controller hasn't been aborted
        if (abortControllerRef.current === abortController) {
          setData(json.timeSeries);
          setLoading(false);
        }
      } catch (err: unknown) {
        // Only handle error if it's not an abort error and the controller is still active
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (abortControllerRef.current === abortController) {
          setError(err instanceof Error ? err : new Error('An unknown error occurred'));
          setLoading(false);
        }
      }
    }

    fetchForecast();

    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, []);

  return { data, loading, error };
}