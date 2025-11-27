import { ArrowUp } from 'lucide-react';
import { HourlyBucket } from '../../hooks/useKallsurfTimeline';
import { getDirectionLabel } from '../../utils/windDataConverter';

const getWindColor = (adjustedWind: number): string => {
  if (!adjustedWind || adjustedWind < 11.0) return '#ECEFF1';
  if (adjustedWind >= 19.0) return '#5E35B1';
  if (adjustedWind >= 18.5) return '#8E24AA';
  if (adjustedWind >= 17.0) return '#D81B60';
  if (adjustedWind >= 16.5) return '#E53935';
  if (adjustedWind >= 16.0) return '#F4511E';
  if (adjustedWind >= 15.5) return '#FB8C00';
  if (adjustedWind >= 15.0) return '#FFB300';
  if (adjustedWind >= 14.5) return '#FDD835';
  if (adjustedWind >= 13.0) return '#43A047';
  if (adjustedWind >= 12.5) return '#66BB6A';
  if (adjustedWind >= 12.0) return '#81C784';
  if (adjustedWind >= 11.5) return '#A5D6A7';
  if (adjustedWind >= 11.0) return '#C8E6C9';
  return '#ECEFF1';
};



const WindDirectionArrow = ({ degrees, size = 14, className = '' }: { degrees: number; size?: number; className?: string }) => (
  <div
    className={`flex items-center justify-center transition-transform duration-500 ${className}`}
    style={{ transform: `rotate(${degrees + 180}deg)` }}
  >
    <ArrowUp size={size} strokeWidth={3} />
  </div>
);

interface HourlyChipsProps {
  hourlyBuckets: HourlyBucket[];
  thresholds: {
    SURF_OK_AVG: number;
  };
}

export function HourlyChips({ hourlyBuckets, thresholds }: HourlyChipsProps) {
  return (
    <div>
      <h3 className="text-emerald-400 text-xs font-bold uppercase mb-3 ml-1">
        Kommande 6 timmar – timme för timme
      </h3>
      <div className="space-y-2">
        {hourlyBuckets.slice(0, 6).map((hour, i) => (
          <div
            key={i}
            className={`bg-emerald-800/50 border rounded-xl p-3 flex items-center justify-between ${!hour.isDaylight ? 'border-emerald-900/30 bg-emerald-900/80 opacity-60' : 'border-emerald-700/50'
              }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-emerald-300 font-mono font-medium text-sm">{hour.timeStr}</span>
                {!hour.isDaylight && (
                  <span className="text-[8px] text-emerald-600 uppercase tracking-wider">Mörkt</span>
                )}
              </div>
              <div className="flex items-center gap-2 bg-emerald-700/30 px-2 py-1 rounded-lg border border-emerald-700/50">
                <WindDirectionArrow degrees={hour.dir} size={14} className="text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-bold">{getDirectionLabel(hour.dir)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span
                  className={`text-lg font-bold ${hour.avg >= thresholds.SURF_OK_AVG ? 'text-white' : 'text-emerald-400'
                    }`}
                >
                  {hour.avg.toFixed(1)}
                </span>
                <span className="text-xs text-emerald-500 ml-1">({hour.gust.toFixed(1)})</span>
              </div>
              <div className="w-16 h-1.5 bg-emerald-700 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.min((hour.avg / 15) * 100, 100)}%`,
                    backgroundColor: getWindColor(hour.avg)
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

