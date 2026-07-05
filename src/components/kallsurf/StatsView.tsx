import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { TrendingUp, Wind, Calendar, Droplet, Sun } from 'lucide-react';
import { useDailyStats } from '../../hooks/useDailyStats';
import { filterSurfableDays } from '../../utils/surfableDays';
import { isMaxWindDuringDaylight } from '../../utils/daylightCalculations';
import { getWindColor, getWindTextColor } from '../../utils/windColors';

// Helper function to convert wind direction in degrees to cardinal direction
function getWindDirection(degrees: number): string {
    const directions = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSV', 'SV', 'VSV', 'V', 'VNV', 'NV', 'NNV'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Helper: vindnivåfärger från sjustegsskalan
function getWindSpeedStyle(speed: number): React.CSSProperties {
  return {
    backgroundColor: getWindColor(speed),
    color: getWindTextColor(speed),
    borderColor: getWindColor(speed),
  };
}

interface StatsViewProps {
    onDayClick?: (date: Date) => void;
}

export function StatsView({ onDayClick }: StatsViewProps) {
    const currentYear = new Date().getFullYear();
    const [excludeIcePeriod, setExcludeIcePeriod] = useState(true); // Default: exclude ice period
    const [daylightOnly, setDaylightOnly] = useState(true); // Default: show only daylight days
    const [selectedYear, setSelectedYear] = useState<number | null>(null); // null = all years
    const [selectedDirection, setSelectedDirection] = useState<string | null>(null); // null = all directions
    const [sortBy, setSortBy] = useState<'maxGust' | 'maxForce' | 'avgForce'>('maxForce'); // Default: sort by highest avg wind

    // Fetch daily stats efficiently (95% fewer reads than before!)
    const { data: allDailyStats, loading, error } = useDailyStats({
        startYear: 2020,
        endYear: currentYear,
        minForce: 10
    });

    // Filter for surfable days: exclude ice period + optionally daylight only
    const dailyStats = useMemo(() => {
        let filtered = excludeIcePeriod ? filterSurfableDays(allDailyStats) : allDailyStats;

        // Apply daylight filter if enabled
        if (daylightOnly) {
            filtered = filtered.filter(day => {
                // Use new field if available (more accurate: shows ANY wind >=10 m/s during daylight)
                if (day.hasDaylightWind10Plus !== undefined) {
                    return day.hasDaylightWind10Plus;
                }
                // Fallback to old logic (only shows if MAX wind was during daylight)
                return isMaxWindDuringDaylight(day.maxForceTime);
            });
        }

        return filtered;
    }, [allDailyStats, excludeIcePeriod, daylightOnly]);

    // Process stats by direction
    const windDirectionStats = useMemo(() => {
        const statsByDirection: Record<string, typeof dailyStats> = {};

        dailyStats.forEach(day => {
            const dir = getWindDirection(day.maxForceDirection);
            if (!statsByDirection[dir]) {
                statsByDirection[dir] = [];
            }
            statsByDirection[dir].push(day);
        });

        return statsByDirection;
    }, [dailyStats]);

    // Get directions with data, sorted by count
    const directionsWithData = useMemo(() => {
        const directions = Object.entries(windDirectionStats)
            .map(([dir, days]) => ({ direction: dir, count: days.length }))
            .sort((a, b) => b.count - a.count);

        return directions;
    }, [windDirectionStats]);

    // Stats for all time
    const bestDay = useMemo(() => {
        if (dailyStats.length === 0) return null;
        return dailyStats.reduce((prev, current) =>
            current.maxForce > prev.maxForce ? current : prev
        );
    }, [dailyStats]);

    const totalDays = dailyStats.length;

    // Stats per year
    const yearStats = useMemo(() => {
        const statsByYear: Record<number, { days: number; bestDay: typeof dailyStats[0] | null }> = {};

        dailyStats.forEach(day => {
            if (!statsByYear[day.year]) {
                statsByYear[day.year] = { days: 0, bestDay: null };
            }
            statsByYear[day.year].days++;

            if (!statsByYear[day.year].bestDay || day.maxForce > statsByYear[day.year].bestDay!.maxForce) {
                statsByYear[day.year].bestDay = day;
            }
        });

        return statsByYear;
    }, [dailyStats]);

    const isInitialLoading = loading && dailyStats.length === 0;

    if (error) {
        return (
            <div className="animate-in slide-in-from-right-8 duration-300">
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
                    <p className="font-bold mb-1">Fel vid hämtning</p>
                    <p className="text-sm">{error.message}</p>
                </div>
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center text-app-subtle">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs uppercase tracking-widest font-medium">Hämtar statistik...</span>
                </div>
            </div>
        );
    }

    if (dailyStats.length === 0) {
        return (
            <div className="animate-in slide-in-from-right-8 duration-300">
                <div className="bg-app-surface/30 border border-app-border/50 p-4 rounded-xl text-app-text">
                    <p className="font-bold mb-1">Ingen data</p>
                    <p className="text-sm">Inga blåsiga dagar hittades (kriterium: ≥10 m/s)</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in slide-in-from-right-8 duration-300 space-y-6">
            {/* Ice period toggle */}
            <div className="flex items-center justify-between bg-app-bg/40 border border-app-border/60 rounded-xl p-3">
                <div className="flex items-center gap-2">
                    <Droplet size={16} className="text-blue-400" />
                    <span className="text-sm text-app-text">Dagar utan is (15 feb - 15 apr)</span>
                </div>
                <button
                    onClick={() => setExcludeIcePeriod(!excludeIcePeriod)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${excludeIcePeriod
                        ? 'bg-blue-600 text-white'
                        : 'bg-app-surface/40 text-app-text hover:bg-app-surface-elevated/40'
                        }`}
                >
                    {excludeIcePeriod ? 'På' : 'Av'}
                </button>
            </div>

            {/* Daylight filter toggle */}
            <div className="flex items-center justify-between bg-app-bg/40 border border-app-border/60 rounded-xl p-3">
                <div className="flex items-center gap-2">
                    <Sun size={16} className="text-yellow-400" />
                    <span className="text-sm text-app-text">Dagar med vind ≥10 m/s vid dagsljus</span>
                </div>
                <button
                    onClick={() => setDaylightOnly(!daylightOnly)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${daylightOnly
                        ? 'bg-yellow-600 text-white'
                        : 'bg-app-surface/40 text-app-text hover:bg-app-surface-elevated/40'
                        }`}
                >
                    {daylightOnly ? 'På' : 'Av'}
                </button>
            </div>

            {/* Surfable days info */}
            {(excludeIcePeriod || daylightOnly) && (
                <div className="space-y-2">
                    {excludeIcePeriod && allDailyStats.length > filterSurfableDays(allDailyStats).length && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900">
                            ❄️ {allDailyStats.length - filterSurfableDays(allDailyStats).length} dagar under isperiod exkluderade
                        </div>
                    )}
                    {daylightOnly && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
                            ☀️ Dagar med vind ≥10 m/s under dagsljus
                        </div>
                    )}
                </div>
            )}

            {/* Hero stats */}
            <div className="grid grid-cols-2 gap-3">
                {bestDay && (
                    <div className="bg-gradient-to-br from-app-surface/60 to-app-bg/60 border border-app-border/60 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-app-muted" />
                            <span className="text-xs font-medium text-app-text uppercase tracking-wide">Bästa dagen</span>
                        </div>
                        <p className="text-3xl font-bold text-app-text mb-1">{bestDay.maxForce} m/s</p>
                        <p className="text-xs text-app-text">
                            {format(parseISO(bestDay.date), 'd MMMM yyyy', { locale: sv })}
                        </p>
                    </div>
                )}

                <div className="bg-gradient-to-br from-app-surface/60 to-app-bg/60 border border-app-border/60 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Calendar size={16} className="text-app-muted" />
                        <span className="text-xs font-medium text-app-text uppercase tracking-wide">Dagar ≥10 m/s</span>
                    </div>
                    <p className="text-3xl font-bold text-app-text mb-1">{totalDays}</p>
                    <p className="text-xs text-app-text">Sedan 2020</p>
                </div>
            </div>

            {/* Stats per year */}
            <div className="bg-app-bg/40 border border-app-border/60 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-app-text mb-4 flex items-center gap-2">
                    <TrendingUp size={16} />
                    Statistik per år
                    {selectedYear && (
                        <button
                            onClick={() => setSelectedYear(null)}
                            className="ml-auto text-xs bg-app-surface-elevated/40 hover:bg-app-surface-elevated/40 px-2 py-1 rounded-lg transition-colors"
                        >
                            Visa alla
                        </button>
                    )}
                </h3>
                <div className="space-y-3">
                    {Object.entries(yearStats)
                        .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA))
                        .map(([year, stats]) => {
                            const yearNum = parseInt(year);
                            const isSelected = selectedYear === yearNum;
                            return (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(isSelected ? null : yearNum)}
                                    className={`w-full text-left rounded-xl p-3 transition-all ${isSelected
                                        ? 'bg-app-surface-elevated/50 border-2 border-app-accent ring-2 ring-app-accent/30'
                                        : 'bg-app-surface/30 border border-app-border/50 hover:bg-app-surface-elevated/40'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`font-bold ${isSelected ? 'text-app-text' : 'text-app-text'}`}>
                                            {year}
                                        </span>
                                        <span className="text-xs text-app-text">{stats.days} dagar</span>
                                    </div>
                                    {stats.bestDay && (
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-app-muted">Bästa dag:</span>
                                            <span className="text-app-text font-bold">{stats.bestDay.maxForce} m/s</span>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* Wind directions */}
            <div className="bg-app-bg/40 border border-app-border/60 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-app-text mb-4 flex items-center gap-2">
                    <Wind size={16} />
                    Vindriktningar
                    {selectedDirection && (
                        <button
                            onClick={() => setSelectedDirection(null)}
                            className="ml-auto text-xs bg-app-surface-elevated/40 hover:bg-app-surface-elevated/40 px-2 py-1 rounded-lg transition-colors"
                        >
                            Visa alla
                        </button>
                    )}
                </h3>
                <div className="grid grid-cols-4 gap-2">
                    {directionsWithData.map(({ direction, count }) => {
                        const isSelected = selectedDirection === direction;
                        return (
                            <button
                                key={direction}
                                onClick={() => setSelectedDirection(isSelected ? null : direction)}
                                className={`rounded-lg p-2 text-center transition-all ${isSelected
                                    ? 'bg-app-surface-elevated/50 border-2 border-app-accent ring-2 ring-app-accent/30'
                                    : 'bg-app-surface/30 border border-app-border/50 hover:bg-app-surface-elevated/40'
                                    }`}
                            >
                                <div className={`font-bold text-sm ${isSelected ? 'text-app-text' : 'text-app-text'}`}>
                                    {direction}
                                </div>
                                <div className="text-xs text-app-muted">{count}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Top days list */}
            <div className="bg-app-bg/40 border border-app-border/60 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
                        <Calendar size={16} />
                        Bästa dagarna
                        {selectedYear && <span className="text-xs text-app-muted">({selectedYear})</span>}
                        {selectedDirection && <span className="text-xs text-app-muted">({selectedDirection})</span>}
                    </h3>

                    {/* Sort selector */}
                    <div className="flex gap-1">
                        <button
                            onClick={() => setSortBy('maxGust')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'maxGust'
                                ? 'bg-app-surface-elevated text-app-text'
                                : 'bg-app-surface/40 text-app-muted hover:bg-app-surface-elevated/40'
                                }`}
                            title="Sortera efter högsta byvind"
                        >
                            Bästa byvind
                        </button>
                        <button
                            onClick={() => setSortBy('maxForce')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'maxForce'
                                ? 'bg-app-surface-elevated text-app-text'
                                : 'bg-app-surface/40 text-app-muted hover:bg-app-surface-elevated/40'
                                }`}
                            title="Sortera efter högsta medelvind"
                        >
                            Högsta medelvind
                        </button>
                        <button
                            onClick={() => setSortBy('avgForce')}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${sortBy === 'avgForce'
                                ? 'bg-app-surface-elevated text-app-text'
                                : 'bg-app-surface/40 text-app-muted hover:bg-app-surface-elevated/40'
                                }`}
                            title="Sortera efter genomsnittsvind"
                        >
                            Genomsnitt
                        </button>
                    </div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {dailyStats
                        .filter(day => {
                            // Filter by year if selected
                            if (selectedYear !== null && day.year !== selectedYear) return false;
                            // Filter by direction if selected
                            if (selectedDirection !== null && getWindDirection(day.maxForceDirection) !== selectedDirection) return false;
                            return true;
                        })
                        .slice()
                        .sort((a, b) => {
                            // Sort based on selected metric
                            if (sortBy === 'maxGust') {
                                return b.maxGust - a.maxGust;
                            } else if (sortBy === 'maxForce') {
                                return b.maxForce - a.maxForce;
                            } else {
                                return b.avgForce - a.avgForce;
                            }
                        })
                        .slice(0, 50)
                        .map(day => {
                            const dayDate = parseISO(day.date);
                            return (
                                <button
                                    key={day.date}
                                    onClick={() => onDayClick && onDayClick(dayDate)}
                                    className="w-full border rounded-xl p-3 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                                    style={getWindSpeedStyle(day.maxForce)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold">
                                            {format(dayDate, 'd MMMM yyyy', { locale: sv })}
                                        </span>
                                        <span className="text-xs opacity-75">
                                            {getWindDirection(day.maxForceDirection)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                        <span className={sortBy === 'maxGust' ? 'font-bold' : ''}>
                                            Byvind: {day.maxGust} m/s
                                        </span>
                                        <span className={sortBy === 'maxForce' ? 'font-bold' : ''}>
                                            Max: {day.maxForce} m/s
                                        </span>
                                        <span className={sortBy === 'avgForce' ? 'font-bold' : ''}>
                                            Medel: {day.avgForce} m/s
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                </div>
            </div>

            {loading && (
                <div className="text-center py-4">
                    <span className="text-xs text-app-subtle">Uppdaterar...</span>
                </div>
            )}
        </div>
    );
}
