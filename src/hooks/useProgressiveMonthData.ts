import { useState, useEffect } from 'react';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { useWindData } from './useWindData';
import { WindData } from '../types/WindData';

/**
 * Progressive data loading for Detaljer view when clicking from Stats
 * 1. Load selected day first (for instant graph)
 * 2. Load rest of month in background (for calendar coloring)
 */
export function useProgressiveMonthData(selectedDate: Date | null) {
    const [selectedDayData, setSelectedDayData] = useState<WindData[]>([]);
    const [monthData, setMonthData] = useState<WindData[]>([]);
    const [loadingPhase, setLoadingPhase] = useState<'day' | 'month' | 'done'>('day');

    // Phase 1: Load selected day immediately (minForce: 0)
    const dayStart = selectedDate ? startOfDay(selectedDate) : new Date();
    const dayEnd = selectedDate ? endOfDay(selectedDate) : new Date();

    const { data: dayData, loading: dayLoading } = useWindData({
        startDate: dayStart,
        endDate: dayEnd,
        minForce: 0
    });

    // Phase 2: Load rest of month for calendar (minForce: 9)
    const monthStart = selectedDate ? startOfMonth(selectedDate) : new Date();
    const monthEnd = selectedDate ? endOfMonth(selectedDate) : new Date();

    const { data: fullMonthData, loading: monthLoading } = useWindData({
        startDate: monthStart,
        endDate: monthEnd,
        minForce: 9
    });

    // Update loading phase based on what's loaded
    useEffect(() => {
        if (!selectedDate) {
            setLoadingPhase('done');
            return;
        }

        if (!dayLoading && dayData.length > 0) {
            setSelectedDayData(dayData);
            setLoadingPhase('month');
        }

        if (!monthLoading && fullMonthData.length > 0) {
            setMonthData(fullMonthData);
            setLoadingPhase('done');
        }
    }, [selectedDate, dayLoading, dayData, monthLoading, fullMonthData]);

    return {
        selectedDayData,
        monthData,
        isLoadingDay: dayLoading,
        isLoadingMonth: monthLoading && !dayLoading,
        loadingPhase
    };
}
