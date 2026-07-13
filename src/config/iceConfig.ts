/**
 * Isperiod per år — klientfilter, aldrig i dailyStats-aggregat (Beslut 06.10).
 * Ändringar här slår igenom retroaktivt utan backfill.
 */

export interface IceConfig {
  [year: number]: {
    start: string;
    end: string;
  };
}

/** Default: 15 feb – 15 apr. Januari före isläggning räknas som surfbar. */
export const DEFAULT_ICE_START_MONTH = 1;
export const DEFAULT_ICE_START_DAY = 15;
export const DEFAULT_ICE_END_MONTH = 3;
export const DEFAULT_ICE_END_DAY = 15;

export const DEFAULT_ICE_CONFIG: IceConfig = {
  // Exempel: 2024: { start: '2024-02-10', end: '2024-04-20' },
};

export function getDefaultIcePeriodLabel(): string {
  return '15 feb – 15 apr';
}
