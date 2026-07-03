import { format, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getEffectiveLevelIndex } from '../config/windScale';

export interface WindSlot {
  time: Date;
  avg: number;
  gust: number;
  dir?: number | null;
  isDaylight?: boolean;
}

export interface DayBest {
  date: Date;
  dateKey: string;
  /** "Idag" eller veckodag, t.ex. "Ons" */
  label: string;
  slot: WindSlot;
  levelIndex: number;
  /** By-regeln avgör nivån (medel under surfgräns men by ≥ 15) */
  gustDriven: boolean;
}

/**
 * Bästa vindtillfället per dag enligt BESLUT 01 (docs/ux/BESLUT.md):
 * högst surfbarhetsnivå → vid lika högst medelvind → vid lika högst byvind.
 * Dagar utan slots utelämnas.
 */
export function getBestSlotPerDay(slots: WindSlot[], maxDays = 7): DayBest[] {
  const byDay = new Map<string, WindSlot[]>();

  slots.forEach(slot => {
    const key = format(slot.time, 'yyyy-MM-dd');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(slot);
  });

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxDays)
    .map(([dateKey, daySlots]) => {
      const best = daySlots.reduce((bestSoFar, current) => {
        const bestLevel = getEffectiveLevelIndex(bestSoFar.avg, bestSoFar.gust);
        const curLevel = getEffectiveLevelIndex(current.avg, current.gust);
        if (curLevel !== bestLevel) return curLevel > bestLevel ? current : bestSoFar;
        if (current.avg !== bestSoFar.avg) return current.avg > bestSoFar.avg ? current : bestSoFar;
        return current.gust > bestSoFar.gust ? current : bestSoFar;
      });

      const levelIndex = getEffectiveLevelIndex(best.avg, best.gust);

      return {
        date: startOfDay(best.time),
        dateKey,
        label: dateKey === todayKey
          ? 'Idag'
          : format(best.time, 'EEE', { locale: sv }).replace('.', ''),
        slot: best,
        levelIndex,
        gustDriven: levelIndex > getEffectiveLevelIndex(best.avg, 0),
      };
    });
}
