import { useState } from 'react';
import { WindOverview } from '../components/WindOverview';
import { WindDetail } from '../components/WindDetail';

function Experiments() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateSelect = (date: Date): void => {
    setSelectedDate(date);
  };

  const handleBack = (): void => {
    setSelectedDate(null);
  };

  return (
    <div className="container mx-auto px-2 py-4 max-w-screen-2xl">
      <h1 className="text-2xl font-bold mb-4 px-2">Experiment med vinddata</h1>
      
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
    </div>
  );
}

export default Experiments; 