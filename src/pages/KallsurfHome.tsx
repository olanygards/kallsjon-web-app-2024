import { useState, useMemo } from 'react';
import { Wind, History, TrendingUp, Zap, Image as ImageIcon, X } from 'lucide-react';
import { useKallsurfTimeline } from '../hooks/useKallsurfTimeline';
import { HeroStats } from '../components/kallsurf/HeroStats';
import { WindOverviewChart } from '../components/kallsurf/WindOverviewChart';
import { DailyForecast } from '../components/kallsurf/DailyForecast';
import { HistoryTabs } from '../components/kallsurf/HistoryTabs';
import { CalendarGrid } from '../components/kallsurf/CalendarGrid';
import { StatsView } from '../components/kallsurf/StatsView';
import { MediaView } from '../components/media/MediaView';
import { MediaUpload } from '../components/media/MediaUpload';

export default function KallsurfHome() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'stats' | 'media'>('overview');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { timeline, hourlyBuckets, dailySummary, currentWind, loading, error, warning, thresholds } = useKallsurfTimeline(viewDate, selectedDate);

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setViewDate(date);
    setActiveTab('history');
    // Scrolla till toppen av historik-vyn om vi är långt ner
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Beräkna om vi är i "active" mode (hög vind nu eller snart)
  // Vi kör alltid "active" mode nu enligt önskemål
  const isActive = true;

  // Visa bara info-rutan om det blåser över 9 m/s kommande 12 timmar
  const showPotentialInfo = useMemo(() => {
    const next12Hours = hourlyBuckets.slice(0, 12);
    return next12Hours.some(h => h.avg > 9);
  }, [hourlyBuckets]);

  const renderOverview = () => {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <HeroStats currentWind={currentWind} isActive={isActive} />

        {showPotentialInfo && (
          <div className="flex gap-2">
            <div className="bg-emerald-950/30 border border-emerald-900/50 p-3 rounded-xl flex-1 flex items-center gap-3">
              <Zap size={18} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-100 leading-tight">
                <span className="font-bold block mb-0.5">Potential just nu</span>
                Vinden ligger på runt surfnivå. Håll koll på topparna kommande timmar.
              </p>
            </div>
          </div>
        )}

        <WindOverviewChart timeline={timeline} thresholds={thresholds} />

        <DailyForecast hourlyBuckets={hourlyBuckets} onCardClick={handleDayClick} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-emerald-200 font-sans selection:bg-emerald-500 selection:text-white">
      <header
        className="fixed top-0 left-0 right-0 z-20 bg-emerald-950/90 backdrop-blur-md border-b border-emerald-800 px-4 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer p-0"
          >
            <h1 className="font-bold text-lg tracking-tight text-white">
              Kall<span className="text-emerald-400">ifornia</span>
            </h1>
          </button>
        </div>
      </header>

      <main
        className="px-4 pb-24 max-w-md mx-auto min-h-screen"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 80px)' }}
      >
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-emerald-500">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs uppercase tracking-widest font-medium">Hämtar vinddata</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-800/50 p-4 rounded-xl text-red-200">
            <p className="font-bold mb-1">Fel vid hämtning av data</p>
            <p className="text-sm">{error.message}</p>
          </div>
        ) : (
          <>
            {warning && (
              <div className="bg-yellow-900/20 border border-yellow-800/50 p-3 rounded-xl text-yellow-200 mb-4 text-sm flex items-center gap-2">
                <span className="block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Viss prognosdata kunde inte hämtas. Visar tillgänglig data.
              </div>
            )}
            {activeTab === 'overview' && renderOverview()}

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
                  onBackToOverview={() => setActiveTab('overview')}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-emerald-950 border border-emerald-800 rounded-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-emerald-400 hover:text-white z-10"
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
        className="fixed bottom-0 left-0 right-0 z-20 bg-emerald-950/90 backdrop-blur-xl border-t border-emerald-800"
        style={{
          // Safe area + a small base padding (avoid double padding from inner container)
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
          position: 'fixed',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)'
        }}
      >
        <div className="max-w-md mx-auto flex justify-around items-center px-2 pt-2 pb-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'overview'
              ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-900/20 scale-105'
              : 'bg-emerald-900 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-800'
              }`}
          >
            <Wind size={22} strokeWidth={activeTab === 'overview' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Läget</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'history'
              ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-900/20 scale-105'
              : 'bg-emerald-900 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-800'
              }`}
          >
            <History size={22} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Detaljer</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'stats'
              ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-900/20 scale-105'
              : 'bg-emerald-900 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-800'
              }`}
          >
            <TrendingUp size={22} strokeWidth={activeTab === 'stats' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Stats</span>
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-20 ${activeTab === 'media'
              ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-900/20 scale-105'
              : 'bg-emerald-900 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-800'
              }`}
          >
            <ImageIcon size={22} strokeWidth={activeTab === 'media' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Media</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

