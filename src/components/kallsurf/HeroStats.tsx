import { ArrowUp } from 'lucide-react';
import { getWindLevel, getLevelBadgeStyle } from '../../utils/windColors';
import { getEffectiveLevelIndex } from '../../config/windScale';
import { WindScaleMeter } from './WindScaleMeter';

const WindDirectionArrow = ({ degrees, size = 14 }: { degrees: number; size?: number }) => (
  <span
    className="inline-flex items-center justify-center transition-transform duration-500"
    style={{ transform: `rotate(${degrees + 180}deg)` }}
  >
    <ArrowUp size={size} strokeWidth={2.5} />
  </span>
);

/** Kortriktning: "SV" i stället för "Sydväst" — tight layout enligt skiss */
const getShortDirection = (degrees: number): string => {
  if (degrees === 0) return 'Växlande';
  const dirs = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
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
  isActive: boolean;
}

/**
 * NU-kortet enligt UX-skiss v1.4 (3a): rubrik, stora tal, nivåbadge,
 * riktningsrad och sjustegsmätare. Stationsstatus bor i headern,
 * dagsljus i grafens fotnot — inget dubbleras här.
 */
export function HeroStats({ currentWind }: HeroStatsProps) {
  const { avg, gust, dir } = currentWind;
  const level = getWindLevel(avg, gust);
  const levelIndex = getEffectiveLevelIndex(avg, gust);

  // Under Intressant: outlined badge (vit bakgrund, ink-kant) enligt skissen.
  // Från Intressant och uppåt: fylld med nivåfärgen.
  const badgeStyle = levelIndex >= 2
    ? getLevelBadgeStyle(avg, gust)
    : { backgroundColor: '#ffffff', color: '#1c1c1c', borderColor: '#1c1c1c' };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <h2 className="text-app-muted text-[10px] uppercase tracking-wider font-bold">
          Nu · observation · m/s
        </h2>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] uppercase tracking-wide"
          style={badgeStyle}
        >
          {level.label}
        </span>
      </div>

      <div className="flex items-end gap-5 mb-1">
        <div className="flex items-baseline">
          <span className="text-6xl font-extrabold tracking-tighter text-app-text leading-none">
            {avg.toFixed(1).replace('.', ',')}
          </span>
          <span className="text-sm text-app-muted ml-1.5">medel</span>
        </div>
        <div className="flex items-baseline pb-0.5">
          <span className="text-3xl font-bold tracking-tight text-app-text leading-none">
            {gust.toFixed(1).replace('.', ',')}
          </span>
          <span className="text-sm text-app-muted ml-1.5">by</span>
        </div>
      </div>

      <div className="flex items-center gap-1 text-sm text-app-text mb-4">
        <WindDirectionArrow degrees={dir} />
        <span className="font-medium">{getShortDirection(dir)}</span>
        <span className="text-app-subtle text-xs">{Math.round(dir)}°</span>
      </div>

      <WindScaleMeter avg={avg} gust={gust} />
    </div>
  );
}
