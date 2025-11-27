import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, isSameMonth } from 'date-fns';
import { sv } from 'date-fns/locale';
import { DailySummary } from '../../hooks/useKallsurfTimeline';

const getWindColor = (adjustedWind: number): string => {
  if (!adjustedWind || adjustedWind < 11.0) return '#ECEFF1';
  if (adjustedWind >= 19.0) return '#5E35B1';
  if (adjustedWind >= 18.5) return '#8E24AA';
  if (adjustedWind >= 17.0) return '#D81B60';
  if (adjustedWind >= 16.5) return '#E53935';
  if (adjustedWind >= 16.0) return '#F4511E';
  if (adjustedWind >= 15.5) return '#FB8C00';
  if (adjustedWind >= 15.0) return '#FFB300';
  if (adjustedWind >= 14.5) return '#FDD835';
  if (adjustedWind >= 13.0) return '#43A047';
  if (adjustedWind >= 12.5) return '#66BB6A';
  if (adjustedWind >= 12.0) return '#81C784';
  if (adjustedWind >= 11.5) return '#A5D6A7';
  if (adjustedWind >= 11.0) return '#C8E6C9';
  return '#ECEFF1';
};

const getTextColor = (wind: number): string => {
  if (!wind || wind < 13.0) return '#1e293b';
  if (wind >= 14.5 && wind < 16.0) return '#1e293b';
  return '#ffffff';
};

interface CalendarGridProps {
  dailySummary: DailySummary[];
  onDayClick?: (date: Date) => void;
  viewDate?: Date;
  onViewDateChange?: (date: Date) => void;
}

export function CalendarGrid({ dailySummary, onDayClick, viewDate = new Date(), onViewDateChange }: CalendarGridProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(viewDate.getFullYear());

  const currentDate = viewDate;
  const monthName = format(currentDate, 'MMMM yyyy', { locale: sv });
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update picker year when viewDate changes externally
  useEffect(() => {
    setPickerYear(viewDate.getFullYear());
  }, [viewDate]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const days: Array<{ empty?: boolean; day?: number; summary?: DailySummary; key: string }> = [];

  // Lägg till tomma dagar i början
  for (let i = 0; i < startOffset; i++) {
    days.push({ empty: true, key: `empty-${i}` });
  }

  // Lägg till dagar med data
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const summary = dailySummary.find(s => s.dateStr === dateStr);
    days.push({
      day: d,
      summary,
      key: `day-${d}`
    });
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDateChange?.(subMonths(currentDate, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDateChange?.(addMonths(currentDate, 1));
  };

  const isCurrentMonth = isSameMonth(currentDate, new Date());

  // Picker handlers
  const togglePicker = () => {
    setIsPickerOpen(!isPickerOpen);
    setPickerYear(year); // Reset to current view year when opening
  };

  const handleYearChange = (delta: number) => {
    setPickerYear(prev => prev + delta);
  };

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = new Date(pickerYear, monthIndex, 1);
    onViewDateChange?.(newDate);
    setIsPickerOpen(false);
  };

  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];

  return (
    <div className="bg-emerald-900 border border-emerald-800 rounded-2xl p-4 shadow-xl relative overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h3
          onClick={togglePicker}
          className="text-white font-bold capitalize flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors select-none"
        >
          <Calendar size={18} className="text-emerald-400" />
          {monthName}
        </h3>

        {!isPickerOpen && (
          <div className="flex gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-emerald-800 text-emerald-500 hover:text-emerald-300 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className={`p-1 rounded-lg transition-colors ${isCurrentMonth
                ? 'text-emerald-700 cursor-not-allowed'
                : 'hover:bg-emerald-800 text-emerald-500 hover:text-emerald-300'
                }`}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {isPickerOpen ? (
        <div className="animate-in fade-in zoom-in duration-200">
          {/* Year Selector */}
          <div className="flex justify-between items-center mb-6 px-4">
            <button
              onClick={() => handleYearChange(-1)}
              className="p-2 hover:bg-emerald-800 rounded-full text-emerald-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xl font-bold text-white">{pickerYear}</span>
            <button
              onClick={() => handleYearChange(1)}
              disabled={pickerYear >= new Date().getFullYear()}
              className={`p-2 rounded-full transition-colors ${pickerYear >= new Date().getFullYear()
                ? 'text-emerald-700 cursor-not-allowed'
                : 'hover:bg-emerald-800 text-emerald-400 hover:text-white'}`}
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-3">
            {months.map((m, i) => {
              const isFuture = pickerYear === new Date().getFullYear() && i > new Date().getMonth();
              const isSelected = pickerYear === year && i === month;

              return (
                <button
                  key={m}
                  disabled={isFuture}
                  onClick={() => handleMonthSelect(i)}
                  className={`p-3 rounded-lg text-sm font-medium transition-all ${isSelected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : isFuture
                      ? 'text-emerald-700 cursor-not-allowed'
                      : 'bg-emerald-800/50 text-emerald-300 hover:bg-emerald-800 hover:text-white border border-transparent'
                    }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsPickerOpen(false)}
              className="text-xs text-emerald-500 hover:text-emerald-300 underline"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">
            {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-emerald-500">
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              if (day.empty) {
                return <div key={day.key} className="aspect-square" />;
              }

              const isToday = isSameMonth(currentDate, new Date()) && day.day === new Date().getDate() && year === new Date().getFullYear();
              const maxAvg = day.summary?.maxAvg || 0;
              const bgColor = getWindColor(maxAvg);
              const textColor = getTextColor(maxAvg);

              return (
                <div
                  key={day.key}
                  onClick={() => day.summary && onDayClick?.(day.summary.date)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all hover:scale-105 border ${isToday
                    ? 'border-emerald-400 ring-2 ring-emerald-400/50 z-10'
                    : 'border-emerald-800/50'
                    } ${day.summary ? 'cursor-pointer hover:ring-2 hover:ring-emerald-400 hover:z-10' : ''
                    }`}
                  style={{ backgroundColor: bgColor }}
                >
                  <span className="text-[10px] font-bold" style={{ color: textColor }}>
                    {day.day}
                  </span>

                </div>
              );
            })}
          </div>

          <div className="mt-6 px-4">
            <div
              className="h-2 w-full rounded-full mb-1"
              style={{
                background: 'linear-gradient(to right, #ECEFF1, #C8E6C9, #A5D6A7, #81C784, #66BB6A, #43A047, #FDD835, #FFB300, #FB8C00, #F4511E, #E53935, #D81B60, #8E24AA, #5E35B1)'
              }}
            ></div>
            <div className="flex justify-between text-[10px] text-emerald-400 font-medium">
              <span>Stilla</span>
              <span>Kanske</span>
              <span>Funkar!</span>
              <span>Sov i bilen</span>
              <span>Ring TV Åre!</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

