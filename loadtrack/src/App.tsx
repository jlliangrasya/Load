import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState, useCallback } from 'react';
import BottomNav from './components/layout/BottomNav';
import PinLock from './components/PinLock';
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
import Collect from './pages/Collect';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import { getSettingsWithDefaults } from './db/database';
import { migrateFromDexieIfNeeded } from './utils/migrateFromDexie';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { GoogleDriveProvider } from './contexts/GoogleDriveContext';

export default function App() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('0000');
  const [migratingMsg, setMigratingMsg] = useState('');

  useEffect(() => {
    async function init() {
      await migrateFromDexieIfNeeded(msg => setMigratingMsg(msg));
      const s = await getSettingsWithDefaults();
      setPin(s.pin || '0000');
      setReady(true);
    }
    init();
  }, []);

  const handleUnlock = useCallback(() => setUnlocked(true), []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">{migratingMsg || 'Loading LoadTrack...'}</p>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <DarkModeProvider>
        <PinLock correctPin={pin} onUnlock={handleUnlock} />
      </DarkModeProvider>
    );
  }

  return (
    <DarkModeProvider>
      <GoogleDriveProvider>
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
            <Route path="/collect" element={<Collect />} />
            <Route path="/expenses" element={<Expenses />} />
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
      </GoogleDriveProvider>
    </DarkModeProvider>
  );
}
