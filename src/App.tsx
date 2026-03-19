import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VistaConductor from './pages/VistaConductor';
import DashboardAdmin from './pages/DashboardAdmin';
import GeneradorQR from './pages/GeneradorQR';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/v/:id" element={<VistaConductor />} />
        <Route path="/admin" element={<DashboardAdmin />} />
        <Route path="/" element={<GeneradorQR />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;