import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

const KallsurfHome = lazy(() => import("./pages/KallsurfHome"));

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

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone
      || document.referrer.includes('android-app://');

    if (isInStandaloneMode) {
      document.documentElement.style.backgroundColor = '#96b9a3';

      const mediaQueryList = window.matchMedia('(display-mode: standalone)');
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.style.backgroundColor = e.matches ? '#96b9a3' : '';
      };

      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-kallsjon-green">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<KallsurfHome />} />
          <Route path="*" element={<KallsurfHome />} />
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
