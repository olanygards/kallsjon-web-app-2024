import { WindPoint, ForecastModel } from '../types/WindData';
import { fetchWithTimeout } from './fetchWithTimeout';
import { resampleToHourly, validateWindPoint } from '../utils/timeUtils';
import { FORECAST_MODELS } from '../config/constants';

interface METTimeSeries {
  time: string;
  data: {
    instant: {
      details: {
        wind_speed?: number;
        wind_from_direction?: number;
        wind_speed_of_gust?: number;
      };
    };
  };
}

interface METResponse {
  properties: {
    meta: {
      updated_at: string;
    };
    timeseries: METTimeSeries[];
  };
}

export async function fetchMetNorway(
  lat: number,
  lon: number,
  altitude: number,
  cachedETag?: string | null
): Promise<{ data: WindPoint[]; etag: string | null }> {
  const url = `${FORECAST_MODELS.MET_NORWAY.url}?lat=${lat}&lon=${lon}&altitude=${altitude}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': FORECAST_MODELS.MET_NORWAY.userAgent
        },
        etag: cachedETag
      },
      6000,
      1
    );

    // Om 304 Not Modified, returnera tom array (användaren ska använda cache)
    if (response.status === 304) {
      return { data: [], etag: cachedETag || null };
    }

    if (!response.ok) {
      throw new Error(`MET Norway API error: ${response.status}`);
    }

    const json: METResponse = await response.json();
    const etag = response.headers.get('ETag');

    // Extrahera runTimestamp
    const runTimestamp = json.properties.meta.updated_at;

    // Mappa till WindPoint
    const points: WindPoint[] = json.properties.timeseries
      .map((series) => {
        const details = series.data?.instant?.details ?? {};

        return {
          time: series.time,
          wind: Number(details.wind_speed ?? NaN),
          gust: details.wind_speed_of_gust != null ? Number(details.wind_speed_of_gust) : null,
          dir: details.wind_from_direction != null ? Number(details.wind_from_direction) : null,
          source: ForecastModel.MET_NORWAY,
          runTimestamp
        };
      })
      .filter((p) => {
        if (!validateWindPoint(p)) {
          console.warn('Invalid MET Norway point filtered out:', p);
          return false;
        }
        return true;
      });

    console.log(`MET Norway: Fetched ${points.length} valid points`);

    // Resampla till heltimmar
    const resampled = resampleToHourly(points);
    console.log(`MET Norway: Resampled to ${resampled.length} hourly points`);

    return { data: resampled, etag };
  } catch (error) {
    console.error('MET Norway fetch error:', error);
    throw error;
  }
}

