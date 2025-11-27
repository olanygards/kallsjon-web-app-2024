import { useEffect } from 'react';
import { subDays } from 'date-fns';
import { useWindData } from './useWindData';

/**
 * Preloads recent data on app mount for instant "Läget" view
 * Runs in background with low priority to not block initial render
 */
export function useDataPreload() {
    const now = new Date();
    const weekAgo = subDays(now, 7);

    // Preload last 7 days with low priority
    const { data: preloadData } = useWindData({
        startDate: weekAgo,
        endDate: now,
        minForce: 0
    });

    useEffect(() => {
        if (preloadData && preloadData.length > 0) {
            console.log(`Preloaded ${preloadData.length} data points for last 7 days`);
        }
    }, [preloadData]);

    // This hook doesn't return anything - it just preloads in the background
}
