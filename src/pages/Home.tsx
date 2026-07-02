import { useWindData } from '../hooks/useWindData';
import { useForecast } from '../hooks/useForecast';
import { useForecastModels } from '../hooks/useForecastModels';
import { WindChart } from '../components/WindChart';
import { PullToRefresh } from '../components/PullToRefresh';
import { WindDataGroup } from '../components/WindDataGroup';
import { WindCalendar } from '../components/WindCalendar';
import { Header } from '../components/Header';
import { getSunrise, getSunset } from '../utils/solarTimes';
import { KALLSJON, FORECAST_MODELS } from '../config/constants';
import {
  format,
  addDays,
  subDays,
  endOfDay,
  startOfDay,
  subHours,
  addHours,
} from 'date-fns';
import { sv } from 'date-fns/locale';
import { useState, useMemo, useCallback } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ForecastModel, ForecastDataset } from '../types/WindData';
import { windPointsToWindData } from '../utils/windDataConverter';
import { getStartDate, getEndDate } from '../utils/dateRangeUtils';
import { useProcessedWindData } from '../hooks/useProcessedWindData';
import { useNextWindyDay } from '../hooks/useNextWindyDay';

const getMoonInfo = (date: Date) => {
  const synmonth = 29.53058867;
  const reference = new Date("2000-01-06").getTime();
  const phase = ((date.getTime() - reference) % (synmonth * 86400000)) / (synmonth * 86400000);
  const percentage = Math.round(phase * 100);

  if (phase < 0.125) return { emoji: '🌑', percentage };
  if (phase < 0.25) return { emoji: '🌒', percentage };
  if (phase < 0.375) return { emoji: '🌓', percentage };
  if (phase < 0.625) return { emoji: '🌔', percentage };
  if (phase < 0.75) return { emoji: '🌕', percentage };
  if (phase < 0.875) return { emoji: '🌖', percentage };
  if (phase < 1) return { emoji: '🌗', percentage };
  return { emoji: '🌘', percentage };
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
  </div>
);

