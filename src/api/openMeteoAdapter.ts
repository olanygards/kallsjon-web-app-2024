import { WindPoint, ForecastModel } from '../types/WindData';
import { fetchWithTimeout } from './fetchWithTimeout';
import { validateWindPoint } from '../utils/timeUtils';
import { OPEN_METEO_URL, FORECAST_MODELS } from '../config/constants';

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    wind_speed_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
  };
}

export type OpenMeteoModel = ForecastModel.ECMWF | ForecastModel.GFS | ForecastModel.ICON;

const MODEL_CONFIG: Record<OpenMeteoModel, { openMeteoId: string }> = {
  [ForecastModel.ECMWF]: { openMeteoId: FORECAST_MODELS.ECMWF.openMeteoId },
  [ForecastModel.GFS]: { openMeteoId: FORECAST_MODELS.GFS.openMeteoId },
  [ForecastModel.ICON]: { openMeteoId: FORECAST_MODELS.ICON.openMeteoId },
};

/**
 * Hämtar 7 dagars timprognos från Open-Meteo för en av modellerna ECMWF/GFS/ICON.
 * Svarstider är redan heltimmar — ingen resampling behövs.
 */
export async function fetchOpenMeteo(
  lat: number,
  lon: number,
  model: OpenMeteoModel
): Promise<{ data: WindPoint[]; etag: string | null }> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    wind_speed_unit: 'ms',
    forecast_days: '7',
    models: MODEL_CONFIG[model].openMeteoId,
    timezone: 'UTC',
  });

  const response = await fetchWithTimeout(`${OPEN_METEO_URL}?${params}`, {}, 6000, 1);

  if (!response.ok) {
    throw new Error(`Open-Meteo API error (${model}): ${response.status}`);
  }

  const json: OpenMeteoResponse = await response.json();
  const { time, wind_speed_10m, wind_gusts_10m, wind_direction_10m } = json.hourly;

  const points: WindPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    const wind = wind_speed_10m[i];
    if (wind == null) continue;

    const point: WindPoint = {
      // Open-Meteo ger "YYYY-MM-DDTHH:mm" utan offset; vi begär UTC och gör strängen explicit
      time: `${time[i]}:00Z`,
      wind,
      gust: wind_gusts_10m[i],
      dir: wind_direction_10m[i],
      source: model,
    };

    if (validateWindPoint(point)) {
      points.push(point);
    }
  }

  console.log(`Open-Meteo ${model}: Fetched ${points.length} valid points`);
  return { data: points, etag: null };
}
