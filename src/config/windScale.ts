/**
 * Sjustegsskala för surfbarhet och vindfärger.
 * Alla trösklar och färger samlade här — justera utan att jaga hårdkodning i komponenter.
 *
 * Design: docs/ux/VINDSKALA.md · Beslut: docs/ux/BESLUT.md
 */

export interface WindScaleLevelConfig {
  id: string;
  label: string;
  /** Min medelvind (m/s) för denna nivå vid ren hastighetsmatchning */
  minAvgMs: number;
  colors: {
    bg: string;
    bgDeep?: string;
    text: string;
    border?: string;
  };
}

/** Byvind som gör att minst Surfbart-nivån nås även om medelvind är lägre */
export const GUST_SURFABLE_MS = 15;

/** Medelvind för Surfbart utan by-regel */
export const AVG_SURFABLE_MS = 10;

/**
 * Sjustegsskala — default enligt UX-skiss v1.4 (Jämtlandspalett).
 * Ordning: lägst → högst. Vid matchning väljs högsta nivå där avg >= minAvgMs.
 */
export const WIND_SCALE_LEVELS: readonly WindScaleLevelConfig[] = [
  {
    id: 'calm',
    label: 'Lugnt',
    minAvgMs: 0,
    colors: { bg: '#F2F6F3', text: '#1c1c1c', border: '#c9c9c4' },
  },
  {
    id: 'watching',
    label: 'Håll koll',
    minAvgMs: 6,
    colors: { bg: '#D7EBDE', text: '#1c1c1c', border: '#b8d8c4' },
  },
  {
    id: 'interesting',
    label: 'Intressant',
    minAvgMs: 8,
    colors: { bg: '#00813E', bgDeep: '#005A2C', text: '#ffffff', border: '#005A2C' },
  },
  {
    id: 'surfable',
    label: 'Surfbart',
    minAvgMs: 10,
    colors: { bg: '#0F3D9E', bgDeep: '#0A2B72', text: '#ffffff', border: '#0A2B72' },
  },
  {
    id: 'good',
    label: 'Bra',
    minAvgMs: 12,
    colors: { bg: '#0A2B72', bgDeep: '#071F55', text: '#ffffff', border: '#071F55' },
  },
  {
    id: 'great',
    label: 'Riktigt bra',
    minAvgMs: 15,
    colors: { bg: '#071B4A', bgDeep: '#040F2E', text: '#ffffff', border: '#040F2E' },
  },
  {
    id: 'rare',
    label: 'Sällsynt',
    minAvgMs: 18,
    colors: { bg: '#FF2FA0', bgDeep: '#E60C84', text: '#1c1c1c', border: '#C00A6F' },
  },
] as const;

/** App-chrome (navigation, text) — neutral ljus, enligt UX-skiss v1.4. Beslut 04. */
export const APP_THEME = {
  background: '#fbfbf9',
  surface: '#ffffff',
  surfaceElevated: '#f3f3f1',
  border: '#e0e0dc',
  borderMuted: '#ececea',
  text: '#1c1c1c',
  textMuted: '#6b6b6b',
  textSubtle: '#9a9a9a',
  /** Bottennav — mörk bar enligt skiss, oberoende av sidans ljusa bakgrund */
  nav: {
    bg: '#1c1c1c',
    text: '#9a9a9a',
    activeBg: '#000000',
    activeText: '#ffffff',
  },
  accentFlag: {
    blue: '#0F3D9E',
    green: '#00813E',
    yellow: '#F5C400',
    red: '#C8102E',
  },
} as const;

/** Surftrösklar för referenslinjer m.m. — speglar skalan */
export const WIND_THRESHOLDS = {
  MIN_WORTH_WATCHING: 6,
  INTERESTING: 8,
  AVG_SURFABLE: AVG_SURFABLE_MS,
  GUST_SURFABLE: GUST_SURFABLE_MS,
} as const;

export function getLevelIndexFromAvg(avgMs: number): number {
  let index = 0;
  for (let i = 0; i < WIND_SCALE_LEVELS.length; i++) {
    if (avgMs >= WIND_SCALE_LEVELS[i].minAvgMs) index = i;
  }
  return index;
}

export function getLevelFromAvg(avgMs: number): WindScaleLevelConfig {
  return WIND_SCALE_LEVELS[getLevelIndexFromAvg(avgMs)];
}

/**
 * Surfbarhetsnivå för ett tidslot — används t.ex. vid val av bästa lucka per dag.
 * By ≥ GUST_SURFABLE_MS ger minst Surfbart även om medel < AVG_SURFABLE_MS.
 */
export function getEffectiveLevelIndex(avgMs: number, gustMs: number): number {
  const fromAvg = getLevelIndexFromAvg(avgMs);
  const surfableIndex = WIND_SCALE_LEVELS.findIndex((l) => l.id === 'surfable');
  if (gustMs >= GUST_SURFABLE_MS && avgMs < AVG_SURFABLE_MS) {
    return Math.max(fromAvg, surfableIndex);
  }
  return fromAvg;
}

export function getEffectiveLevel(avgMs: number, gustMs: number): WindScaleLevelConfig {
  return WIND_SCALE_LEVELS[getEffectiveLevelIndex(avgMs, gustMs)];
}
