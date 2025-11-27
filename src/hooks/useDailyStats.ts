import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

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

                const querySnapshot = await getDocs(q);

                if (!mounted) return;

                const stats: DailyStats[] = querySnapshot.docs.map(doc => {
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
                        hasDaylightWind10Plus: data.hasDaylightWind10Plus ?? undefined // NEW field
                    };
                });

                // Filter client-side if minForce is specified (optional additional filter)
                const filteredStats = minForce
                    ? stats.filter(s => s.maxForce >= minForce)
                    : stats;

                setData(filteredStats);
                console.log(`✓ Loaded ${filteredStats.length} daily stats (${startDate} to ${endDate}, hasStrongWind=true)`);
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