function Home() {
  // Initialize the state to start with the "Idag" view
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(now);
  const [timeRange, setTimeRange] = useState<1 | 2 | 3 | 7>(7);
  const [showForecast, setShowForecast] = useState(true);
  const [showOnlyForecast, setShowOnlyForecast] = useState(false);
  const [todayTimeWindow, setTodayTimeWindow] = useState<{ start: Date; end: Date } | null>(null);

  // NYA multi-model states
  const [selectedModels, setSelectedModels] = useState<ForecastModel[]>([
    ForecastModel.SMHI,
    ForecastModel.MET_NORWAY
  ]);
  const [showConsensus, setShowConsensus] = useState(false);

  // NYA multi-model forecast hook - determines range for both forecast + observed data
  const forecastRange = useMemo(() => ({
    start: getStartDate(currentDate, timeRange),
    end: getEndDate(currentDate, timeRange)
  }), [currentDate, timeRange]);

  // Fetch observed wind data based on the current view range
  const { data: windData, loading: windLoading, error: windError } = useWindData({
    startDate: forecastRange.start,
    endDate: forecastRange.end
  });

  // Calculate the date range for the legacy per-day forecast hook
  const windDataRange = useMemo(() => {
    const start = startOfDay(currentDate);
    const end = endOfDay(currentDate);
    return { start, end };
  }, [currentDate]);

  // Legacy forecast hook (behålls för bakåtkompatibilitet)
  const { data: legacyForecastData, loading: forecastLoading, error: forecastError } = useForecast({
    startDate: windDataRange.start,
    endDate: windDataRange.end,
  });

  const {
    dataByModel,
    loadingByModel,
    errors: modelErrors,
    lastUpdatedByModel,
    modelSpread
  } = useForecastModels({
    lat: KALLSJON.lat,
    lon: KALLSJON.lon,
    startDate: forecastRange.start,
    endDate: forecastRange.end,
    enabledModels: selectedModels
  });

  const activeForecastDataRaw = useMemo(() => {
    if (selectedModels.length > 0) {
      // Combine multi-model points to WindData
      // We filter to forecastRange to match what is requested
      const allPoints = selectedModels.flatMap(m => dataByModel[m] || []);
      const filteredPoints = allPoints.filter(point => {
        const pointTime = new Date(point.time);
        return pointTime >= forecastRange.start && pointTime <= forecastRange.end;
      });
      return windPointsToWindData(filteredPoints);
    }
    // Fallback to legacy data
    return legacyForecastData || [];
  }, [selectedModels, dataByModel, legacyForecastData, forecastRange]);

  const {
    processedForecastData,
    aggregatedWindData,
    groupedByDate,
    groupedForecastData
  } = useProcessedWindData({
    windData,
    forecastData: activeForecastDataRaw,
    todayTimeWindow,
    viewDateRange: forecastRange
  });

  // Kombinera forecast datasets för WindChart (matchar vald tidsvy)
  const chartForecastDatasets = useMemo((): ForecastDataset[] => {
    const datasets: ForecastDataset[] = [];

    selectedModels.forEach(modelId => {
      if (dataByModel[modelId]?.length > 0) {
        // Filtrera till vald vy (forecastRange)
        const chartData = dataByModel[modelId].filter(point => {
          const pointTime = new Date(point.time);
          return pointTime >= forecastRange.start && pointTime <= forecastRange.end;
        });

        if (chartData.length > 0) {
          datasets.push({
            modelId,
            modelName: FORECAST_MODELS[modelId === ForecastModel.SMHI ? 'SMHI' : modelId === ForecastModel.MET_NORWAY ? 'MET_NORWAY' : 'CONSENSUS'].name,
            color: FORECAST_MODELS[modelId === ForecastModel.SMHI ? 'SMHI' : modelId === ForecastModel.MET_NORWAY ? 'MET_NORWAY' : 'CONSENSUS'].color,
            data: chartData,
            lastUpdated: lastUpdatedByModel[modelId] || undefined
          });
        }
      }
    });

    // Lägg till consensus om den är aktiverad
    if (showConsensus && dataByModel[ForecastModel.CONSENSUS]?.length > 0) {
      const chartData = dataByModel[ForecastModel.CONSENSUS].filter(point => {
        const pointTime = new Date(point.time);
        return pointTime >= forecastRange.start && pointTime <= forecastRange.end;
      });

      if (chartData.length > 0) {
        datasets.push({
          modelId: ForecastModel.CONSENSUS,
          modelName: FORECAST_MODELS.CONSENSUS.name,
          color: FORECAST_MODELS.CONSENSUS.color,
          data: chartData,
          lastUpdated: lastUpdatedByModel[ForecastModel.CONSENSUS] || undefined
        });
      }
    }

    // Add Observed Data if available
    if (windData && windData.length > 0) {
      const observedPoints = windData
        .filter(d => {
          return d.time >= forecastRange.start && d.time <= forecastRange.end;
        })
        .map(d => ({
          time: d.time.toISOString(),
          wind: d.windSpeed,
          gust: d.windGust,
          dir: d.windDirection,
          source: ForecastModel.OBSERVED
        }));

      if (observedPoints.length > 0) {
        datasets.push({
          modelId: ForecastModel.OBSERVED,
          modelName: FORECAST_MODELS.OBSERVED.name,
          color: FORECAST_MODELS.OBSERVED.color,
          data: observedPoints
        });
      }
    }

    return datasets;
  }, [selectedModels, dataByModel, lastUpdatedByModel, showConsensus, forecastRange, windData]);

  const loading = windLoading || forecastLoading || Object.values(loadingByModel).some(l => l);
  const error = windError || forecastError;

  // Kombinera forecast datasets för WindCalendar (för kalendern vill vi ha alla kommande 10 dagar)
  const forecastDatasets = useMemo((): ForecastDataset[] => {
    const datasets: ForecastDataset[] = [];

    // Define the window for the calendar view based on current selection
    // If looking at today/future: show next 10 days
    // If looking at past: show +/- 5 days or next 10 days from selected date?
    // User said "samma vy för bästa data per dag" when going back.
    // Standard "Calendar" logic usually shows X days from start date.
    const calendarStart = startOfDay(currentDate);
    const calendarEnd = addDays(calendarStart, 10);

    selectedModels.forEach(modelId => {
      if (dataByModel[modelId]?.length > 0) {
        // För kalendern: filtrera till valt intervall
        const calendarData = dataByModel[modelId].filter(point => {
          const pointTime = new Date(point.time);
          return pointTime >= calendarStart && pointTime <= calendarEnd;
        });

        if (calendarData.length > 0) {
          datasets.push({
            modelId,
            modelName: FORECAST_MODELS[modelId === ForecastModel.SMHI ? 'SMHI' : modelId === ForecastModel.MET_NORWAY ? 'MET_NORWAY' : 'CONSENSUS'].name,
            color: FORECAST_MODELS[modelId === ForecastModel.SMHI ? 'SMHI' : modelId === ForecastModel.MET_NORWAY ? 'MET_NORWAY' : 'CONSENSUS'].color,
            data: calendarData,
            lastUpdated: lastUpdatedByModel[modelId] || undefined
          });
        }
      }
    });

    // Lägg till consensus om den är aktiverad
    if (showConsensus && dataByModel[ForecastModel.CONSENSUS]?.length > 0) {
      const calendarData = dataByModel[ForecastModel.CONSENSUS].filter(point => {
        const pointTime = new Date(point.time);
        return pointTime >= calendarStart && pointTime <= calendarEnd;
      });

      if (calendarData.length > 0) {
        datasets.push({
          modelId: ForecastModel.CONSENSUS,
          modelName: FORECAST_MODELS.CONSENSUS.name,
          color: FORECAST_MODELS.CONSENSUS.color,
          data: calendarData,
          lastUpdated: lastUpdatedByModel[ForecastModel.CONSENSUS] || undefined
        });
      }
    }

    // Add Observed Data (Always check if we have observed data in the range)
    // This allows seeing observed data when looking back in time
    if (windData && windData.length > 0) {
      const observedPoints = windData
        .filter(d => {
          return d.time >= calendarStart && d.time <= calendarEnd;
        })
        .map(d => ({
          time: d.time.toISOString(),
          wind: d.windSpeed,
          gust: d.windGust,
          dir: d.windDirection,
          source: ForecastModel.OBSERVED
        }));

      if (observedPoints.length > 0) {
        datasets.push({
          modelId: ForecastModel.OBSERVED,
          modelName: FORECAST_MODELS.OBSERVED.name,
          color: FORECAST_MODELS.OBSERVED.color,
          data: observedPoints
        });
      }
    }

    return datasets;
  }, [selectedModels, dataByModel, lastUpdatedByModel, showConsensus, currentDate, windData]);

  const handleFoundWindyDay = useCallback(() => {
    setTimeRange(1); // Set to 24 hours view
    setShowForecast(true);
    setShowOnlyForecast(false);
    setTodayTimeWindow(null); // Reset today window to show full 24h
  }, []);

  const { findNextWindyDate } = useNextWindyDay({
    currentDate,
    setCurrentDate,
    loading,
    groupedByDate,
    groupedForecastData,
    onFound: handleFoundWindyDay
  });

  const handlePrevious = () => {
    if (loading) return;
    const newDate = subDays(currentDate, 1);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setShowForecast(false);
      setTodayTimeWindow(null); // Reset the today time window
    }
  };

  const handleNext = () => {
    if (loading) return;
    const newDate = addDays(currentDate, 1);
    const today = new Date();
    const maxFutureDate = addDays(today, 10); // Begränsa till 10 dagar framåt

    if (!isNaN(newDate.getTime()) && newDate <= maxFutureDate) {
      setCurrentDate(newDate);

      // Om vi går framåt förbi idag, aktivera prognos automatiskt
      if (newDate > today) {
        setShowForecast(true);
        setShowOnlyForecast(false);
      } else {
        setShowForecast(false);
      }

      setTodayTimeWindow(null); // Reset the today time window
    }
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      setShowOnlyForecast(false);
      setTodayTimeWindow(null);
    }
  };

  const handleTimeRangeChange = useCallback((newRange: 1 | 2 | 3 | 7) => {
    setTimeRange(newRange);
    setTodayTimeWindow(null);
  }, []);

  const handleTodayClick = () => {
    const now = new Date();
    setTodayTimeWindow(null);
    setCurrentDate(now);
    setTimeRange(7);
    setShowForecast(true);
    setShowOnlyForecast(false);
  };

  const handleRefresh = async () => {
    // Reset to current time
    const now = new Date();
    setCurrentDate(now);
    if (todayTimeWindow) {
      setTodayTimeWindow({
        start: subHours(now, 6),
        end: addHours(now, 16),
      });
    }
    // Note: React Query / SWR or specialized hooks usually handle refetching better. 
    // Here we rely on component re-mount or state reset.
  };

  return (
    <div className="min-h-screen bg-kallsjon-green dark:bg-gray-900">
      <Header onLogoClick={handleTodayClick} />
      <PullToRefresh onRefresh={handleRefresh}>
        <main className="max-w-7xl mx-auto px-4">
          <div className="mt-6 mb-6 flex items-center gap-2 justify-center">
            <button
              onClick={() => findNextWindyDate('backward')}
              aria-label="Föregående blåsiga dag"
              className="px-3 py-2 bg-gray-300 text-black dark:bg-gray-700 rounded-md border shadow-sm hover:bg-kallsjon-green-dark dark:hover:bg-kallsjon-green-dark"
              disabled={loading}
            >
              <span className="sr-only">Föregående blåsiga</span>
              ⟪
            </button>

            <button
              onClick={handlePrevious}
              aria-label="Föregående dag"
              className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
              disabled={showOnlyForecast}
            >
              <span className="sr-only">Föregående</span>
              ←
            </button>

            <div className="relative inline-block">
              <input
                type="date"
                aria-label="Välj datum"
                value={currentDate.toISOString().split('T')[0]}
                onChange={handleDateChange}
                className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 appearance-none text-base pr-8"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 2h8v12H6V4zm2 3a1 1 0 100 2h4a1 1 0 100-2H8z" />
                </svg>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="px-3 py-2 bg-white dark:bg-gray-800 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={loading || showOnlyForecast}
            >
              <span className="sr-only">Nästa</span>
              →
            </button>

            <button
              onClick={() => findNextWindyDate('forward')}
              aria-label="Nästa blåsiga dag"
              className="px-3 py-2 bg-gray-300 text-black dark:bg-kallsjon-green rounded-md border shadow-sm hover:bg-kallsjon-green-dark dark:hover:bg-kallsjon-green-dark"
              disabled={loading}
            >
              <span className="sr-only">Nästa blåsiga</span>
              ⟫
            </button>
          </div>

          {/* Kontroller för tidsintervall och modellval */}
          <div className="mb-6 flex flex-wrap items-center gap-2 justify-center">
            <button
              onClick={handleTodayClick}
              className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm md:text-base"
            >
              Idag
            </button>

            <div className="relative inline-block">
              <select
                value={timeRange}
                onChange={e => handleTimeRangeChange(Number(e.target.value) as 1 | 2 | 3 | 7)}
                className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md border shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 appearance-none pr-8 text-sm md:text-base"
              >
                <option value={1}>24 timmar</option>
                <option value={2}>2 dagar</option>
                <option value={3}>3 dagar</option>
                <option value={7}>7 dagar</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>

          </div>

          {/* WindCalendar */}
          {forecastDatasets.length > 0 && (
            <div className="mb-6">
              <ErrorBoundary>
                <WindCalendar
                  forecastDatasets={forecastDatasets}
                  selectedDate={currentDate}
                  onDateSelect={(date) => {
                    setCurrentDate(date);
                    setShowOnlyForecast(false);
                    setTodayTimeWindow(null);
                  }}
                  daysToShow={10}
                  modelSpread={modelSpread}
                />
              </ErrorBoundary>
            </div>
          )}

          {/* Modellväljare och status */}
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
              Prognosmodeller
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {[FORECAST_MODELS.SMHI, FORECAST_MODELS.MET_NORWAY].map((model) => {
                const modelId = model.id as ForecastModel;
                const isSelected = selectedModels.includes(modelId);
                const hasError = modelErrors[modelId];
                const lastUpdated = lastUpdatedByModel[modelId];

                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (isSelected && selectedModels.length > 1) {
                        setSelectedModels(selectedModels.filter(m => m !== modelId));
                      } else if (!isSelected) {
                        setSelectedModels([...selectedModels, modelId]);
                      }
                    }}
                    className={`px-3 py-2 rounded-md border-2 transition-all ${isSelected
                        ? 'bg-opacity-20 shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 opacity-60'
                      }`}
                    style={{
                      borderColor: model.color,
                      backgroundColor: isSelected ? model.color : undefined
                    }}
                  >
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {model.name}
                    </span>
                    {isSelected && hasError && (
                      <span className="ml-1 text-yellow-600" title="Använder cachad data">
                        ⚠️
                      </span>
                    )}
                    {isSelected && !hasError && lastUpdated && (
                      <span className="ml-1 text-green-600" title={`Uppdaterad ${new Date(lastUpdated).toLocaleTimeString()}`}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={() => setShowConsensus(!showConsensus)}
                className={`px-3 py-2 rounded-md border-2 transition-all ${showConsensus
                    ? 'bg-gray-500 bg-opacity-20 shadow-md border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 opacity-60 border-gray-400'
                  }`}
                disabled={selectedModels.length < 2}
                title={selectedModels.length < 2 ? 'Kräver minst 2 modeller' : 'Visa medelvärde av modeller'}
              >
                <span className="font-medium text-sm text-gray-900 dark:text-white">
                  Consensus
                </span>
              </button>
            </div>

            {/* Attribution */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Prognosdata: {selectedModels.map(m => FORECAST_MODELS[m === ForecastModel.SMHI ? 'SMHI' : 'MET_NORWAY'].attribution).join(' / ')} – CC BY 4.0
            </p>
          </div>

          {loading && <LoadingSpinner />}

          {!loading && error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              Ett fel uppstod: {error.message}
            </div>
          )}

          {!loading && (
            <>
              <div className="mb-6">
                <ErrorBoundary>
                  <WindChart
                    windData={showOnlyForecast ? [] : aggregatedWindData}
                    forecastData={showForecast ? processedForecastData : []}
                    forecastDatasets={showForecast ? chartForecastDatasets : []}
                    title={
                      showOnlyForecast
                        ? `Vindprognos (${selectedModels.length} ${selectedModels.length === 1 ? 'modell' : 'modeller'})`
                        : 'Vindstyrka - observerad och prognos'
                    }
                    timeRange={timeRange}
                  />
                </ErrorBoundary>
              </div>
              {/* Listing for Observed and Forecast Data */}
              {!loading && !showOnlyForecast && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Observerade värden
                  </h2>
                  {Object.entries(groupedByDate)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([dateKey, hourGroups]) => (
                      <div key={dateKey} className="mb-6">
                        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">
                          {format(new Date(dateKey), 'EEE d MMM', { locale: sv })}
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            ☀ {format(getSunrise(KALLSJON.lat, KALLSJON.lon, new Date(dateKey)), 'HH:mm')}
                            {' '} {' '}
                            ☽ {format(getSunset(KALLSJON.lat, KALLSJON.lon, new Date(dateKey)), 'HH:mm')}
                            {' '} {' '}
                            {getMoonInfo(new Date(dateKey)).emoji} {getMoonInfo(new Date(dateKey)).percentage}%
                          </span>
                        </h3>
                        {hourGroups
                          .sort((a, b) => b.best.time.getTime() - a.best.time.getTime())
                          .map(({ best, records }) => (
                            <WindDataGroup
                              key={best.time.getTime()}
                              bestWind={best}
                              hourData={records.sort((a, b) => b.time.getTime() - a.time.getTime())}
                              isForecast={false}
                            />
                          ))}
                      </div>
                    ))}
                </div>
              )}

              {!loading && (showForecast || showOnlyForecast) && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Prognosvärden
                  </h2>
                  {Object.entries(groupedForecastData)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([hourKey, { best, records }]) => (
                      <WindDataGroup
                        key={hourKey}
                        bestWind={best}
                        hourData={records}
                        isForecast={true}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </main>
      </PullToRefresh>
    </div>
  );
}

export default Home; 
