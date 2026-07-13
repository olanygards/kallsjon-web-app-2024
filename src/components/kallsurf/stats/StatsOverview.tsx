import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronRight, TrendingUp, Wind, Calendar } from 'lucide-react';
import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { DailyStats } from '../../../hooks/useDailyStats';
import { APP_THEME } from '../../../config/windScale';
import { formatDirectionLabel } from '../../../utils/windDirection8';
import {
  averageYtdAcrossYears,
  buildAverageSeasonLabel,
  buildMonthList,
  buildMonthlyBars,
  countSurfableDaysYtd,
  findBestDay,
  findDominantDirection,
  parseDayDate,
} from '../../../utils/statsOverviewUtils';

interface StatsOverviewProps {
  days: DailyStats[];
  allYears: number[];
  overviewYear: number;
  onDayClick?: (date: Date) => void;
  onMonthClick?: (monthDate: Date) => void;
}

export function StatsOverview({
  days,
  allYears,
  overviewYear,
  onDayClick,
  onMonthClick,
}: StatsOverviewProps) {
  const yearDays = days.filter((d) => d.year === overviewYear);
  const ytdCount = countSurfableDaysYtd(days, overviewYear);
  const ytdAverage = averageYtdAcrossYears(days, overviewYear);
  const bestDay = findBestDay(yearDays);
  const dominant = findDominantDirection(yearDays);
  const monthlyBars = buildMonthlyBars(days, overviewYear);
  const monthList = buildMonthList(days, overviewYear);
  const snittLabel = buildAverageSeasonLabel(allYears, overviewYear);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-app-surface border border-app-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-app-muted" />
            <span className="text-xs font-medium uppercase tracking-wide text-app-muted">Surfbara dagar</span>
          </div>
          <p className="text-3xl font-bold text-app-text">
            {ytdCount}
            {ytdAverage !== null && (
              <span className="text-base font-normal text-app-muted ml-2">(snitt {ytdAverage})</span>
            )}
          </p>
          <p className="text-xs text-app-muted mt-1">{overviewYear} hittills</p>
        </div>

        {bestDay && (
          <button
            type="button"
            onClick={() => onDayClick?.(parseDayDate(bestDay.date))}
            className="bg-app-surface border border-app-border rounded-2xl p-4 text-left hover:bg-app-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-app-muted" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-muted">Bästa dag</span>
            </div>
            <p className="text-2xl font-bold text-app-text">{bestDay.maxForce} m/s</p>
            <p className="text-xs text-app-muted mt-1">
              {format(parseDayDate(bestDay.date), 'd MMMM yyyy', { locale: sv })} ·{' '}
              {formatDirectionLabel(bestDay.maxForceDirection)}
            </p>
          </button>
        )}

        {dominant && (
          <div className="bg-app-surface border border-app-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wind size={16} className="text-app-muted" />
              <span className="text-xs font-medium uppercase tracking-wide text-app-muted">Vanligaste riktning</span>
            </div>
            <p className="text-3xl font-bold text-app-text">{dominant.sector}</p>
            <p className="text-xs text-app-muted mt-1">{dominant.percent} % av dagarna</p>
          </div>
        )}
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-app-muted mb-1">
          Surfbara dagar per månad
        </h3>
        <p className="text-[10px] text-app-subtle mb-3">
          {overviewYear} mot snitt {snittLabel || '—'}
        </p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyBars} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececea" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <Bar dataKey="yearCount" fill={APP_THEME.accentFlag.blue} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line
                type="monotone"
                dataKey="averageCount"
                stroke="#9a9a9a"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={1.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-app-subtle mt-2">Snitt = alla hela säsonger utom vald.</p>
      </div>

      <div className="bg-app-surface border border-app-border rounded-2xl p-4">
        <h3 className="text-sm font-bold text-app-text mb-3">Per månad</h3>
        <div className="space-y-2">
          {monthList.map((item) => (
            <button
              key={item.month}
              type="button"
              onClick={() => onMonthClick?.(new Date(overviewYear, item.month - 1, 1))}
              className="w-full flex items-center justify-between rounded-xl border border-app-border px-3 py-2.5 hover:bg-app-surface-elevated transition-colors text-left"
            >
              <div>
                <span className="font-medium text-app-text">{item.label}</span>
                {item.inProgress && (
                  <span className="text-[10px] text-app-muted ml-2">(pågår)</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-app-muted">
                <span>{item.days} dgr{item.bestMaxForce > 0 ? ` · max ${item.bestMaxForce}` : ''}</span>
                <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
