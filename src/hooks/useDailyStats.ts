import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { STATS_DATA_START_YEAR } from '../config/constants';
import { startOfDay, format } from 'date-fns';
import {
    aggregateWindIntervals,
    type WindInterval,
} from '../utils/dailyStatsAggregation';

export interface DailyStats {
    date: string;
    year: number;
    month: number;
    maxForce: number;
    maxForceTime: Date;
    avgForce: number;
    minForce: number;
    maxForceDirection: number;
    maxGust: number;
    maxGustTime: Date;
    dataPointsCount: number;
    hasStrongWind: boolean;
    hasGaleForce: boolean;
    hasDaylightWind10Plus?: boolean;
    isSurfableDay: boolean;
    surfableMinutes?: number;
    surfableMinutesDaylight?: number;
    peakLevelIndex?: number;
    peakLevelIndexDaylight?: number;
    windowFrom?: Date | null;
    windowTo?: Date | null;
}

interface UseDailyStatsOptions {
    startYear?: number;
    endYear: number;
}

function mapFirestoreDailyStats(data: Record<string, unknown>): DailyStats {
    const toDate = (value: unknown, fallback: string): Date => {
        if (value && typeof value === 'object' && 'toDate' in value) {
            return (value as { toDate: () => Date }).toDate();
        }
        return new Date(fallback);
    };

    return {
        date: data.date as string,
        year: data.year as number,
        month: data.month as number,
        maxForce: data.maxForce as number,
        maxForceTime: toDate(data.maxForceTime, data.date as string),
        avgForce: data.avgForce as number,
        minForce: data.minForce as number,
        maxForceDirection: data.maxForceDirection as number,
        maxGust: data.maxGust as number,
        maxGustTime: toDate(data.maxGustTime, data.date as string),
        dataPointsCount: data.dataPointsCount as number,
        hasStrongWind: data.hasStrongWind as boolean,
        hasGaleForce: data.hasGaleForce as boolean,
        hasDaylightWind10Plus: data.hasDaylightWind10Plus as boolean | undefined,
        isSurfableDay: (data.isSurfableDay as boolean | undefined) ?? (data.hasStrongWind as boolean),
        surfableMinutes: data.surfableMinutes as number | undefined,
        surfableMinutesDaylight: data.surfableMinutesDaylight as number | undefined,
        peakLevelIndex: data.peakLevelIndex as number | undefined,
        peakLevelIndexDaylight: data.peakLevelIndexDaylight as number | undefined,
        windowFrom: data.windowFrom ? toDate(data.windowFrom, data.date as string) : null,
        windowTo: data.windowTo ? toDate(data.windowTo, data.date as string) : null,
    };
}

function aggregationToDailyStats(aggregated: ReturnType<typeof aggregateWindIntervals>): DailyStats {
    return {
        ...aggregated,
        hasDaylightWind10Plus: aggregated.hasDaylightWind10Plus,
    };
}

/**
 * Fetch daily aggregated wind stats from Firestore.
 * Query uses isSurfableDay (Beslut 06.3) — includes gust-driven surf days.
 */
export function useDailyStats({
    startYear = STATS_DATA_START_YEAR,
    endYear,
}: UseDailyStatsOptions) {
    const [data, setData] = useState<DailyStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchDailyStats = async () => {
            try {
                setLoading(true);
                setError(null);

                const dailyStatsRef = collection(db, 'dailyStats');
                const startDate = `${startYear}-01-01`;
                const endDate = `${endYear}-12-31`;

                const q = query(
                    dailyStatsRef,
                    where('isSurfableDay', '==', true),
                    where('date', '>=', startDate),
                    where('date', '<=', endDate),
                    orderBy('date', 'desc')
                );

                const currentYear = new Date().getFullYear();
                const shouldFetchLive = endYear >= currentYear;

                const promises: [Promise<Awaited<ReturnType<typeof getDocs>>>, Promise<Awaited<ReturnType<typeof getDocs>> | null>] = [
                    getDocs(q),
                    Promise.resolve(null),
                ];

                if (shouldFetchLive) {
                    const todayStart = startOfDay(new Date());
                    const windRef = collection(db, 'wind');
                    const liveQuery = query(
                        windRef,
                        where('time', '>=', Timestamp.fromDate(todayStart)),
                        orderBy('time', 'asc')
                    );
                    promises[1] = getDocs(liveQuery);
                }

                const [statsSnapshot, liveSnapshot] = await Promise.all(promises);

                if (!mounted) return;

                const stats: DailyStats[] = statsSnapshot.docs.map((doc) =>
                    mapFirestoreDailyStats(doc.data() as Record<string, unknown>)
                );

                if (liveSnapshot && !liveSnapshot.empty) {
                    const todayPoints: WindInterval[] = liveSnapshot.docs.map((doc) => {
                        const d = doc.data() as {
                            force?: number;
                            forceMax?: number;
                            direction?: number;
                            time?: { toDate: () => Date };
                        };
                        const force = d.force || 0;
                        return {
                            force,
                            forceMax: d.forceMax ?? force,
                            direction: d.direction || 0,
                            time: d.time?.toDate() || new Date(),
                        };
                    });

                    if (todayPoints.length > 0) {
                        const todayDateStr = format(new Date(), 'yyyy-MM-dd');
                        const todayStat = aggregationToDailyStats(
                            aggregateWindIntervals(todayPoints, todayDateStr)
                        );

                        const filteredHistory = stats.filter((s) => s.date !== todayDateStr);

                        if (todayStat.isSurfableDay) {
                            filteredHistory.unshift(todayStat);
                        }

                        stats.length = 0;
                        stats.push(...filteredHistory);
                        stats.sort((a, b) => b.date.localeCompare(a.date));
                    }
                }

                setData(stats);
                console.log(`✓ Loaded ${stats.length} surfable daily stats (inc. live data)`);
            } catch (err) {
                console.error('Error fetching daily stats:', err);
                if (mounted) {
                    setError(err as Error);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchDailyStats();

        return () => {
            mounted = false;
        };
    }, [startYear, endYear]);

    return { data, loading, error };
}
