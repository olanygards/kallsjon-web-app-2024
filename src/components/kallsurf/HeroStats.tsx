import { ArrowUp } from 'lucide-react';
import { getWindLevel, getLevelBadgeStyle } from '../../utils/windColors';
import { getEffectiveLevelIndex } from '../../config/windScale';
import { TimelinePoint } from '../../hooks/useKallsurfTimeline';
import { NowWindChart } from './NowWindChart';
import { WindScaleMeter } from './WindScaleMeter';

const getCardinalDirection = (degrees: number): string => {
  if (degrees === 0) return 'Växlande';
  const dirs = ['Norr', 'Nordnordost', 'Nordost', 'Ostnordost', 'Ost', 'Ostsydost', 'Sydost', 'Sydsydost', 'Syd', 'Sydsydväst', 'Sydväst', 'Västsydväst', 'Väst', 'Västnordväst', 'Nordväst', 'Nordnordväst'];
  return dirs[Math.round(degrees / 22.5) % 16];
};

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
 */
export function HeroStats({ currentWind, timeline }: HeroStatsProps) {
  const { avg, gust, dir } = currentWind;
  const level = getWindLevel(avg, gust);
  const levelIndex = getEffectiveLevelIndex(avg, gust);

  const badgeStyle = levelIndex >= 2
    ? getLevelBadgeStyle(avg, gust)
    : { backgroundColor: '#ffffff', color: '#1c1c1c', borderColor: '#1c1c1c' };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="mb-3">
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
      </div>

      <div className="grid grid-cols-3 border border-app-border rounded-xl overflow-hidden mb-4">
        <div className="px-3 py-3 border-r border-app-border">
          <p className="text-5xl font-extrabold tracking-tighter text-app-text leading-none">
            {avg.toFixed(1).replace('.', ',')}
          </p>
          <p className="text-[11px] text-app-muted mt-1.5 leading-tight">medelvind</p>
          <p className="text-[10px] text-app-subtle leading-tight">m/s</p>
        </div>

        <div className="px-3 py-3 border-r border-app-border">
          <p className="text-5xl font-extrabold tracking-tighter text-app-text leading-none">
            {gust.toFixed(1).replace('.', ',')}
          </p>
          <p className="text-[11px] text-app-muted mt-1.5 leading-tight">byvind</p>
          <p className="text-[10px] text-app-subtle leading-tight">m/s</p>
        </div>

        <div className="px-2 py-2 flex flex-col items-center justify-center text-center min-h-[88px]">
          <span
            className="inline-flex items-center justify-center text-app-text transition-transform duration-500 -my-1"
            style={{ transform: `rotate(${dir + 180}deg)` }}
          >
            <ArrowUp size={40} strokeWidth={3} />
          </span>
          <p className="text-sm font-bold text-app-text leading-tight mt-0.5">
            {Math.round(dir)}°
          </p>
          <p className="text-[11px] text-app-muted leading-tight">
            {getCardinalDirection(dir)}
          </p>
        </div>
      </div>

      <NowWindChart timeline={timeline} />

      <WindScaleMeter avg={avg} gust={gust} />
    </div>
  );
}
