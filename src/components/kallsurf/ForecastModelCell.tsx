import { ArrowUp } from 'lucide-react';
import { MatrixCell } from '../../hooks/useForecastMatrix';
import { getWindColor, getWindTextColor } from '../../utils/windColors';

interface ForecastModelCellProps {
  cell: MatrixCell | null;
}

export function ForecastModelCell({ cell }: ForecastModelCellProps) {
  if (!cell) {
    return (
      <div className="rounded-md border border-dashed border-emerald-800/50 bg-emerald-950/20 py-1.5 text-center text-emerald-700 text-[10px]">
        –
      </div>
    );
  }

  const bg = getWindColor(cell.wind);
  const text = getWindTextColor(cell.wind);

  return (
    <div
      className={`rounded-md border border-black/10 py-1 px-0.5 text-center leading-tight ${cell.isPast ? 'opacity-40' : ''}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {cell.dir !== null && (
        <span
          className="inline-block"
          style={{ transform: `rotate(${cell.dir + 180}deg)` }}
        >
          <ArrowUp size={9} strokeWidth={3} />
        </span>
      )}
      <span className="block text-[11px] font-bold">{Math.round(cell.wind)}</span>
      <span className="block text-[8px] opacity-80">
        {cell.gust !== null ? `(${Math.round(cell.gust)})` : ''}
      </span>
    </div>
  );
}
