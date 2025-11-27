import { WindPoint, ForecastModel } from '../types/WindData';
import { fetchWithTimeout } from './fetchWithTimeout';
import { resampleToHourly, validateWindPoint } from '../utils/timeUtils';
import { FORECAST_MODELS } from '../config/constants';

interface SMHITimeSeries {
  validTime: string;
  parameters: Array<{
    name: string;
    values: number[];
  }>;
}

interface SMHIResponse {
  approvedTime: string;
  referenceTime: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  timeSeries: SMHITimeSeries[];
}

export async function fetchSMHI(
  lat: number,
  lon: number,
  cachedETag?: string | null
): Promise<{ data: WindPoint[]; etag: string | null; gridPoint: [number, number] | null }> {
  const url = `${FORECAST_MODELS.SMHI.url}/lon/${lon}/lat/${lat}/data.json`;

  try {
    const response = await fetchWithTimeout(url, { etag: cachedETag }, 6000, 1);

    // Om 304 Not Modified, returnera tom array (användaren ska använda cache)
    if (response.status === 304) {
      return { data: [], etag: cachedETag || null, gridPoint: null };
    }

    if (!response.ok) {
      throw new Error(`SMHI API error: ${response.status}`);
    }

    const json: SMHIResponse = await response.json();
    const etag = response.headers.get('ETag');

    // Läs ut vilken grid-punkt som användes
    const gridPoint: [number, number] | null = json.geometry?.coordinates || null;
    if (gridPoint) {
      console.log(`SMHI grid point: [${gridPoint[0]}, ${gridPoint[1]}]`);
    }

    // Extrahera runTimestamp
    const runTimestamp = json.approvedTime;

    // Mappa till WindPoint
    const points: WindPoint[] = json.timeSeries
      .map((series) => {
        const params = Object.fromEntries(
          series.parameters.map((p) => [p.name, p.values[0]])
        );

        return {
          time: series.validTime,
          wind: Number(params.ws ?? NaN),
          gust: params.gust != null ? Number(params.gust) : null,
          dir: params.wd != null ? Number(params.wd) : null,
          source: ForecastModel.SMHI,
          runTimestamp
        };
      })
      .filter((p) => {
        if (!validateWindPoint(p)) {
          console.warn('Invalid SMHI point filtered out:', p);
          return false;
        }
        return true;
      });

    console.log(`SMHI: Fetched ${points.length} valid points`);

    // Resampla till heltimmar
    const resampled = resampleToHourly(points);
    console.log(`SMHI: Resampled to ${resampled.length} hourly points`);

    return { data: resampled, etag, gridPoint };
  } catch (error) {
    console.error('SMHI fetch error:', error);
    throw error;
  }
}

