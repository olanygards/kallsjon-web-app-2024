import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { getWindLevel, getLevelBadgeStyle } from '../../utils/windColors';
import { getEffectiveLevelIndex } from '../../config/windScale';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { NowWindBar } from '../../utils/nowWindChartData';
import { NowWindChart } from './NowWindChart';
import { WindScaleMeter } from './WindScaleMeter';

const getCardinalDirection = (degrees: number): string => {
  if (degrees === 0) return 'Växlande';
  const dirs = ['Norr', 'Nordnordost', 'Nordost', 'Ostnordost', 'Ost', 'Ostsydost', 'Sydost', 'Sydsydost', 'Syd', 'Sydsydväst', 'Sydväst', 'Västsydväst', 'Väst', 'Västnordväst', 'Nordväst', 'Nordnordväst'];
  return dirs[Math.round(degrees / 22.5) % 16];
};

const formatVal = (n: number) => n.toFixed(1).replace('.', ',');

interface HeroStatsProps {
  currentWind: {
    avg: number;
    gust: number;
    dir: number;
    isDaylight: boolean;
    time: Date;
  };
  timeline: TimelinePoint[];
  isActive: boolean;
}

/**
 * NU-kortet enligt UX-skiss: nivåbadge, tre informationskolumner,
 * stapeldiagram, sammanfattning och sjustegsmätare.
 * Scrubb i grafen uppdaterar de tre rutorna; släpp återgår till NU.
 */
export function HeroStats({ currentWind, timeline }: HeroStatsProps) {
  const { avg, gust, dir } = currentWind;
  const level = getWindLevel(avg, gust);
  const levelIndex = getEffectiveLevelIndex(avg, gust);

  const [scrubBar, setScrubBar] = useState<NowWindBar | null>(null);
  const isScrubbing = scrubBar != null;

  const displayAvg = scrubBar?.isGap ? null : (scrubBar?.avg ?? avg);
  const displayGust = scrubBar?.isGap ? null : (scrubBar?.gust ?? gust);
  const displayDir = scrubBar?.isGap ? null : (scrubBar?.dir ?? dir);

  const badgeStyle = levelIndex >= 2
    ? getLevelBadgeStyle(avg, gust)
    : { backgroundColor: '#ffffff', color: '#1c1c1c', borderColor: '#1c1c1c' };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="mb-3 relative flex items-center min-h-[28px]">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border-[1.5px] uppercase tracking-wide"
          style={badgeStyle}
        >
          {levelIndex >= 3 && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: levelIndex >= 2 ? badgeStyle.color : '#1c1c1c' }}
            />
          )}
          {level.label}
        </span>
        {scrubBar && (
          <span
            className={`absolute right-0 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-app-subtle transition-opacity duration-150 ${isScrubbing ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!isScrubbing}
          >
            {scrubBar.timeStr} · {scrubBar.isForecast ? 'PROG' : 'OBS'}
            {scrubBar.isGap && ' · saknas'}
          </span>
        )}
      </div>

      <div className={`grid grid-cols-3 border border-app-border rounded-xl overflow-hidden mb-4 transition-opacity duration-200 ${isScrubbing ? 'opacity-90' : ''}`}>
        <div className="px-3 py-3 border-r border-app-border">
          <p className="text-5xl font-extrabold tracking-tighter text-app-text leading-none">
            {displayAvg != null ? formatVal(displayAvg) : '—'}
          </p>
          <p className="text-[11px] text-app-muted mt-1.5 leading-tight">medelvind</p>
          <p className="text-[10px] text-app-subtle leading-tight">m/s</p>
        </div>

        <div className="px-3 py-3 border-r border-app-border">
          <p className="text-5xl font-extrabold tracking-tighter text-app-text leading-none">
            {displayGust != null ? formatVal(displayGust) : '—'}
          </p>
          <p className="text-[11px] text-app-muted mt-1.5 leading-tight">byvind</p>
          <p className="text-[10px] text-app-subtle leading-tight">m/s</p>
        </div>

        <div className="px-2 py-2 flex flex-col items-center justify-center text-center min-h-[88px]">
          {displayDir != null ? (
            <>
              <span
                className="inline-flex items-center justify-center text-app-text transition-transform duration-300 -my-1"
                style={{ transform: `rotate(${displayDir + 180}deg)` }}
              >
                <ArrowUp size={40} strokeWidth={3} />
              </span>
              <p className="text-sm font-bold text-app-text leading-tight mt-0.5">
                {Math.round(displayDir)}°
              </p>
              <p className="text-[11px] text-app-muted leading-tight">
                {getCardinalDirection(displayDir)}
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold text-app-subtle">—</p>
          )}
        </div>
      </div>

      <NowWindChart timeline={timeline} onScrubChange={setScrubBar} />

      <WindScaleMeter avg={avg} gust={gust} />
    </div>
  );
}
