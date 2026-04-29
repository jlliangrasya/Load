import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, FileSpreadsheet, Download, Upload, Clock, Smartphone, Lock, Moon, Sun, Cloud } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useDarkMode } from '../contexts/DarkModeContext';
import { useGoogleDrive } from '../contexts/GoogleDriveContext';
import { v4 as uuid } from 'uuid';
import { getSettingsWithDefaults, updateSettings } from '../db/database';
import { supabase } from '../lib/supabase';
import { exportClientsXlsx } from '../utils/exportXlsx';
import { exportBackup, importBackup, downloadBackup } from '../utils/backup';
import { formatDate } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getSettingsWithDefaults>> | null>(null);
  const [commissionLogs, setCommissionLogs] = useState<{ id: string; date: string; network: string; old_rate: number; new_rate: number }[]>([]);

  useEffect(() => {
    getSettingsWithDefaults().then(setSettings);
    supabase.from('commission_logs').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setCommissionLogs(data);
    });
  }, []);

  const [ownerName, setOwnerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [smartMarkup, setSmartMarkup] = useState('');
  const [globeMarkup, setGlobeMarkup] = useState('');
  const [discountRates, setDiscountRates] = useState('2,3,5');
  const [confirmClear, setConfirmClear] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const { signedIn, userEmail, loading: gdriveLoading, signIn: gdriveSignIn, signOut: gdriveSignOut } = useGoogleDrive();

  // Load text fields from DB
  useEffect(() => {
    if (settings) {
      setOwnerName(settings.owner_name);
      setBusinessName(settings.business_name);
      setSmartMarkup(String(settings.default_smart_markup));
      setGlobeMarkup(String(settings.default_globe_markup));
      setDiscountRates(settings.discount_rates ?? '2,3,5');
    }
  }, [settings]);

  // Instant toggle — writes to DB immediately
  const toggle = async (field: string, currentValue: number) => {
    if (!settings) return;
    const newVal = currentValue ? 0 : 1;
    await updateSettings({ [field]: newVal } as Parameters<typeof updateSettings>[0]);
    setSettings(s => s ? { ...s, [field]: newVal } : s);
  };

  // Save text/number fields
  const handleSave = async () => {
    const sm = parseFloat(smartMarkup);
    const gm = parseFloat(globeMarkup);
    if (settings?.auto_markup_enabled && (isNaN(sm) || sm < 0)) { toast.error('Enter a valid Smart markup'); return; }
    if (settings?.auto_markup_enabled && (isNaN(gm) || gm < 0)) { toast.error('Enter a valid Globe markup'); return; }
    if (!businessName.trim()) { toast.error('Business name is required'); return; }

    // Log commission rate changes
    if (settings && settings.auto_markup_enabled) {
      if (sm !== settings.default_smart_markup) {
        await supabase.from('commission_logs').insert({
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
        await supabase.from('commission_logs').insert({
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

    const patch = {
      owner_name: ownerName.trim(),
      business_name: businessName.trim(),
      default_smart_markup: isNaN(sm) ? 0 : sm,
      default_globe_markup: isNaN(gm) ? 0 : gm,
      discount_rates: discountRates.trim() || '2,3,5',
    };
    await updateSettings(patch);
    setSettings(s => s ? { ...s, ...patch } : s);
    toast.success('Settings saved!');
  };

  const handleClearData = async () => {
    await Promise.all([
      supabase.from('disbursements').delete().neq('id', ''),
      supabase.from('payments').delete().neq('id', ''),
      supabase.from('collection_list').delete().neq('id', ''),
    ]);
    await Promise.all([
      supabase.from('clients').delete().neq('id', ''),
      supabase.from('capital_purchases').delete().neq('id', ''),
    ]);
    setConfirmClear(false);
    toast.success('All data has been cleared.');
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

  // Read live toggle values directly from settings (DB is source of truth)
  const autoMarkup = settings.auto_markup_enabled !== 0;
  const discountEnabled = settings.discount_enabled !== 0;
  const showSellingPrice = settings.hide_selling_if_equal !== 1;

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

        {/* Dark Mode */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {darkMode ? <Moon size={14} className="text-gray-500" /> : <Sun size={14} className="text-gray-500" />}
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Dark Mode</h3>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-7 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {darkMode ? 'Dark theme is active. Resets to light mode on next session.' : 'Switch to dark theme for low-light use.'}
          </p>
        </div>

        {/* Google Drive — Signature Backup */}
        <div className={`rounded-xl border p-4 space-y-4 ${signedIn ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2.5">
            {signedIn ? <Cloud size={18} className="text-green-600" /> : <Cloud size={18} className="text-gray-400" />}
            <h3 className="text-sm font-bold text-gray-800">Signature Backup</h3>
          </div>

          {signedIn ? (
            <div className="space-y-3">
              <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Cloud size={20} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700">Connected to Google Drive</p>
                  <p className="text-xs text-gray-500 mt-0.5">{userEmail}</p>
                </div>
              </div>
              <div className="bg-white/70 rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-600 leading-relaxed">
                  All client signatures are now <span className="font-semibold">automatically saved</span> to your Google Drive. You can find them in the folder: <span className="font-semibold">LoadTrack &gt; Signatures</span>
                </p>
              </div>
              <button
                onClick={gdriveSignOut}
                className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-500 text-xs font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                Save all client signatures to your Google Drive so they're <span className="font-semibold">safe and backed up</span>. You only need to connect once.
              </p>
              <button
                onClick={gdriveSignIn}
                disabled={gdriveLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm active:bg-gray-50 disabled:opacity-50 shadow-sm"
              >
                {gdriveLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    <span>Sign in with Google</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                This will only access files created by LoadTrack. Your other Google Drive files are not touched.
              </p>
            </div>
          )}
        </div>

        {/* Auto Markup — toggle saves instantly */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Auto Markup</h3>
            <button
              onClick={() => toggle('auto_markup_enabled', settings.auto_markup_enabled)}
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

        {/* Discount Suggestions — toggle saves instantly */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Discount Suggestions</h3>
            <button
              onClick={() => toggle('discount_enabled', settings.discount_enabled)}
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

        {/* Selling Price — toggle saves instantly */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Selling Price</h3>
            <button
              onClick={() => toggle('hide_selling_if_equal', settings.hide_selling_if_equal)}
              className={`relative w-12 h-7 rounded-full transition-colors ${showSellingPrice ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${showSellingPrice ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {showSellingPrice
              ? 'Both face value and selling price fields are shown when disbursing.'
              : 'Selling price is hidden when it equals face value (no markup). Less clutter.'}
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
                      <span className="text-xs text-gray-500">{formatDate(log.date)}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">₱{log.old_rate} → ₱{log.new_rate}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button — for text/number fields only */}
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

        {/* Change PIN */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Change PIN</h3>
          </div>
          <p className="text-xs text-gray-500">Change the 4-digit PIN used to unlock the app.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter current PIN"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter new 4-digit PIN"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Re-enter new PIN"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={async () => {
                if (!settings) return;
                const savedPin = settings.pin || '0000';
                if (currentPin !== savedPin) { toast.error('Current PIN is incorrect'); return; }
                if (newPin.length !== 4) { toast.error('New PIN must be 4 digits'); return; }
                if (newPin !== confirmPin) { toast.error('New PINs do not match'); return; }
                await updateSettings({ pin: newPin });
                setCurrentPin('');
                setNewPin('');
                setConfirmPin('');
                toast.success('PIN changed successfully!');
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-600 text-blue-600 font-semibold text-sm active:bg-blue-50"
            >
              <Lock size={16} /> Update PIN
            </button>
          </div>
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

        {/* Install App */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Download App</h3>
          </div>
          {isInstalled ? (
            <p className="text-xs text-green-600 font-medium">LoadTrack is already installed on this device.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500">Install LoadTrack on your phone for quick access and an app-like experience — no app store needed.</p>
              {canInstall ? (
                <button
                  onClick={async () => {
                    const accepted = await install();
                    if (accepted) toast.success('App installed!');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm active:bg-green-700"
                >
                  <Smartphone size={16} /> Install LoadTrack
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">Android (Chrome)</p>
                    <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                      <li>Tap the <span className="font-semibold">3-dot menu</span> (top right)</li>
                      <li>Tap <span className="font-semibold">"Add to Home screen"</span> or <span className="font-semibold">"Install app"</span></li>
                      <li>Tap <span className="font-semibold">Install</span></li>
                    </ol>
                  </div>
                  <div className="bg-gray-100 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">iPhone (Safari)</p>
                    <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Tap the <span className="font-semibold">Share</span> button (bottom center)</li>
                      <li>Scroll down and tap <span className="font-semibold">"Add to Home Screen"</span></li>
                      <li>Tap <span className="font-semibold">Add</span></li>
                    </ol>
                  </div>
                </div>
              )}
            </>
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
