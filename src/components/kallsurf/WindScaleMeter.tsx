import { WIND_SCALE_LEVELS, getEffectiveLevelIndex } from '../../config/windScale';

interface WindScaleMeterProps {
  avg: number;
  gust: number;
}

/**
 * Sjustegsmätaren från UX-skiss v1.4: sju segment med pil vid aktuell vind
 * och m/s-trösklar som ticks. Gör skalan lärbar — samma färger som chips,
 * kalender och prognosceller.
 */
export function WindScaleMeter({ avg, gust }: WindScaleMeterProps) {
  const levelCount = WIND_SCALE_LEVELS.length;
  const activeIndex = getEffectiveLevelIndex(avg, gust);

  // Pilens position: segment + andel in i segmentet (sista segmentet öppet uppåt)
  const segMin = WIND_SCALE_LEVELS[activeIndex].minAvgMs;
  const segMax = activeIndex < levelCount - 1
    ? WIND_SCALE_LEVELS[activeIndex + 1].minAvgMs
    : segMin + 6;
  const frac = Math.min(Math.max((avg - segMin) / (segMax - segMin), 0), 1);
  const pinLeftPct = ((activeIndex + frac) / levelCount) * 100;

  return (
    <div className="relative pt-2.5">
      {/* Pil */}
      <div
        className="absolute top-0 -translate-x-1/2 pointer-events-none z-10 transition-[left] duration-500"
        style={{ left: `${pinLeftPct}%` }}
      >
        <div
          className="w-0 h-0 mx-auto"
          style={{
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '6px solid #1c1c1c',
          }}
        />
        <div className="w-0.5 h-3.5 bg-app-text mx-auto" />
      </div>

      {/* Segment */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${levelCount}, 1fr)` }}
      >
        {WIND_SCALE_LEVELS.map((level, i) => (
          <div
            key={level.id}
            className={`h-2.5 rounded-md border border-black/10 transition-opacity ${i === activeIndex ? '' : 'opacity-80'}`}
            style={{ backgroundColor: level.colors.bg }}
            title={`${level.label} (≥ ${level.minAvgMs} m/s)`}
          />
        ))}
      </div>

      {/* Tick-etiketter vid segmentgränserna */}
      <div className="relative h-4 mt-0.5">
        {WIND_SCALE_LEVELS.slice(1).map((level, i) => (
          <span
            key={level.id}
            className="absolute -translate-x-1/2 text-[9px] font-mono text-app-subtle"
            style={{ left: `${((i + 1) / levelCount) * 100}%` }}
          >
            {level.minAvgMs}
          </span>
        ))}
      </div>
    </div>
  );
}
