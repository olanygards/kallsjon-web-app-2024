import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { WindChart } from './WindChart';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { WindData } from '../types/WindData';
import { WindDetailModal } from './WindDetailModal';

interface WindDetailProps {
  selectedDate: Date;
  onBack: () => void;
}

export function WindDetail({ selectedDate, onBack }: WindDetailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [detailedData, setDetailedData] = useState<WindData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(selectedDate);

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1);
    setCurrentDate(newDate);
  };

  useEffect(() => {
    async function fetchDetailedData() {
      try {
        setLoading(true);
        const start = startOfDay(currentDate);
        const end = endOfDay(currentDate);
        
        console.log('Fetching detailed data for:', {
          start: start.toISOString(),
          end: end.toISOString()
        });

        const windRef = collection(db, 'wind');
        const q = query(
          windRef,
          where('time', '>=', Timestamp.fromDate(start)),
          where('time', '<=', Timestamp.fromDate(end))
        );

        const querySnapshot = await getDocs(q);
        console.log('Query snapshot size:', querySnapshot.size);
        const data: WindData[] = [];

        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          console.log('Document data:', docData);
          
          if (!docData.time || typeof docData.force !== 'number' || 
              typeof docData.forceMax !== 'number' || typeof docData.direction !== 'number') {
            console.warn('Invalid data structure:', docData);
            return;
          }

          data.push({
            time: docData.time.toDate(),
            windSpeed: docData.force,
            windGust: docData.forceMax,
            windDirection: docData.direction,
            isForecast: false,
          });
        });

        console.log('Processed data:', data);
        setDetailedData(data.sort((a, b) => a.time.getTime() - b.time.getTime()));
      } catch (err) {
        console.error('Error fetching detailed wind data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch detailed wind data'));
      } finally {
        setLoading(false);
      }
    }

    fetchDetailedData();
  }, [currentDate]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        Ett fel uppstod: {error.message}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Detaljerad vinddata för {format(currentDate, 'EEEE d MMMM yyyy', { locale: sv })}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Visar vinddata med 5-minuters intervall
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
        >
          ← Tillbaka till översikt
        </button>
      </div>
      <div className="p-4">
        <WindChart 
          windData={detailedData}
          forecastData={[]}
          title={`Vindstyrka ${format(currentDate, 'd MMM yyyy', { locale: sv })}`}
          timeRange={1}
          zoomEnabled={true}
          variant="experiment"
        />
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
          >
            Se dagen grafiskt
          </button>
        </div>
      </div>

      <WindDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={currentDate}
        windData={{
          maxWindSpeed: Math.max(...(detailedData.length ? detailedData.map(d => d.windSpeed) : [0])),
          maxGust: Math.max(...(detailedData.length ? detailedData.map(d => d.windGust) : [0])),
          windDirection: detailedData[0]?.windDirection || 0,
          hourlyData: detailedData.map(d => ({
            time: format(d.time, 'HH:mm'),
            speed: d.windSpeed,
            gust: d.windGust,
            direction: d.windDirection
          }))
        }}
        onDateChange={handleDateChange}
      />
    </div>
  );
} 