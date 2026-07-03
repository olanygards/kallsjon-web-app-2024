import { useState, useEffect, useCallback } from 'react';
import { isWithinInterval, parseISO } from 'date-fns';
import { WindPoint, ForecastModel } from '../types/WindData';
import { fetchSMHI } from '../api/smhiAdapter';
import { fetchMetNorway } from '../api/metNorwayAdapter';
import { fetchOpenMeteo, OpenMeteoModel } from '../api/openMeteoAdapter';
import { cacheStorage } from '../utils/cacheStorage';
import { getCacheKey, get15MinBucket, circularMean } from '../utils/timeUtils';
import { KALLSJON, FETCH_CONFIG } from '../config/constants';

const ALL_MODELS = Object.values(ForecastModel);

function emptyRecord<T>(value: T): Record<ForecastModel, T> {
  return Object.fromEntries(ALL_MODELS.map(m => [m, value])) as Record<ForecastModel, T>;
}

const OPEN_METEO_MODELS: OpenMeteoModel[] = [
  ForecastModel.ECMWF,
  ForecastModel.GFS,
  ForecastModel.ICON
];

interface UseForecastModelsParams {
  lat: number;
  lon: number;
  startDate: Date;
  endDate: Date;
  enabledModels: ForecastModel[];
}

interface UseForecastModelsReturn {
  dataByModel: Record<ForecastModel, WindPoint[]>;
  loadingByModel: Record<ForecastModel, boolean>;
  errors: Record<ForecastModel, Error | null>;
  lastUpdatedByModel: Record<ForecastModel, string | null>;
  modelSpread: Record<string, number>;
  refetch: () => void;
}

/**
 * Beräknar consensus från flera modellers data
 */
