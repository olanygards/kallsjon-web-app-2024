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
 * Accentfärg läsbar mot mörk bakgrund (tooltips, text på mörka kort).
 * De mörkblå nivåerna får ljusare toner; ljusa nivåer en dämpad grön.
 */
const DARK_BG_ACCENTS: Record<string, string> = {
  calm: '#a7c4b3',
  watching: '#D7EBDE',
  interesting: '#34d399',
  surfable: '#7C9FEF',
  good: '#93b0f2',
  great: '#aabff5',
  rare: '#FF2FA0',
};

export function getWindAccentColor(avgMs: number): string {
  const level = WIND_SCALE_LEVELS[getLevelIndexFromAvg(avgMs)];
  return DARK_BG_ACCENTS[level.id] ?? level.colors.bg;
}

/** CSS-gradient över hela skalan — för legender */
export function getScaleGradient(): string {
  const stops = WIND_SCALE_LEVELS.map((l) => l.colors.bg).join(', ');
  return `linear-gradient(to right, ${stops})`;
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
