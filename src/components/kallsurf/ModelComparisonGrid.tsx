import { format } from 'date-fns';
import { MatrixRow, MATRIX_SLOT_HOURS } from '../../hooks/useForecastMatrix';
import { ForecastModelCell } from './ForecastModelCell';

interface ModelComparisonGridProps {
  rows: MatrixRow[];
  /** yyyy-MM-dd för vald dag — styr NU-markören */
  selectedDayKey: string;
}

/**
 * Modelljämförelse för en dag: 8 tidskolumner (3 h) × en rad per modell.
 * Läses lodrätt för spridning mellan modeller (BESLUT 03).
 */
export function ModelComparisonGrid({ rows, selectedDayKey }: ModelComparisonGridProps) {
  const now = new Date();
  const isToday = selectedDayKey === format(now, 'yyyy-MM-dd');
  const nowSlotIndex = isToday
    ? MATRIX_SLOT_HOURS.findIndex((h, i) => {
        const next = MATRIX_SLOT_HOURS[i + 1] ?? 24;
        return now.getHours() >= h && now.getHours() < next;
      })
    : -1;

  return (
    <div className="space-y-1">
      {/* Tim-header */}
      <div className="grid gap-1" style={{ gridTemplateColumns: '52px repeat(8, 1fr)' }}>
        <div />
        {MATRIX_SLOT_HOURS.map((h, i) => (
          <div
            key={h}
            className={`text-center text-[9px] ${i === nowSlotIndex ? 'text-white font-bold' : 'text-emerald-500'}`}
          >
            {String(h).padStart(2, '0')}
            {i === nowSlotIndex && <span className="block leading-none">▾</span>}
          </div>
        ))}
      </div>

      {/* Modellrader */}
      {rows.map(row => (
        <div
          key={row.model}
          className={`grid gap-1 items-center ${row.isConsensus ? 'pb-2 mb-1 border-b border-emerald-800/60' : ''}`}
          style={{ gridTemplateColumns: '52px repeat(8, 1fr)' }}
        >
          <div className="pr-1">
            <span className={`block text-[10px] font-bold leading-tight ${row.isConsensus ? 'text-white' : 'text-emerald-300'}`}>
              {row.isConsensus ? 'CONS.' : row.name}
            </span>
            {row.isConsensus && (
              <span className="block text-[8px] text-emerald-500 leading-none">median</span>
            )}
            {row.error && (
              <span className="block text-[8px] text-amber-500 leading-none" title={row.error.message}>
                ingen data
              </span>
            )}
          </div>

          {row.loading && row.cells.every(c => c === null)
            ? MATRIX_SLOT_HOURS.map(h => (
                <div key={h} className="rounded-md bg-emerald-900/60 animate-pulse h-10" />
              ))
            : row.cells.map((cell, i) => <ForecastModelCell key={i} cell={cell} />)}
        </div>
      ))}
    </div>
  );
}
