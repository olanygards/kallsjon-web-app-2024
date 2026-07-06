import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";

const KallsurfHome = lazy(() => import("./pages/KallsurfHome"));

function RouteFallback() {
  return (
    <div className="h-full bg-app-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-app-subtle">
        <div className="w-8 h-8 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
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
    // h-full (inte min-h-screen): höjdkedjan html → body → #root → hit → KallsurfHome
    // måste vara obruten för att <main> ska bli scroll-container (body är overflow:hidden)
    <div className="h-full bg-app-bg">
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