function calculateConsensus(models: WindPoint[][]): WindPoint[] {
  if (models.length === 0) return [];

  // Gruppera alla punkter per timme
  const timeMap = new Map<string, WindPoint[]>();

  models.forEach(modelData => {
    modelData.forEach(point => {
      if (!timeMap.has(point.time)) {
        timeMap.set(point.time, []);
      }
      timeMap.get(point.time)!.push(point);
    });
  });

  // Beräkna median/medel för varje timme
  const consensus: WindPoint[] = [];

  timeMap.forEach((points, time) => {
    if (points.length === 0) return;

    // Median av wind
    const winds = points.map(p => p.wind).sort((a, b) => a - b);
    const medianWind = winds.length % 2 === 0
      ? (winds[winds.length / 2 - 1] + winds[winds.length / 2]) / 2
      : winds[Math.floor(winds.length / 2)];

    // Max av gust
    const gusts = points.map(p => p.gust).filter((g): g is number => g !== null);
    const maxGust = gusts.length > 0 ? Math.max(...gusts) : null;

    // Cirkulärt medel av dir
    const dirs = points.map(p => p.dir).filter((d): d is number => d !== null);
    const avgDir = dirs.length > 0 ? circularMean(dirs) : null;

    consensus.push({
      time,
      wind: medianWind,
      gust: maxGust,
      dir: avgDir,
      source: ForecastModel.CONSENSUS,
      runTimestamp: points[0].runTimestamp
    });
  });

  return consensus.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Beräknar spridning mellan modeller per timme
 */
function calculateModelSpread(models: WindPoint[][]): Record<string, number> {
  const spread: Record<string, number> = {};

  if (models.length < 2) return spread;

  // Gruppera per timme
  const timeMap = new Map<string, number[]>();

  models.forEach(modelData => {
    modelData.forEach(point => {
      if (!timeMap.has(point.time)) {
        timeMap.set(point.time, []);
      }
      timeMap.get(point.time)!.push(point.wind);
    });
  });

  // Beräkna spread (max - min)
  timeMap.forEach((winds, time) => {
    if (winds.length >= 2) {
      spread[time] = Math.max(...winds) - Math.min(...winds);
    }
  });

  return spread;
}

export function useForecastModels({
  lat,
  lon,
  startDate,
  endDate,
  enabledModels
}: UseForecastModelsParams): UseForecastModelsReturn {
  const [dataByModel, setDataByModel] = useState<Record<ForecastModel, WindPoint[]>>(() => emptyRecord<WindPoint[]>([]));
  const [loadingByModel, setLoadingByModel] = useState<Record<ForecastModel, boolean>>(() => emptyRecord(false));
  const [errors, setErrors] = useState<Record<ForecastModel, Error | null>>(() => emptyRecord<Error | null>(null));
  const [lastUpdatedByModel, setLastUpdatedByModel] = useState<Record<ForecastModel, string | null>>(() => emptyRecord<string | null>(null));

  const [modelSpread, setModelSpread] = useState<Record<string, number>>({});
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      const bucket = get15MinBucket();
      const fetchPromises: Array<Promise<{ model: ForecastModel; data: WindPoint[] }>> = [];
      // Håller reda på vilken modell varje promise gäller (ordningen i
      // fetchPromises följer inte nödvändigtvis enabledModels)
      const promiseModels: ForecastModel[] = [];

      // Filtrera bort CONSENSUS från enabled models (den beräknas senare)
      const modelsToFetch = enabledModels.filter(m => m !== ForecastModel.CONSENSUS);

      modelsToFetch.forEach(model => {
        setLoadingByModel(prev => ({ ...prev, [model]: true }));
      });

      // SMHI
      if (modelsToFetch.includes(ForecastModel.SMHI)) {
        const cacheKey = `forecast_cache_${getCacheKey('smhi', lat, lon, undefined, bucket)}`;
        const cachedETag = cacheStorage.getETag(cacheKey);

        promiseModels.push(ForecastModel.SMHI);
        fetchPromises.push(
          fetchSMHI(lat, lon, cachedETag)
            .then(({ data, etag }) => {
              // Om 304, använd cache
              if (data.length === 0 && cacheStorage.has(cacheKey, FETCH_CONFIG.CACHE_DURATION_MS)) {
                const cached = cacheStorage.get(cacheKey);
                return { model: ForecastModel.SMHI, data: cached || [] };
              }

              // Spara i cache
              if (data.length > 0) {
                cacheStorage.set(cacheKey, data, FETCH_CONFIG.CACHE_DURATION_MS, etag || undefined);
              }

              return { model: ForecastModel.SMHI, data };
            })
            .catch(err => {
              // Vid fel, försök använda cache
              if (cacheStorage.has(cacheKey)) {
                console.warn('SMHI fetch failed, using cache');
                const cached = cacheStorage.get(cacheKey);
                if (mounted) {
                  setErrors(prev => ({ ...prev, [ForecastModel.SMHI]: err }));
                }
                return { model: ForecastModel.SMHI, data: cached || [] };
              }
              throw err;
            })
        );
      }

      // MET Norway
      if (modelsToFetch.includes(ForecastModel.MET_NORWAY)) {
        const cacheKey = `forecast_cache_${getCacheKey('met_norway', lat, lon, undefined, bucket)}`;
        const cachedETag = cacheStorage.getETag(cacheKey);

        promiseModels.push(ForecastModel.MET_NORWAY);
        fetchPromises.push(
          fetchMetNorway(lat, lon, KALLSJON.altitude, cachedETag)
            .then(({ data, etag }) => {
              // Om 304, använd cache
              if (data.length === 0 && cacheStorage.has(cacheKey, FETCH_CONFIG.CACHE_DURATION_MS)) {
                const cached = cacheStorage.get(cacheKey);
                return { model: ForecastModel.MET_NORWAY, data: cached || [] };
              }

              // Spara i cache
              if (data.length > 0) {
                cacheStorage.set(cacheKey, data, FETCH_CONFIG.CACHE_DURATION_MS, etag || undefined);
              }

              return { model: ForecastModel.MET_NORWAY, data };
            })
            .catch(err => {
              // Vid fel, försök använda cache
              if (cacheStorage.has(cacheKey)) {
                console.warn('MET Norway fetch failed, using cache');
                const cached = cacheStorage.get(cacheKey);
                if (mounted) {
                  setErrors(prev => ({ ...prev, [ForecastModel.MET_NORWAY]: err }));
                }
                return { model: ForecastModel.MET_NORWAY, data: cached || [] };
              }
              throw err;
            })
        );
      }

      // Open-Meteo (ECMWF / GFS / ICON)
      OPEN_METEO_MODELS.filter(m => modelsToFetch.includes(m)).forEach(model => {
        const cacheKey = `forecast_cache_${getCacheKey(model, lat, lon, undefined, bucket)}`;

        promiseModels.push(model);
        fetchPromises.push(
          fetchOpenMeteo(lat, lon, model)
            .then(({ data }) => {
              if (data.length > 0) {
                cacheStorage.set(cacheKey, data, FETCH_CONFIG.CACHE_DURATION_MS);
              }
              return { model, data };
            })
            .catch(err => {
              if (cacheStorage.has(cacheKey)) {
                console.warn(`Open-Meteo ${model} fetch failed, using cache`);
                const cached = cacheStorage.get(cacheKey);
                if (mounted) {
                  setErrors(prev => ({ ...prev, [model]: err }));
                }
                return { model, data: (cached || []) as WindPoint[] };
              }
              throw err;
            })
        );
      });

      // Hämta alla parallellt
      const results = await Promise.allSettled(fetchPromises);

      if (!mounted) return;

      const newData = emptyRecord<WindPoint[]>([]);
      const newErrors = emptyRecord<Error | null>(null);
      const newLastUpdated = emptyRecord<string | null>(null);

      // Bearbeta resultat
      results.forEach((result, index) => {
        const model = promiseModels[index];

        if (result.status === 'fulfilled') {
          const { data } = result.value;

          // Filtrera till tidsintervall
          const filtered = data.filter(point => {
            const time = parseISO(point.time);
            return isWithinInterval(time, { start: startDate, end: endDate });
          });

          newData[model] = filtered;
          newLastUpdated[model] = new Date().toISOString();
          newErrors[model] = null;
        } else {
          console.error(`${model} fetch failed:`, result.reason);
          newErrors[model] = result.reason;
        }
      });

      // Beräkna consensus om vi har minst 2 modeller
      const validModels = Object.entries(newData)
        .filter(([key, data]) => key !== 'consensus' && data.length > 0)
        .map(([, data]) => data);

      if (validModels.length >= 2) {
        newData[ForecastModel.CONSENSUS] = calculateConsensus(validModels);
        newLastUpdated[ForecastModel.CONSENSUS] = new Date().toISOString();
      }

      // Beräkna model spread
      const spread = calculateModelSpread(validModels);

      setDataByModel(newData);
      setErrors(newErrors);
      setLastUpdatedByModel(newLastUpdated);
      setModelSpread(spread);

      // Sätt loading till false
      modelsToFetch.forEach(model => {
        setLoadingByModel(prev => ({ ...prev, [model]: false }));
      });
    };

    fetchData();

    return () => {
      mounted = false;
    };
    // Use primitive values for dependencies to avoid infinite loops from unstable object references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, startDate.getTime(), endDate.getTime(), enabledModels.sort().join(','), refetchTrigger]);

  return {
    dataByModel,
    loadingByModel,
    errors,
    lastUpdatedByModel,
    modelSpread,
    refetch
  };
}

