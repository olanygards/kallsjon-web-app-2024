import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Experiments from "./pages/Experiments";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-kallsjon-green-dark shadow py-4">
          <div className="max-w-7xl mx-auto flex justify-center gap-4">
            <NavLink 
              to="/" 
              className={({ isActive }: { isActive: boolean }) => 
                isActive 
                  ? "bg-white text-kallsjon-green px-4 py-2 rounded-md" 
                  : "text-white px-4 py-2 rounded-md hover:bg-kallsjon-lt-green"
              }
              end
            >
              Hem
            </NavLink>
            <NavLink 
              to="/experiments" 
              className={({ isActive }: { isActive: boolean }) => 
                isActive 
                  ? "bg-white text-kallsjon-green px-4 py-2 rounded-md" 
                  : "text-white px-4 py-2 rounded-md hover:bg-kallsjon-green"
              }
            >
              Experiments
            </NavLink>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/experiments" element={<Experiments />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;