import { useState } from 'react';
import { WindOverview } from '../components/WindOverview';
import { WindDetail } from '../components/WindDetail';
import { Header } from '../components/Header';

function Experiments() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateSelect = (date: Date): void => {
    setSelectedDate(date);
  };

  const handleBack = (): void => {
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header title="Experiment" />
      
      <main className="flex-1 container mx-auto px-4 py-6 max-w-screen-2xl">
        <div className="space-y-4">
          {selectedDate ? (
            <WindDetail selectedDate={selectedDate} onBack={handleBack} />
          ) : (
            <WindOverview onDateSelect={handleDateSelect} />
          )}

          {/* Placeholder for future experiments */}
          <section className="bg-white rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-2">Kommande experiment</h2>
            <p className="text-gray-600 text-sm">
              Här kommer vi att lägga till fler experiment med olika sätt att visualisera vinddata.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Experiments; 