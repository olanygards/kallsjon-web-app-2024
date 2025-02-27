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
}

export function WindDetailModal({ isOpen, onClose, date, windData }: WindDetailModalProps) {
  if (!isOpen || !date || !windData) return null;

  const formattedDate = format(date, 'EEEE d MMMM', { locale: sv });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">{formattedDate}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 dark:text-white" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto">
          {/* Quick Stats */}


          {/* Wind Map Section */}
          <div className="mb-2">
            <div className="rounded-lg border border-gray-700 p-2" style={{ backgroundColor: 'rgb(151 183 166)' }}>
              {windData.hourlyData.length > 0 ? (
                <WindMap 
                  windData={windData.hourlyData.map(data => ({
                    time: data.time,
                    speed: data.speed,
                    gust: data.gust,
                    direction: data.direction
                  }))}
                  date={formattedDate}
                  onDateChange={() => {}}
                />
              ) : (
                <div className="text-center py-8 text-gray-400">
                  Ingen vinddata tillgänglig för denna dag
                </div>
              )}
            </div>
          </div>

          {/* Additional Analysis Section */}
          <div className="space-y-6">
            {/* Wind Speed Distribution Chart Placeholder */}
            <div className="border dark:border-gray-700 rounded-lg p-4 h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Vindfördelning (kommer snart)</span>
            </div>

            {/* Wind Direction Chart Placeholder */}
            <div className="border dark:border-gray-700 rounded-lg p-4 h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Vindriktning över tid (kommer snart)</span>
            </div>

            {/* Additional Analysis Placeholder */}
            <div className="border dark:border-gray-700 rounded-lg p-4 h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
              <span className="text-gray-500 dark:text-gray-400">Detaljerad analys (kommer snart)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
              Stäng
            </button>
            <button
              onClick={() => {/* TODO: Add export functionality */}}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Exportera data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 