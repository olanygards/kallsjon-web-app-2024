import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

const KallsurfHome = lazy(() => import("./pages/KallsurfHome"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-emerald-500">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-xs uppercase tracking-widest font-medium">Laddar</div>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-emerald-950">
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
