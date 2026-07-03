import { useState, useMemo } from 'react';
import { Wind, History, TrendingUp, Zap, Image as ImageIcon, X, Layers } from 'lucide-react';
import { useKallsurfTimeline } from '../hooks/useKallsurfTimeline';
import { HeroStats } from '../components/kallsurf/HeroStats';
import { NextSurfChance } from '../components/kallsurf/NextSurfChance';
import { WindOverviewChart } from '../components/kallsurf/WindOverviewChart';
import { DailyForecast } from '../components/kallsurf/DailyForecast';
import { HistoryTabs } from '../components/kallsurf/HistoryTabs';
import { CalendarGrid } from '../components/kallsurf/CalendarGrid';
import { StatsView } from '../components/kallsurf/StatsView';
import { ForecastView } from '../components/kallsurf/ForecastView';
import { MediaView } from '../components/media/MediaView';
import { MediaUpload } from '../components/media/MediaUpload';
import { APP_THEME } from '../config/windScale';

type TabId = 'overview' | 'history' | 'forecast' | 'stats' | 'media';

export default function KallsurfHome() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { timeline, hourlyBuckets, dailySummary, currentWind, loading, error, warning } = useKallsurfTimeline(viewDate, selectedDate);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date);
    setActiveTab('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** Läget ska alltid visa nu — rensa dagval från Detaljer/Nästa surfchans */
  const goToOverview = () => {
    setSelectedDate(null);
    setViewDate(new Date());
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showPotentialInfo = useMemo(() => {
    const next12Hours = hourlyBuckets.slice(0, 12);
    return next12Hours.some(h => h.avg > 9);
  }, [hourlyBuckets]);

  const stationFresh = Date.now() - currentWind.time.getTime() < 15 * 60 * 1000;

  const renderOverview = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {showPotentialInfo && (
        <div
          className="rounded-xl p-3 text-white flex items-center gap-3"
          style={{ backgroundColor: APP_THEME.accentFlag.blue }}
        >
          <Zap size={16} className="flex-shrink-0" />
          <p className="text-xs leading-tight">
            <span className="font-bold uppercase tracking-wide block mb-0.5">Hög potential</span>
            Vind runt surfnivå väntas inom 12 timmar — håll koll på topparna.
          </p>
        </div>
      )}

      <HeroStats currentWind={currentWind} isActive />

      <NextSurfChance
        hourlyBuckets={hourlyBuckets}
        currentWind={currentWind}
        onClick={handleDayClick}
      />

      <WindOverviewChart timeline={timeline} />

      <DailyForecast hourlyBuckets={hourlyBuckets} onCardClick={handleDayClick} />
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans selection:bg-app-accent selection:text-white">
      <header
        className="fixed top-0 left-0 right-0 z-20 bg-app-bg/95 backdrop-blur-md border-b border-app-border px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={goToOverview}
            className="flex flex-col items-start bg-transparent border-none cursor-pointer p-0"
          >
            <h1 className="font-bold text-base tracking-tight text-app-text uppercase">
              Kallifornia
            </h1>
            <div className="flex h-0.5 w-16 mt-1 rounded-full overflow-hidden gap-px">
              <div className="flex-1" style={{ backgroundColor: APP_THEME.accentFlag.blue }} />
              <div className="flex-1" style={{ backgroundColor: APP_THEME.accentFlag.green }} />
              <div className="flex-1" style={{ backgroundColor: APP_THEME.accentFlag.yellow }} />
              <div className="flex-1" style={{ backgroundColor: APP_THEME.accentFlag.red }} />
            </div>
          </button>

          {/* Stationsstatus: fylld punkt = färsk data (< 15 min) */}
          {!loading && !error && (
            <span className="flex items-center gap-1.5 text-[11px] text-app-muted">
              <span
                className={`w-2 h-2 rounded-full ${stationFresh
                  ? 'bg-app-text'
                  : 'bg-transparent border-[1.5px] border-app-text'
                  }`}
              />
              Vassnäs · {currentWind.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      <main
        className="px-4 pb-28 max-w-md mx-auto min-h-screen"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}
      >
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-app-muted">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs uppercase tracking-widest font-medium">Hämtar vinddata</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
            <p className="font-bold mb-1">Fel vid hämtning av data</p>
            <p className="text-sm">{error.message}</p>
          </div>
        ) : (
          <>
            {warning && (
              <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-900 mb-3 text-xs flex items-center gap-2">
                <span className="block w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                Viss prognosdata kunde inte hämtas — visar tillgänglig data.
              </div>
            )}
            {activeTab === 'overview' && renderOverview()}

            {activeTab === 'forecast' && (
              <div className="animate-in slide-in-from-right-8 duration-300">
                <ForecastView onDayDetailsClick={handleDayClick} />
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <HistoryTabs
                  timeline={timeline}
                  selectedDate={selectedDate}
                  onClearSelection={() => setSelectedDate(null)}
                />
                <div className="mt-6">
                  <CalendarGrid
                    dailySummary={dailySummary}
                    onDayClick={handleDayClick}
                    viewDate={viewDate}
                    onViewDateChange={setViewDate}
                  />
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="animate-in slide-in-from-right-8 duration-300">
                <StatsView onDayClick={handleDayClick} />
              </div>
            )}

            {activeTab === 'media' && (
              <div className="animate-in slide-in-from-right-8 duration-300">
                <MediaView
                  onNavigateToDate={handleDayClick}
                  onUploadClick={() => setShowUploadModal(true)}
                  onBackToOverview={goToOverview}
                />
              </div>
            )}
          </>
        )}
      </main>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-app-muted hover:text-app-text z-10"
            >
              <X size={24} />
            </button>
            <div className="p-1">
              <MediaUpload onUploadComplete={() => setShowUploadModal(false)} />
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-20 bg-app-nav-bg backdrop-blur-xl border-t border-black/20"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
        }}
      >
        <div className="max-w-md mx-auto flex justify-around items-center px-1 pt-2 pb-0">
          {([
            { id: 'overview' as TabId, label: 'Läget', Icon: Wind },
            { id: 'history' as TabId, label: 'Detaljer', Icon: History },
            { id: 'forecast' as TabId, label: 'Prognos', Icon: Layers },
            { id: 'stats' as TabId, label: 'Stats', Icon: TrendingUp },
            { id: 'media' as TabId, label: 'Media', Icon: ImageIcon },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => (id === 'overview' ? goToOverview() : setActiveTab(id))}
              className={`flex flex-col items-center gap-1 py-3 px-1 rounded-2xl transition-all duration-300 w-16 ${activeTab === id
                ? 'bg-app-nav-active text-white shadow-lg scale-105'
                : 'text-app-nav-muted hover:text-white bg-transparent'
                }`}
            >
              <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
