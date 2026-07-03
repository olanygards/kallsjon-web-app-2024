import { useState, useEffect } from 'react';
import { TrendingUp, ArrowUp } from 'lucide-react';
import { getDirectionLabel } from '../../utils/windDataConverter';
import { getSunTimes, formatDecimalTime } from '../../utils/sunTimes';
import { getWindLevel, getLevelBadgeStyle, getWindAccentColor } from '../../utils/windColors';

const WindDirectionArrow = ({ degrees, size = 24, className = '' }: { degrees: number; size?: number; className?: string }) => (
  <div
    className={`flex items-center justify-center transition-transform duration-500 ${className}`}
    style={{ transform: `rotate(${degrees + 180}deg)` }}
  >
    <ArrowUp size={size} strokeWidth={2.5} />
  </div>
);

const DaylightBadge = ({ isDaylight }: { isDaylight: boolean }) => {
  const now = new Date();
  const sunTimes = getSunTimes(now);
  const timeStr = isDaylight ? formatDecimalTime(sunTimes.set) : formatDecimalTime(sunTimes.rise);

  return (
    <span
      className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 border ${isDaylight
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-app-surface-elevated border-app-border text-app-muted'
        }`}
    >
      {isDaylight ? '☀' : '☽'}
      {isDaylight ? `Ljust till ${timeStr}` : `Mörkt till ${timeStr}`}
    </span>
  );
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

export function HeroStats({ currentWind }: HeroStatsProps) {
  const { avg, gust, dir, isDaylight, time } = currentWind;
  const level = getWindLevel(avg, gust);
  const badgeStyle = getLevelBadgeStyle(avg, gust);

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
  const timeAgoText = minutesAgo < 60
    ? `${minutesAgo} min sedan`
    : time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-app-muted text-[10px] uppercase tracking-wider font-bold">
            Nu · observation · m/s
          </h2>
          <p className="text-[10px] text-app-subtle mt-0.5">
            Vassnäs · {timeAgoText}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <DaylightBadge isDaylight={isDaylight} />
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide"
            style={badgeStyle}
          >
            {level.label}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-6 mb-4">
        <div>
          <span
            className="text-5xl font-bold tracking-tight text-app-text leading-none"
            style={{ color: avg >= 6 ? getWindAccentColor(avg) : undefined }}
          >
            {avg.toFixed(1).replace('.', ',')}
          </span>
          <span className="text-sm text-app-muted ml-1">medel</span>
        </div>
        <div>
          <span className="text-2xl font-bold text-app-text leading-none">
            {gust.toFixed(1).replace('.', ',')}
          </span>
          <span className="text-sm text-app-muted ml-1">by</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <WindDirectionArrow degrees={dir} size={18} className="text-app-text" />
          <div>
            <span className="text-sm font-bold text-app-text block leading-tight">
              {getDirectionLabel(dir)}
            </span>
            <span className="text-[10px] text-app-subtle">{Math.round(dir)}°</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 pt-4 border-t border-app-border text-app-subtle">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} />
          <span className="text-[10px] uppercase font-bold">Byvind {gust.toFixed(1)} m/s</span>
        </div>
      </div>
    </div>
  );
}
