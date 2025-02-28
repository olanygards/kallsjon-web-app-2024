import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { XMarkIcon } from '@heroicons/react/24/outline';
import WindMap from './WindMap';

interface HourlyData {
  time: string;
  speed: number;
  gust: number;
  direction: number;
}

interface WindDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  windData?: {
    maxWindSpeed: number;
    maxGust: number;
    windDirection: number;
    hourlyData: HourlyData[];
  };
  onDateChange?: (direction: 'prev' | 'next') => void;
}

export function WindDetailModal({ isOpen, onClose, date, windData, onDateChange }: WindDetailModalProps) {
  if (!isOpen || !date || !windData) return null;

  const formattedDate = format(date, 'EEEE d MMMM, yyyy', { locale: sv });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200" >
          <h2 className="text-xl font-semibold dark:text-white">{formattedDate}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 dark:text-white" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto" style={{ backgroundColor: 'rgb(174 208 175)' }}>
          {/* Wind Map Section */}
          <div className="mb-2">
            <div className="rounded-lg p-2" style={{ backgroundColor: 'rgb(174 208 175)' }}>
              {windData.hourlyData.length > 0 ? (
                <WindMap 
                  windData={windData.hourlyData.map(data => ({
                    time: data.time,
                    speed: data.speed,
                    gust: data.gust,
                    direction: data.direction
                  }))}
                  onDateChange={onDateChange}
                />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  Ingen vinddata tillgänglig för denna dag
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 