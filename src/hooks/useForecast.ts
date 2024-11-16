import { useState, useEffect } from 'react';

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

  useEffect(() => {
    async function fetchForecast() {
      try {
        const response = await fetch(
          "https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/13.013262/lat/63.572468/data.json"
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch forecast');
        }
        
        const json = await response.json();
        setData(json.timeSeries);
        setLoading(false);
      } catch (err) {
        setError(err as Error);
        setLoading(false);
      }
    }

    fetchForecast();
  }, []);

  return { data, loading, error };
}