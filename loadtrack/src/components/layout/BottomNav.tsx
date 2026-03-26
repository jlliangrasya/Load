import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, SendHorizonal, Wallet, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

const mainTabs = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/clients', icon: Users, label: 'Clients' },
  { path: '/disburse', icon: SendHorizonal, label: 'Disburse' },
  { path: '/payments', icon: Wallet, label: 'Payments' },
];

const moreTabs = [
  { path: '/capital', label: 'Capital' },
  { path: '/unpaid', label: 'Unpaid' },
  { path: '/history', label: 'History' },
  { path: '/reports', label: 'Reports' },
  { path: '/map', label: 'Map' },
  { path: '/settings', label: 'Settings' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreTabs.some(t => location.pathname === t.path);

  return (
    <>
      {showMore && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div className="fixed bottom-16 right-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[160px]">
          {moreTabs.map(tab => (
            <button
              key={tab.path}
              onClick={() => { navigate(tab.path); setShowMore(false); }}
              className={`w-full text-left px-4 py-3 text-sm font-medium ${
                location.pathname === tab.path ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

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
