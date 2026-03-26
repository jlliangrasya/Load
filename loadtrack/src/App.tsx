import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import BottomNav from './components/layout/BottomNav';
import Dashboard from './pages/Dashboard';
import Capital from './pages/Capital';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Disburse from './pages/Disburse';
import Payments from './pages/Payments';
import UnpaidList from './pages/UnpaidList';
import History from './pages/History';
import Reports from './pages/Reports';
import MapPage from './pages/Map';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import { seedDatabase } from './db/seed';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading LoadTrack...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="max-w-[430px] mx-auto min-h-screen bg-gray-50 relative">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/capital" element={<Capital />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/disburse" element={<Disburse />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/unpaid" element={<UnpaidList />} />
          <Route path="/history" element={<History />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <BottomNav />
      </div>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: { fontSize: '14px', borderRadius: '12px' },
        }}
      />
    </BrowserRouter>
  );
}
