import { useState, useEffect } from 'react';
import { TrendingUp, ArrowUp } from 'lucide-react';
import { getDirectionLabel } from '../../utils/windDataConverter';
import { getSunTimes, formatDecimalTime } from '../../utils/sunTimes';





const WindDirectionArrow = ({ degrees, size = 24, className = '' }: { degrees: number; size?: number; className?: string }) => (
  <div
    className={`flex items-center justify-center transition-transform duration-500 ${className}`}
    style={{ transform: `rotate(${degrees + 180}deg)` }}
  >
    <ArrowUp size={size} strokeWidth={3} />
  </div>
);



const DaylightBadge = ({ isDaylight }: { isDaylight: boolean }) => {
  const now = new Date();
  const sunTimes = getSunTimes(now);
  const timeStr = isDaylight ? formatDecimalTime(sunTimes.set) : formatDecimalTime(sunTimes.rise);

  return (
    <span
      className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1 border ${isDaylight
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        : 'bg-emerald-950/40 border-emerald-500/20 text-emerald-300'
        }`}
    >
      {isDaylight ? '☀' : '☽'}
      {isDaylight ? `LJUST TILL ${timeStr}` : `MÖRKT TILL ${timeStr}`}
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

export function HeroStats({ currentWind, isActive }: HeroStatsProps) {
  const { avg, gust, dir, isDaylight, time } = currentWind;
  const appMode = isActive ? 'active' : 'calm';

  // Force update every 30 seconds to keep "time ago" display fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 30000); // Update every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Calculate how long ago the measurement was taken
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
  const timeAgoText = minutesAgo < 60
    ? `${minutesAgo} min sedan`
    : time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 shadow-xl backdrop-blur-sm transition-colors duration-500 ${appMode === 'active'
        ? 'bg-emerald-800/80 border border-emerald-500/30'
        : 'bg-emerald-900/50 border border-emerald-800'
        }`}
    >
      {/* Background Effects */}
      {appMode === 'active' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none -mr-10 -mt-10"></div>
      )}

      {/* Header: Title and Badges */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <h2 className="text-emerald-400 text-xs uppercase tracking-wider font-bold flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${appMode === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`}
            ></span>
            Kallsjön Live
          </h2>
          <p className="text-[10px] text-emerald-500 mt-1 font-medium transition-opacity duration-300">
            {timeAgoText}
          </p>
        </div>
        <div className="flex gap-2">
          <DaylightBadge isDaylight={isDaylight} />

        </div>
      </div>

      {/* Main Value: Average Wind */}
      <div className="flex items-baseline gap-2 mb-2 relative z-10">
        <span className="text-7xl font-bold text-white tracking-tighter transition-all duration-500">{avg.toFixed(1)}</span>
        <div className="flex flex-col">
          <span className="text-xl text-emerald-400 font-medium">m/s</span>
          <span className="text-[10px] text-emerald-500 uppercase font-bold">Medel</span>
        </div>
      </div>

      {/* Footer: Gust and Direction */}
      <div className="flex items-center gap-6 mt-6 pt-4 border-t border-emerald-700/30 relative z-10">
        {/* Gust Section */}
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${appMode === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-800 text-white'
              }`}
          >
            <TrendingUp size={20} />
          </div>
          <div>
            <span
              className={`block text-2xl font-bold transition-all duration-500 ${appMode === 'active' ? 'text-emerald-50' : 'text-emerald-300'}`}
            >
              {gust.toFixed(1)}
            </span>
            <span className="text-[10px] text-emerald-500 uppercase font-bold">Byvind</span>
          </div>
        </div>

        <div className="w-px h-8 bg-emerald-700/30"></div>

        {/* Direction Section */}
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${appMode === 'active' ? 'bg-emerald-700 text-white' : 'bg-emerald-800 text-white'
              }`}
          >
            <WindDirectionArrow degrees={dir} size={20} />
          </div>
          <div>
            <span
              className={`block text-2xl font-bold transition-all duration-500 ${appMode === 'active' ? 'text-emerald-50' : 'text-emerald-300'}`}
            >
              {getDirectionLabel(dir)}
            </span>
            <span className="text-[10px] text-emerald-500 uppercase font-bold">Riktning ({Math.round(dir)}°)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

