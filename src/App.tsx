import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import DailyView from "./pages/DailyView";
import Home from "./pages/Home";
import ChartView from "./pages/ChartView";
import Experiments from "./pages/Experiments";
import Now from "./pages/Now";
import KallsurfHome from "./pages/KallsurfHome";

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
      <Routes>
        <Route path="/" element={<KallsurfHome />} />
        <Route path="/classic" element={<DailyView />} />
        <Route path="/home" element={<Home />} />
        <Route path="/now" element={<Now />} />
        <Route path="/chart" element={<ChartView />} />
        <Route path="/experiments" element={<Experiments />} />
      </Routes>
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