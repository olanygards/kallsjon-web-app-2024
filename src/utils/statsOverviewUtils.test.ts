import { describe, expect, it } from 'vitest';
import type { DailyStats } from '../hooks/useDailyStats';
import { buildAverageSeasonLabel, buildMonthlyBars } from './statsOverviewUtils';

function day(partial: Pick<DailyStats, 'date' | 'year' | 'month'>): DailyStats {
  return {
    ...partial,
    maxForce: 12,
    maxForceTime: new Date(partial.date),
    avgForce: 10,
    minForce: 5,
    maxForceDirection: 270,
    maxGust: 16,
    maxGustTime: new Date(partial.date),
    dataPointsCount: 100,
    hasStrongWind: true,
    hasGaleForce: false,
    isSurfableDay: true,
  };
}

describe('statsOverviewUtils snitt (Beslut 06.7)', () => {
  const reference = new Date('2026-07-13');

  it('exkluderar innevarande ofullständigt år från månadssnitt', () => {
    const days = [
      day({ date: '2024-12-05', year: 2024, month: 12 }),
      day({ date: '2025-12-01', year: 2025, month: 12 }),
      day({ date: '2025-12-08', year: 2025, month: 12 }),
      day({ date: '2026-07-01', year: 2026, month: 7 }),
    ];

    const bars = buildMonthlyBars(days, 2024, reference);
    const december = bars.find((b) => b.month === 12)!;

    // Bara 2025 (2 dagar) — 2026 får inte dra ner dec-snittet till 1
    expect(december.averageCount).toBe(2);
  });

  it('snittetikett utesluter valt år och innevarande ofullständigt år', () => {
    const allYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    expect(buildAverageSeasonLabel(allYears, 2024, reference)).toBe('2020–2025');
  });
});
