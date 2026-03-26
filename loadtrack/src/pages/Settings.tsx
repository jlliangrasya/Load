import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, Trash2, FileSpreadsheet, Download, Upload, Clock } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { db } from '../db/database';
import { exportClientsXlsx } from '../utils/exportXlsx';
import { exportBackup, importBackup, downloadBackup } from '../utils/backup';
import PageHeader from '../components/layout/PageHeader';
import toast from 'react-hot-toast';

export default function Settings() {
  const settings = useLiveQuery(() => db.app_settings.get(1), []);
  const commissionLogs = useLiveQuery(() => db.commission_logs.orderBy('created_at').reverse().toArray(), []);

  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [smartMarkup, setSmartMarkup] = useState('');
  const [globeMarkup, setGlobeMarkup] = useState('');
  const [autoMarkup, setAutoMarkup] = useState(true);
  const [discountEnabled, setDiscountEnabled] = useState(true);
  const [discountRates, setDiscountRates] = useState('2,3,5');
  const [hideSellingIfEqual, setHideSellingIfEqual] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setOwnerName(settings.owner_name);
      setBusinessName(settings.business_name);
      setSmartMarkup(String(settings.default_smart_markup));
      setGlobeMarkup(String(settings.default_globe_markup));
      setAutoMarkup(settings.auto_markup_enabled !== 0);
      setDiscountEnabled(settings.discount_enabled !== 0);
      setDiscountRates(settings.discount_rates ?? '2,3,5');
      setHideSellingIfEqual(settings.hide_selling_if_equal === 1);
    }
  }, [settings]);

  const handleSave = async () => {
    const sm = parseFloat(smartMarkup);
    const gm = parseFloat(globeMarkup);
    if (autoMarkup && (isNaN(sm) || sm < 0)) { toast.error('Enter a valid Smart markup'); return; }
    if (autoMarkup && (isNaN(gm) || gm < 0)) { toast.error('Enter a valid Globe markup'); return; }
    if (!businessName.trim()) { toast.error('Business name is required'); return; }

    // Log commission rate changes
    if (settings && autoMarkup) {
      if (sm !== settings.default_smart_markup) {
        await db.commission_logs.add({
          id: uuid(),
          date: new Date().toISOString().split('T')[0],
          network: 'smart',
          old_rate: settings.default_smart_markup,
          new_rate: sm,
          notes: `Smart markup changed from ₱${settings.default_smart_markup} to ₱${sm}`,
          created_at: new Date().toISOString(),
        });
      }
      if (gm !== settings.default_globe_markup) {
        await db.commission_logs.add({
          id: uuid(),
          date: new Date().toISOString().split('T')[0],
          network: 'globe',
          old_rate: settings.default_globe_markup,
          new_rate: gm,
          notes: `Globe markup changed from ₱${settings.default_globe_markup} to ₱${gm}`,
          created_at: new Date().toISOString(),
        });
      }
    }

    await db.app_settings.put({
      id: 1,
      owner_name: ownerName.trim(),
      business_name: businessName.trim(),
      default_smart_markup: isNaN(sm) ? 0 : sm,
      default_globe_markup: isNaN(gm) ? 0 : gm,
      auto_markup_enabled: autoMarkup ? 1 : 0,
      discount_enabled: discountEnabled ? 1 : 0,
      discount_rates: discountRates.trim() || '2,3,5',
      hide_selling_if_equal: hideSellingIfEqual ? 1 : 0,
    });
    toast.success('Settings saved!');
  };

  const handleClearData = async () => {
    await db.capital_purchases.clear();
    await db.clients.clear();
    await db.disbursements.clear();
    await db.payments.clear();
    await db.collection_list.clear();
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Auto Markup</h3>
            <button
              onClick={() => setAutoMarkup(!autoMarkup)}
              className={`relative w-12 h-7 rounded-full transition-colors ${autoMarkup ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${autoMarkup ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {autoMarkup
              ? 'Markup is auto-added to selling price when disbursing load.'
              : 'Markup is disabled. Selling price will default to face value.'}
          </p>

          {autoMarkup && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-blue-600 mb-1">Smart Markup (₱)</label>
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
                <label className="block text-xs font-medium text-red-600 mb-1">Globe Markup (₱)</label>
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
          )}
        </div>

        {/* Discount Suggestions (Capital Page) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Discount Suggestions</h3>
            <button
              onClick={() => setDiscountEnabled(!discountEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors ${discountEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${discountEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {discountEnabled
              ? 'Quick discount buttons shown when adding capital purchases.'
              : 'Discount suggestions are hidden on the Capital page.'}
          </p>
          {discountEnabled && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Rates (%, comma-separated)</label>
              <input
                type="text"
                value={discountRates}
                onChange={e => setDiscountRates(e.target.value)}
                placeholder="e.g. 2,3,5"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Preview: {discountRates.split(',').filter(r => r.trim()).map(r => `${r.trim()}%`).join(', ')}
              </p>
            </div>
          )}
        </div>

        {/* Selling Price Display */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Selling Price</h3>
            <button
              onClick={() => setHideSellingIfEqual(!hideSellingIfEqual)}
              className={`relative w-12 h-7 rounded-full transition-colors ${hideSellingIfEqual ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${hideSellingIfEqual ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {hideSellingIfEqual
              ? 'When face value = selling price (no markup), the selling price field is hidden to reduce clutter.'
              : 'Both face value and selling price are always shown when disbursing.'}
          </p>
        </div>

        {/* Commission Rate History */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Commission Rate History</h3>
          </div>
          {!commissionLogs || commissionLogs.length === 0 ? (
            <p className="text-xs text-gray-400">No rate changes recorded yet</p>
          ) : (
            <div>
              {commissionLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${log.network === 'smart' ? 'text-blue-600' : 'text-red-600'}`}>
                        {log.network === 'smart' ? 'Smart' : 'Globe'}
                      </span>
                      <span className="text-xs text-gray-500">{log.date}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">₱{log.old_rate} → ₱{log.new_rate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Backup & Restore */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Backup & Restore</h3>
          <p className="text-xs text-gray-500">Save all your data to a file or restore from a previous backup.</p>

          <button
            onClick={async () => {
              try {
                const json = await exportBackup();
                downloadBackup(json);
                toast.success('Backup downloaded!');
              } catch { toast.error('Backup failed'); }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white font-medium text-sm active:bg-blue-700"
          >
            <Download size={16} /> Download Backup (.json)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                await importBackup(text);
                toast.success('Backup restored! Refreshing...');
                setTimeout(() => window.location.reload(), 1000);
              } catch {
                toast.error('Invalid backup file');
              }
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm"
          >
            <Upload size={16} /> Restore from Backup
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

        <div className="text-center text-xs text-gray-400 py-4">
          <p className="font-medium">LoadTrack v1.0</p>
          <p>Offline-first load distribution tracker</p>
        </div>
      </div>
    </div>
  );
}
