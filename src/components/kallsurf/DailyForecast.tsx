import { useMemo } from 'react';
import { Calendar, ArrowUp } from 'lucide-react';
import { HourlyBucket } from '../../hooks/useKallsurfTimeline';
import { getDirectionLabel } from '../../utils/windDataConverter';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

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

interface DailyForecastProps {
    hourlyBuckets: HourlyBucket[];
    onCardClick?: (date: Date) => void;
}

export function DailyForecast({ hourlyBuckets, onCardClick }: DailyForecastProps) {
    // Group by day and find best hour for each day
    const dailyBest = useMemo(() => {
        const days = new Map<string, HourlyBucket[]>();

        // Filter for future data only (forecast)
        const now = new Date();
        const futureBuckets = hourlyBuckets.filter(b => b.time > now);

        futureBuckets.forEach(bucket => {
            const dayKey = format(bucket.time, 'yyyy-MM-dd');
            if (!days.has(dayKey)) {
                days.set(dayKey, []);
            }
            days.get(dayKey)!.push(bucket);
        });

        return Array.from(days.entries()).map(([_, buckets]) => {
            // Find the bucket with max avg wind
            const bestBucket = buckets.reduce((max, current) =>
                current.avg > max.avg ? current : max
                , buckets[0]);

            return bestBucket;
        }).slice(0, 5); // Show up to 5 days
    }, [hourlyBuckets]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
                <h3 className="text-emerald-400 text-xs font-bold uppercase flex items-center gap-2">
                    <Calendar size={14} /> Kommande dagar (Bästa tiden)
                </h3>
            </div>

            <div className="grid gap-2">
                {dailyBest.map((slot, i) => {
                    const isGood = slot.avg >= 8; // Basic threshold for visual emphasis

                    return (
                        <div
                            key={i}
                            onClick={() => onCardClick?.(slot.time)}
                            className={`p-3 rounded-xl border flex justify-between items-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${isGood
                                ? 'bg-emerald-800/80 border-emerald-500/30 shadow-lg hover:border-emerald-500/50'
                                : 'bg-emerald-900/40 border-emerald-800/50 hover:bg-emerald-900/60 hover:border-emerald-700'
                                }`}
                        >
                            {/* Left: Day and Time */}
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                    <span className="text-emerald-300 font-mono font-medium text-sm capitalize">
                                        {format(slot.time, 'EEEE', { locale: sv })}
                                    </span>
                                    <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                                        kl {slot.timeStr}
                                        {!slot.isDaylight && <span className="text-[8px] uppercase tracking-wider text-emerald-600 ml-1">Mörkt</span>}
                                    </span>
                                </div>

                                {/* Direction Badge */}
                                <div className="flex items-center gap-2 bg-emerald-950/30 px-2 py-1 rounded-lg border border-emerald-800/50">
                                    <WindDirectionArrow
                                        degrees={slot.dir}
                                        size={14}
                                        className="text-emerald-400"
                                    />
                                    <span className="text-[10px] text-emerald-400 font-bold">
                                        {getDirectionLabel(slot.dir)}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Wind Speed */}
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <span className="text-lg font-bold" style={{ color: getWindColor(slot.avg) }}>
                                        {slot.avg.toFixed(1)}
                                    </span>
                                    <span className="text-xs text-emerald-500 ml-1">
                                        ({slot.gust.toFixed(1)})
                                    </span>
                                </div>

                                {/* Visual Bar */}
                                <div className="w-16 h-1.5 bg-emerald-950/50 rounded-full overflow-hidden">
                                    <div
                                        className="h-full transition-all duration-300"
                                        style={{
                                            width: `${Math.min((slot.avg / 15) * 100, 100)}%`,
                                            backgroundColor: getWindColor(slot.avg)
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
