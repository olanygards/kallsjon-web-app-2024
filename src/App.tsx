import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DailyView from "./pages/DailyView";
import ChartView from "./pages/ChartView";
import Experiments from "./pages/Experiments";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<DailyView />} />
          <Route path="/chart" element={<ChartView />} />
          <Route path="/experiments" element={<Experiments />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;