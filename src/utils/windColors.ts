/**
 * UI-hjälpare för vindfärger. All färg- och tröskellogik läses från
 * src/config/windScale.ts — ändra skalan där, inte här.
 */
import {
  WIND_SCALE_LEVELS,
  WindScaleLevelConfig,
  getLevelIndexFromAvg,
  getEffectiveLevelIndex,
} from '../config/windScale';

export { WIND_SCALE_LEVELS, getLevelIndexFromAvg, getEffectiveLevelIndex };
export type { WindScaleLevelConfig };

/** Bakgrundsfärg (hex) för en medelvind — t.ex. kalenderceller, prognosceller, staplar */
export function getWindColor(avgMs: number): string {
  return WIND_SCALE_LEVELS[getLevelIndexFromAvg(avgMs)].colors.bg;
}

/** Textfärg med kontrast mot getWindColor-bakgrunden */
export function getWindTextColor(avgMs: number): string {
  return WIND_SCALE_LEVELS[getLevelIndexFromAvg(avgMs)].colors.text;
}

/** Nivå (label + färger) med by-regeln: by ≥ 15 ger minst Surfbart */
export function getWindLevel(avgMs: number, gustMs: number): WindScaleLevelConfig {
  return WIND_SCALE_LEVELS[getEffectiveLevelIndex(avgMs, gustMs)];
}

/**
 * Accentfärg för vindvärden på ljus bakgrund (hero, grafer, tooltips).
 */
const LIGHT_BG_ACCENTS: Record<string, string> = {
  calm: '#6b6b6b',
  watching: '#00813E',
  interesting: '#00813E',
  surfable: '#0F3D9E',
  good: '#0A2B72',
  great: '#071B4A',
  rare: '#E60C84',
};

export function getWindAccentColor(avgMs: number): string {
  const level = WIND_SCALE_LEVELS[getLevelIndexFromAvg(avgMs)];
  return LIGHT_BG_ACCENTS[level.id] ?? level.colors.bg;
}

/** CSS-gradient över hela skalan — för legender */
export function getScaleGradient(): string {
  const stops = WIND_SCALE_LEVELS.map((l) => l.colors.bg).join(', ');
  return `linear-gradient(to right, ${stops})`;
}

/** Inline-stilar för nivåbadge (bakgrund, text, kant) */
export function getLevelBadgeStyle(avgMs: number, gustMs: number): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const level = getWindLevel(avgMs, gustMs);
  return {
    backgroundColor: level.colors.bg,
    color: level.colors.text,
    borderColor: level.colors.border ?? level.colors.bg,
  };
}

/** Legendposter: label + tröskel + färg */
export function getScaleLegend(): Array<{ label: string; threshold: string; bg: string; text: string }> {
  return WIND_SCALE_LEVELS.map((l, i) => ({
    label: l.label,
    threshold: i === 0 ? `< ${WIND_SCALE_LEVELS[1].minAvgMs}` : `≥ ${l.minAvgMs}`,
    bg: l.colors.bg,
    text: l.colors.text,
  }));
}
