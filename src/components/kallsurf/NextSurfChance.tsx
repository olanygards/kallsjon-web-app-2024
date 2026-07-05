import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { HourlyBucket } from '../../hooks/useKallsurfTimeline';
import { WIND_SCALE_LEVELS, getEffectiveLevelIndex } from '../../config/windScale';

const INTERESTING_INDEX = WIND_SCALE_LEVELS.findIndex(l => l.id === 'interesting');

const getPartOfDay = (hour: number): string => {
  if (hour < 6) return 'natt';
  if (hour < 10) return 'morgon';
  if (hour < 12) return 'förmiddag';
  if (hour < 18) return 'eftermiddag';
  if (hour < 23) return 'kväll';
  return 'natt';
};

interface Chance {
  bucket: HourlyBucket;
  maxAvg: number;
  maxGust: number;
}

/** Första prognoslucka ≥ Intressant + max inom det sammanhängande fönstret */
function findChance(future: HourlyBucket[]): Chance | null {
  const first = future.find(b => getEffectiveLevelIndex(b.avg, b.gust) >= INTERESTING_INDEX);
  if (!first) return null;

  let maxAvg = first.avg;
  let maxGust = first.gust;
  const startIdx = future.indexOf(first);
  for (let i = startIdx + 1; i < future.length; i++) {
    const b = future[i];
    if (getEffectiveLevelIndex(b.avg, b.gust) < INTERESTING_INDEX) break;
    if (b.time.getTime() - first.time.getTime() > 12 * 60 * 60 * 1000) break;
    maxAvg = Math.max(maxAvg, b.avg);
    maxGust = Math.max(maxGust, b.gust);
  }

  return { bucket: first, maxAvg, maxGust };
}

interface NextSurfChanceProps {
  hourlyBuckets: HourlyBucket[];
  currentWind: { avg: number; gust: number };
  onClick?: (date: Date) => void;
}

/**
 * "Nästa surfchans" enligt UX-skiss v1.4 (3a): första prognoslucka som når
 * Intressant eller högre. Döljs när det redan är minst Intressant nu —
 * då är svaret "nu" och hero-kortet bär det.
 */
export function NextSurfChance({ hourlyBuckets, currentWind, onClick }: NextSurfChanceProps) {
  const { chance, hasForecast } = useMemo(() => {
    const now = new Date();
    const future = hourlyBuckets.filter(b => b.isForecast && b.time > now);
    return { chance: findChance(future), hasForecast: future.length > 0 };
  }, [hourlyBuckets]);

  const nowIndex = getEffectiveLevelIndex(currentWind.avg, currentWind.gust);
  if (nowIndex >= INTERESTING_INDEX) return null;

  // Skilj på "lugn prognos" och "prognos saknas" — annars ljuger kortet
  // när prognoskällorna är nere.
  if (!hasForecast || !chance) {
    return (
      <div className="bg-app-surface-elevated border border-app-border-muted rounded-2xl p-4">
        <h3 className="text-app-muted text-[10px] uppercase tracking-wider font-bold mb-1">
          Nästa surfchans
        </h3>
        <p className="text-sm text-app-muted">
          {hasForecast
            ? 'Inget i sikte inom 7 dygn — lugn prognos.'
            : 'Prognosdata saknas just nu — kan inte bedöma kommande dagar.'}
        </p>
      </div>
    );
  }

  const { bucket, maxAvg, maxGust } = chance;
  const level = WIND_SCALE_LEVELS[getEffectiveLevelIndex(bucket.avg, bucket.gust)];
  const lowAvg = Math.round(bucket.avg);
  const highAvg = Math.round(maxAvg);
  const avgText = highAvg > lowAvg ? `${lowAvg}–${highAvg}` : `${lowAvg}`;

  return (
    <button
      onClick={() => onClick?.(bucket.time)}
      className="w-full text-left bg-app-surface-elevated border border-app-border-muted rounded-2xl p-4 transition-all hover:border-app-text/30 active:scale-[0.99] cursor-pointer"
    >
      <h3 className="text-app-muted text-[10px] uppercase tracking-wider font-bold mb-1">
        Nästa surfchans
      </h3>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-app-text capitalize leading-tight">
            {format(bucket.time, 'EEE d MMMM', { locale: sv })} · {getPartOfDay(bucket.time.getHours())}
          </p>
          <p className="text-xs text-app-muted mt-0.5">
            {level.label} — prognos {avgText} m/s, by {Math.round(maxGust)}
          </p>
        </div>
        <ChevronRight size={18} className="text-app-subtle flex-shrink-0" />
      </div>
    </button>
  );
}
