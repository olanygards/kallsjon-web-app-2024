import { useMemo } from 'react';
import { HourlyBucket } from '../../hooks/useKallsurfTimeline';
import { getBestSlotPerDay } from '../../utils/bestWindPerDay';
import { DayStrip } from './DayStrip';

interface DailyForecastProps {
    hourlyBuckets: HourlyBucket[];
    onCardClick?: (date: Date) => void;
}

/**
 * Kommande 7 dagar — bästa vindtillfället per dag (BESLUT 01 i docs/ux/BESLUT.md).
 * Chipet är en signal; fördjupning sker i Detaljer via klick.
 */
export function DailyForecast({ hourlyBuckets, onCardClick }: DailyForecastProps) {
    const days = useMemo(() => {
        const now = new Date();
        const futureBuckets = hourlyBuckets.filter(b => b.time > now && b.isForecast);
        return getBestSlotPerDay(futureBuckets, 7);
    }, [hourlyBuckets]);

    if (days.length === 0) return null;

    return (
        <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-app-text text-xs font-bold uppercase tracking-wider">
                Kommande 7 dagar
            </h3>

            <DayStrip days={days} onDayClick={(day) => onCardClick?.(day.slot.time)} />

            <p className="text-[10px] text-app-subtle">
                Bästa vindtillfälle per dag (medel m/s) · * = byvind lyfter dagen · tryck för detaljer
            </p>
        </div>
    );
}
