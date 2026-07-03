import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DailySummary } from './useKallsurfTimeline';
import { getEffectiveLevelIndex } from '../config/windScale';

export function useMonthlyStats(monthDate: Date) {
    const [stats, setStats] = useState<DailySummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchStats = async () => {
            if (!monthDate) return;

            try {
                setLoading(true);
                const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
                const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

                const dailyStatsRef = collection(db, 'dailyStats');

                // Query for all stats in the month
                // We don't filter by hasStrongWind to get a complete picture if possible
                // Simple range query on 'date' should work with default indexes
                const q = query(
                    dailyStatsRef,
                    where('date', '>=', start),
                    where('date', '<=', end),
                    orderBy('date', 'asc')
                );

                const snapshot = await getDocs(q);

                if (!mounted) return;

                const summaries: DailySummary[] = snapshot.docs.map(doc => {
                    const data = doc.data();

                    // Map to DailySummary interface
                    // Note: dailyStats might not have exactly the same fields as calculated from raw data
                    // but we map what we have.

                    const maxAvg = data.maxForce || 0;
                    const maxGust = data.maxGust || 0;

                    return {
                        date: new Date(data.date),
                        dateStr: data.date,
                        maxAvg,
                        avgAvg: data.avgForce || 0,
                        maxGust,
                        bestWindLevelIndex: getEffectiveLevelIndex(maxAvg, maxGust),
                    };
                });

                setStats(summaries);
                setError(null);
            } catch (err) {
                console.error('Error fetching monthly stats:', err);
                if (mounted) {
                    setError(err as Error);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        fetchStats();

        return () => {
            mounted = false;
        };
    }, [monthDate.getTime()]); // Depend on time to trigger on month change

    return { stats, loading, error };
}
