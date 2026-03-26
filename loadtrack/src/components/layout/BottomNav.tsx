import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, SendHorizonal, Wallet, MoreHorizontal, X,
  ArrowLeftRight, ShoppingCart, AlertCircle, Clock, BarChart3, MapPin, Settings,
} from 'lucide-react';
import { useState } from 'react';

const mainTabs = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clients', icon: Users, label: 'Clients' },
  { path: '/disburse', icon: SendHorizonal, label: 'Disburse' },
  { path: '/payments', icon: Wallet, label: 'Payments' },
];

const moreTabs = [
  { path: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { path: '/capital', label: 'Capital', icon: ShoppingCart },
  { path: '/unpaid', label: 'Unpaid', icon: AlertCircle },
  { path: '/history', label: 'History', icon: Clock },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/map', label: 'Map', icon: MapPin },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreTabs.some(t => location.pathname === t.path);

  return (
    <>
      {/* Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          showMore ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowMore(false)}
      />

      {/* Sidebar Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-64 bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          showMore ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-bold text-gray-900">Menu</h2>
          <button onClick={() => setShowMore(false)} className="p-1 text-gray-400 active:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="px-3 pb-4">
          {moreTabs.map(tab => {
            const Icon = tab.icon;
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => { navigate(tab.path); setShowMore(false); }}
                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 active:bg-gray-100'
                }`}
              >
                <Icon size={20} className={active ? 'text-blue-600' : 'text-gray-400'} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="absolute bottom-6 left-0 right-0 px-5">
          <p className="text-[10px] text-gray-400 text-center">LoadTrack v1.0</p>
        </div>
      </div>

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200">
        <div className="max-w-[430px] mx-auto flex">
          {mainTabs.map(tab => {
            const Icon = tab.icon;
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex-1 flex flex-col items-center py-2 pt-3 min-h-[56px] ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`flex-1 flex flex-col items-center py-2 pt-3 min-h-[56px] ${
              isMoreActive || showMore ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <MoreHorizontal size={22} />
            <span className="text-[10px] mt-1 font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
