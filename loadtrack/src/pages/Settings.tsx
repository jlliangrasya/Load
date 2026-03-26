import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, Trash2, FileSpreadsheet } from 'lucide-react';
import { db } from '../db/database';
import { exportClientsXlsx } from '../utils/exportXlsx';
import PageHeader from '../components/layout/PageHeader';
import toast from 'react-hot-toast';

export default function Settings() {
  const settings = useLiveQuery(() => db.app_settings.get(1), []);

  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [smartMarkup, setSmartMarkup] = useState('');
  const [globeMarkup, setGlobeMarkup] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (settings) {
      setOwnerName(settings.owner_name);
      setBusinessName(settings.business_name);
      setSmartMarkup(String(settings.default_smart_markup));
      setGlobeMarkup(String(settings.default_globe_markup));
    }
  }, [settings]);

  const handleSave = async () => {
    const sm = parseFloat(smartMarkup);
    const gm = parseFloat(globeMarkup);
    if (isNaN(sm) || sm < 0) { toast.error('Enter a valid Smart markup'); return; }
    if (isNaN(gm) || gm < 0) { toast.error('Enter a valid Globe markup'); return; }
    if (!businessName.trim()) { toast.error('Business name is required'); return; }

    await db.app_settings.put({
      id: 1,
      owner_name: ownerName.trim(),
      business_name: businessName.trim(),
      default_smart_markup: sm,
      default_globe_markup: gm,
    });
    toast.success('Settings saved!');
  };

  const handleClearData = async () => {
    await db.capital_purchases.clear();
    await db.clients.clear();
    await db.disbursements.clear();
    await db.payments.clear();
    setConfirmClear(false);
    toast.success('All data cleared. Refresh to re-seed sample data.');
  };

  const handleExportClients = async () => {
    try {
      await exportClientsXlsx();
      toast.success('Clients exported!');
    } catch {
      toast.error('Export failed');
    }
  };

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Settings" showBack />
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Settings" showBack />

      <div className="p-4 space-y-4">
        {/* Business Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Business Info</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Your business name"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
            <input
              type="text"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Default Markup */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Default Markup (₱)</h3>
          <p className="text-xs text-gray-500">Auto-added to selling price when disbursing load.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">Smart Markup</label>
              <input
                type="number"
                inputMode="decimal"
                value={smartMarkup}
                onChange={e => setSmartMarkup(e.target.value)}
                placeholder="e.g. 2"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-red-600 mb-1">Globe Markup</label>
              <input
                type="number"
                inputMode="decimal"
                value={globeMarkup}
                onChange={e => setGlobeMarkup(e.target.value)}
                placeholder="e.g. 2"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
        >
          <Save size={16} /> Save Settings
        </button>

        {/* Export Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Export Data</h3>

          <button
            onClick={handleExportClients}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm"
          >
            <FileSpreadsheet size={16} /> Export All Clients (.xlsx)
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-red-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Danger Zone</h3>

          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-300 text-red-600 font-medium text-sm"
            >
              <Trash2 size={16} /> Clear All Data
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-600 text-center font-medium">
                This will permanently delete all clients, transactions, and capital records. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearData}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm active:bg-red-700"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="text-center text-xs text-gray-400 py-4">
          <p className="font-medium">LoadTrack v1.0</p>
          <p>Offline-first load distribution tracker</p>
        </div>
      </div>
    </div>
  );
}
