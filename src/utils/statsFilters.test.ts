import { describe, expect, it } from 'vitest';
import type { DailyStats } from '../hooks/useDailyStats';
import { WIND_SCALE_LEVELS } from '../config/windScale';
import { applyStatsFilters, DEFAULT_STATS_FILTERS } from './statsFilters';
import { degreesToSector8 } from './windDirection8';

const SURFABLE = WIND_SCALE_LEVELS.findIndex((l) => l.id === 'surfable');

function day(partial: Partial<DailyStats> & Pick<DailyStats, 'date'>): DailyStats {
  return {
    year: Number(partial.date.slice(0, 4)),
    month: Number(partial.date.slice(5, 7)),
    maxForce: 9.6,
    maxForceTime: new Date(partial.date),
    avgForce: 7,
    minForce: 3,
    maxForceDirection: 265,
    maxGust: 16.2,
    maxGustTime: new Date(partial.date),
    dataPointsCount: 100,
    hasStrongWind: false,
    hasGaleForce: false,
    isSurfableDay: true,
    surfableMinutes: 120,
    surfableMinutesDaylight: 120,
    peakLevelIndex: SURFABLE,
    peakLevelIndexDaylight: SURFABLE,
    ...partial,
  };
}

/** Brief Paket 3 — fyra obligatoriska fall (Beslut 06). */
describe('applyStatsFilters (Paket 3)', () => {
  it('gust-dag passerar Surfbart-preset trots medel < 10', () => {
    const gustDay = day({ date: '2024-07-02', maxForce: 9.6, maxGust: 16.2, hasStrongWind: false });
    const result = applyStatsFilters([gustDay], DEFAULT_STATS_FILTERS);
    expect(result.days).toHaveLength(1);
  });

  it('dag med enbart nattsurf faller på dagsljusfiltret', () => {
    const nightDay = day({
      date: '2024-07-10',
      surfableMinutes: 90,
      surfableMinutesDaylight: 0,
      peakLevelIndexDaylight: 0,
    });
    const result = applyStatsFilters([nightDay], DEFAULT_STATS_FILTERS);
    expect(result.days).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  it('riktning 350° matchar sektor N', () => {
    expect(degreesToSector8(350)).toBe('N');
  });

  it('år-filter begränsar till valt år', () => {
    const d2024 = day({ date: '2024-05-04' });
    const d2025 = day({ date: '2025-05-04' });
    const yearFilter = { ...DEFAULT_STATS_FILTERS, year: 2024 as const };
    expect(applyStatsFilters([d2024, d2025], yearFilter).days).toHaveLength(1);
  });

  it('Alla inkluderar alla år', () => {
    const d2024 = day({ date: '2024-05-04' });
    const d2025 = day({ date: '2025-05-04' });
    expect(applyStatsFilters([d2024, d2025], { ...DEFAULT_STATS_FILTERS, year: 'all' }).days).toHaveLength(2);
  });
});
