import { useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfDay, startOfHour } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ForecastModel, WindPoint } from '../types/WindData';
import { useForecastModels } from './useForecastModels';
import { KALLSJON, FORECAST_MODELS } from '../config/constants';
import { circularMean } from '../utils/timeUtils';
import { getBestSlotPerDay, DayBest } from '../utils/bestWindPerDay';

export const MATRIX_SLOT_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];
const MATRIX_DAYS = 7;

export interface MatrixCell {
  time: Date;
  wind: number;
  gust: number | null;
  dir: number | null;
  isPast: boolean;
}

export interface MatrixRow {
  model: ForecastModel;
  name: string;
  isConsensus: boolean;
  loading: boolean;
  error: Error | null;
  /** En cell per slot i vald dag; null = ingen data */
  cells: (MatrixCell | null)[];
}

export interface MatrixDay {
  dateKey: string;
  date: Date;
  label: string;
}

/** Aggregerar timpunkter till en 3h-cell: medel av vind, max by, cirkulärt riktningsmedel */
function aggregateSlot(points: WindPoint[], slotTime: Date, now: Date): MatrixCell | null {
  if (points.length === 0) return null;

  const winds = points.map(p => p.wind);
  const gusts = points.map(p => p.gust).filter((g): g is number => g !== null);
  const dirs = points.map(p => p.dir).filter((d): d is number => d !== null);

  return {
    time: slotTime,
    wind: winds.reduce((a, b) => a + b, 0) / winds.length,
    gust: gusts.length > 0 ? Math.max(...gusts) : null,
    dir: dirs.length > 0 ? circularMean(dirs) : null,
    isPast: slotTime.getTime() + 3 * 60 * 60 * 1000 <= now.getTime(),
  };
}

/**
 * Modellmatris för Prognos-fliken: 7 dagar, 3h-slots, en dag visas åt gången.
 * Datakällor: Open-Meteo (ECMWF/GFS/ICON) + MET Norway (+ SMHI i dev) + consensus.
 */
export function useForecastMatrix() {
  const now = useMemo(() => new Date(), []);
  const startDate = useMemo(() => startOfDay(now), [now]);
  const endDate = useMemo(() => addDays(startDate, MATRIX_DAYS), [startDate]);

  const enabledModels = useMemo(() => {
    const models = [
      ForecastModel.MET_NORWAY,
      ForecastModel.ECMWF,
      ForecastModel.GFS,
      ForecastModel.ICON,
    ];
    if (!import.meta.env.PROD) {
      models.push(ForecastModel.SMHI); // CORS blockerar SMHI i prod (Fas B)
    }
    return models;
  }, []);

  const { dataByModel, loadingByModel, errors, refetch } = useForecastModels({
    lat: KALLSJON.lat,
    lon: KALLSJON.lon,
    startDate,
    endDate,
    enabledModels,
  });

  // Dagar i remsan
  const days = useMemo<MatrixDay[]>(() => {
    const todayKey = format(now, 'yyyy-MM-dd');
    return Array.from({ length: MATRIX_DAYS }, (_, i) => {
      const date = addDays(startDate, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        dateKey,
        date,
        label: dateKey === todayKey
          ? 'Idag'
          : format(date, 'EEE', { locale: sv }).replace('.', ''),
      };
    });
  }, [now, startDate]);

  const [selectedDayKey, setSelectedDayKey] = useState(() => format(now, 'yyyy-MM-dd'));

  // Bästa vind per dag för dagremsan — consensus i första hand
  const dayBests = useMemo<DayBest[]>(() => {
    const source =
      (dataByModel[ForecastModel.CONSENSUS]?.length ?? 0) > 0
        ? dataByModel[ForecastModel.CONSENSUS]
        : (dataByModel[ForecastModel.MET_NORWAY]?.length ?? 0) > 0
          ? dataByModel[ForecastModel.MET_NORWAY]
          : dataByModel[ForecastModel.ECMWF] ?? [];

    const slots = source.map(p => ({
      time: parseISO(p.time),
      avg: p.wind,
      gust: p.gust ?? p.wind,
      dir: p.dir,
    }));
    return getBestSlotPerDay(slots, MATRIX_DAYS);
  }, [dataByModel]);

  // Rader för vald dag
  const rows = useMemo<MatrixRow[]>(() => {
    const dayStart = parseISO(`${selectedDayKey}T00:00:00`);

    const modelOrder: ForecastModel[] = [
      ForecastModel.CONSENSUS,
      ForecastModel.MET_NORWAY,
      ...(!import.meta.env.PROD ? [ForecastModel.SMHI] : []),
      ForecastModel.ECMWF,
      ForecastModel.GFS,
      ForecastModel.ICON,
    ];

    return modelOrder
      .map(model => {
        const points = dataByModel[model] ?? [];

        const cells = MATRIX_SLOT_HOURS.map(hour => {
          const slotStart = new Date(dayStart);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + 3 * 60 * 60 * 1000);

          const slotPoints = points.filter(p => {
            const t = startOfHour(parseISO(p.time));
            return t >= slotStart && t < slotEnd;
          });

          return aggregateSlot(slotPoints, slotStart, now);
        });

        const meta = Object.values(FORECAST_MODELS).find(m => m.id === model);

        return {
          model,
          name: meta?.name ?? model.toUpperCase(),
          isConsensus: model === ForecastModel.CONSENSUS,
          loading: loadingByModel[model] ?? false,
          error: errors[model] ?? null,
          cells,
        };
      })
      // Consensus utan data (t.ex. bara en modell svarade) döljs; övriga rader visas med felstatus
      .filter(row => !(row.isConsensus && row.cells.every(c => c === null)));
  }, [dataByModel, loadingByModel, errors, selectedDayKey, now]);

  const loading = Object.entries(loadingByModel)
    .filter(([model]) => enabledModels.includes(model as ForecastModel))
    .some(([, l]) => l);

  return {
    days,
    dayBests,
    selectedDayKey,
    setSelectedDayKey,
    rows,
    slotHours: MATRIX_SLOT_HOURS,
    loading,
    refetch,
  };
}
