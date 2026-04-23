import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { startOfDay, format } from 'date-fns';

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
    hasDaylightWind10Plus?: boolean; // NEW: true if wind >= 10 m/s during daylight
}

interface UseDailyStatsOptions {
    startYear: number;
    endYear: number;
    minForce?: number;
}

/**
 * Fetch daily aggregated wind stats from Firestore
 * Much more efficient than fetching 5-minute raw data
 */
export function useDailyStats({ startYear, endYear, minForce = 10 }: UseDailyStatsOptions) {
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

                // Simple date-range query - much more efficient!
                const startDate = `${startYear}-01-01`;
                const endDate = `${endYear}-12-31`;

                const q = query(
                    dailyStatsRef,
                    where('hasStrongWind', '==', true),  // Equality filter MUST come first
                    where('date', '>=', startDate),
                    where('date', '<=', endDate),
                    orderBy('date', 'desc')
                );

                // Fetch historical stats and current day's live data in parallel
                const currentYear = new Date().getFullYear();
                const shouldFetchLive = endYear >= currentYear;

                const promises: [Promise<any>, Promise<any>] = [getDocs(q), Promise.resolve(null)];

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

                const stats: DailyStats[] = statsSnapshot.docs.map((doc: any) => {
                    const data = doc.data();
                    return {
                        date: data.date,
                        year: data.year,
                        month: data.month,
                        maxForce: data.maxForce,
                        maxForceTime: data.maxForceTime?.toDate() || new Date(data.date),
                        avgForce: data.avgForce,
                        minForce: data.minForce,
                        maxForceDirection: data.maxForceDirection,
                        maxGust: data.maxGust,
                        maxGustTime: data.maxGustTime?.toDate() || new Date(data.date),
                        dataPointsCount: data.dataPointsCount,
                        hasStrongWind: data.hasStrongWind,
                        hasGaleForce: data.hasGaleForce,
                        hasDaylightWind10Plus: data.hasDaylightWind10Plus ?? undefined
                    };
                });

                // Process live data if available
                if (liveSnapshot && !liveSnapshot.empty) {
                    let maxForce = 0;
                    let maxGust = 0;
                    let totalForce = 0;
                    let minForceVal = 999;
                    let maxForceDir = 0;
                    let maxForceTime = new Date();
                    let maxGustTime = new Date();


                    const todayPoints = liveSnapshot.docs.map((doc: any) => {
                        const d = doc.data();
                        return {
                            force: d.force || 0,
                            max: d.forceMax || d.force || 0,
                            dir: d.direction || 0,
                            time: d.time?.toDate() || new Date()
                        };
                    });

                    if (todayPoints.length > 0) {
                        todayPoints.forEach((p: any) => {
                            if (p.force > maxForce) {
                                maxForce = p.force;
                                maxForceDir = p.dir;
                                maxForceTime = p.time;
                            }
                            if (p.max > maxGust) {
                                maxGust = p.max;
                                maxGustTime = p.time;
                            }
                            if (p.force < minForceVal) minForceVal = p.force;
                            totalForce += p.force;

                            // Check daylight condition (approximate for live data or use utils logic if available)
                            // For simplicity here, we assume if it's windy it counts, 
                            // or we can import isMaxWindDuringDaylight if needed. 
                            // The user originally had a field for this.
                            // Let's assume true for now if it's high enough, as daylight calc is complex to inline.
                            // Or better, let's reuse the simple logic: if hour is between 8 and 18 approx?
                            // Actually the main filter in StatsView does the robust check. 
                            // We just need to populate the flag if we want it pre-calculated.
                            // But for live data, StatsView might re-calculate or we omit and let it fallback?
                            // StatsView lines 50-57: checks `hasDaylightWind10Plus`. If undefined, checks `isMaxWindDuringDaylight(day.maxForceTime)`.
                            // So we can leave it undefined or try to calculate. 
                            // Let's leave undefined to rely on client-side fallback in StatsView which is robust.
                        });

                        const avgForce = Number((totalForce / todayPoints.length).toFixed(1));
                        const todayDateStr = format(new Date(), 'yyyy-MM-dd');

                        // Construct today's stat object
                        const todayStat: DailyStats = {
                            date: todayDateStr,
                            year: currentYear,
                            month: new Date().getMonth() + 1, // 1-indexed
                            maxForce,
                            maxForceTime,
                            avgForce,
                            minForce: minForceVal === 999 ? 0 : minForceVal,
                            maxForceDirection: maxForceDir,
                            maxGust,
                            maxGustTime,
                            dataPointsCount: todayPoints.length,
                            hasStrongWind: maxForce >= 10, // Assuming 10 is the threshold for "StrongWind"
                            hasGaleForce: maxForce >= 14,
                            hasDaylightWind10Plus: undefined // Let StatsView calculate this dynamically
                        };

                        // Merge logic: check if today is already in stats (from historical fetch)
                        // If so, replace it. If not, add it.
                        // Filter out any existing entry for today first
                        const filteredHistory = stats.filter(s => s.date !== todayDateStr);

                        // Add live stat ONLY if it meets criteria (hasStrongWind)
                        // The historical query only fetches hasStrongWind == true.
                        // So we should respect that consistency.
                        if (todayStat.hasStrongWind) {
                            filteredHistory.unshift(todayStat); // Add to beginning (desc order)
                        }

                        // Re-assign to stats to filter later
                        // We must MUTATE the `stats` variable or creating a new one
                        // Let's just use filteredHistory as the new base
                        stats.length = 0;
                        stats.push(...filteredHistory);

                        // Sort again to be sure (descending dates)
                        stats.sort((a, b) => b.date.localeCompare(a.date));
                    }
                }

                // Filter client-side if minForce is specified (optional additional filter)
                const filteredStats = minForce
                    ? stats.filter(s => s.maxForce >= minForce)
                    : stats;

                setData(filteredStats);
                console.log(`✓ Loaded ${filteredStats.length} daily stats (inc. live data)`);
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
    }, [startYear, endYear, minForce]);

    return { data, loading, error };
}
