
import { Search, Moon, ArrowUp } from 'lucide-react';
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



const WindDirectionArrow = ({ degrees, size = 18, className = '' }: { degrees: number; size?: number; className?: string }) => (
  <div
    className={`flex items-center justify-center transition-transform duration-500 ${className}`}
    style={{ transform: `rotate(${degrees + 180}deg)` }}
  >
    <ArrowUp size={size} strokeWidth={3} />
  </div>
);

interface SurfOpportunityCardsProps {
  hourlyBuckets: HourlyBucket[];
  thresholds: {
    SURF_OK_AVG: number;
    SURF_GUST: number;
  };
  onCardClick?: (date: Date) => void;
}

export function SurfOpportunityCards({ hourlyBuckets, thresholds, onCardClick }: SurfOpportunityCardsProps) {
  // Filtrera för att bara visa prognos (framtid) och glesa ut datan
  const filteredSlots = hourlyBuckets
    .filter(bucket => bucket.isForecast)
    .filter((_, i) => i % 6 === 0)
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 ml-1">
        <h3 className="text-emerald-400 text-xs font-bold uppercase flex items-center gap-2">
          <Search size={14} /> Nästa surfchans?
        </h3>
      </div>
      <div className="grid gap-2">
        {filteredSlots.map((slot, i) => {
          const isGood = slot.avg >= thresholds.SURF_OK_AVG || slot.gust >= thresholds.SURF_GUST;

          return (
            <div
              key={i}
              onClick={() => onCardClick?.(slot.time)}
              className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${isGood
                ? 'bg-emerald-800 border-emerald-500/30 shadow-lg hover:border-emerald-500/50'
                : 'bg-emerald-900 border-emerald-800 opacity-70 hover:opacity-100 hover:border-emerald-700'
                }`}
            >
              {/* Left Side: Time and Status */}
              <div className="flex flex-col">
                <span className="text-xs text-emerald-400 uppercase font-bold mb-0.5 flex items-center gap-2">
                  {slot.day} {slot.timeStr}
                  {!slot.isDaylight && <Moon size={8} className="text-emerald-600" />}
                </span>
                <span className={`text-sm font-medium ${isGood ? 'text-emerald-300' : 'text-emerald-500'}`}>
                  {isGood ? 'Möjlig surf' : 'Stilla eller platt'}
                </span>
              </div>

              {/* Right Side: Wind Info */}
              <div className="flex items-center gap-4">
                {/* Direction */}
                <div className="flex flex-col items-end">
                  <WindDirectionArrow
                    degrees={slot.dir}
                    size={18}
                    className={isGood ? 'text-emerald-400' : 'text-emerald-600'}
                  />
                  <span className="text-[8px] text-emerald-500">{getDirectionLabel(slot.dir)}</span>
                </div>

                {/* Speed */}
                <div className="text-right w-16">
                  <span
                    className="text-xl font-bold"
                    style={{ color: isGood ? getWindColor(slot.avg) : undefined }}
                  >
                    {slot.avg.toFixed(1)}
                  </span>
                  <span className="text-xs text-emerald-600 ml-1">m/s</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <p className="text-[10px] text-emerald-500 mb-3 max-w-xs mx-auto">
          Vi visar de närmaste dagarna med grov upplösning. När vinden börjar ta sig visar vi en mer
          detaljerad vy de närmaste timmarna.
        </p>
      </div>
    </div>
  );
}

