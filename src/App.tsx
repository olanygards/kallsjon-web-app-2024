import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

const KallsurfHome = lazy(() => import("./pages/KallsurfHome"));
const DailyView = lazy(() => import("./pages/DailyView"));
const Home = lazy(() => import("./pages/Home"));
const Now = lazy(() => import("./pages/Now"));
const ChartView = lazy(() => import("./pages/ChartView"));
const Experiments = lazy(() => import("./pages/Experiments"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-kallsjon-green flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-kallsjon-green-dark">
        <div className="w-8 h-8 border-2 border-kallsjon-green-dark border-t-transparent rounded-full animate-spin" />
        <div className="text-xs uppercase tracking-widest font-medium">Laddar</div>
      </div>
    </div>
  );
}

// Component to handle route changes and app styling
function AppContent() {
  const location = useLocation();

  useEffect(() => {
    // Check if app is running in standalone mode (added to home screen)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone
      || document.referrer.includes('android-app://');

    if (isInStandaloneMode) {
      // Apply background color to entire document in standalone mode
      document.documentElement.style.backgroundColor = '#96b9a3';

      // Listen for display-mode changes
      const mediaQueryList = window.matchMedia('(display-mode: standalone)');
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.style.backgroundColor = e.matches ? '#96b9a3' : '';
      };

      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
  }, []);

  // When route changes, scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-kallsjon-green">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<KallsurfHome />} />
          <Route path="/classic" element={<DailyView />} />
          <Route path="/home" element={<Home />} />
          <Route path="/now" element={<Now />} />
          <Route path="/chart" element={<ChartView />} />
          <Route path="/experiments" element={<Experiments />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;