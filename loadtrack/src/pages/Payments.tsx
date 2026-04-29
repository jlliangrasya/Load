import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Wallet, Search, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { usePayments } from '../hooks/usePayments';
import { supabase } from '../lib/supabase';
import { useSignatureUpload } from '../hooks/useSignatureUpload';
import { formatPeso, formatDate } from '../utils/currency';
import type { Disbursement } from '../types';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import QuickAmounts from '../components/shared/QuickAmounts';
import RecentClients from '../components/shared/RecentClients';
import SignaturePad from '../components/signature/SignaturePad';
import toast from 'react-hot-toast';

export default function Payments() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addPayment } = usePayments();
  const { processSignature, driveConnected } = useSignatureUpload();
  const [namePrompt, setNamePrompt] = useState(false);
  const [confirmedClientName, setConfirmedClientName] = useState('');

  const { clients } = useClients();

  const [clientId, setClientId] = useState(searchParams.get('client') ?? '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'gcash' | 'online_transfer'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDisbursementIds, setSelectedDisbursementIds] = useState<string[]>([]);
  const [clientDisbursements, setClientDisbursements] = useState<Disbursement[]>([]);
  const [showDisbursements, setShowDisbursements] = useState(false);

  const selectedClient = clients.find(c => c.id === clientId);
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Load unpaid disbursements when client changes
  useEffect(() => {
    if (!clientId) {
      setClientDisbursements([]);
      setSelectedDisbursementIds([]);
      setShowDisbursements(false);
      return;
    }
    supabase.from('disbursements').select('*').eq('client_id', clientId).eq('status', 'success').order('created_at', { ascending: false }).then(({ data }) => {
      setClientDisbursements(data ?? []);
    });
    setSelectedDisbursementIds([]);
  }, [clientId]);

  // Auto-fill amount from selected disbursements
  useEffect(() => {
    if (selectedDisbursementIds.length > 0) {
      const total = clientDisbursements
        .filter(d => selectedDisbursementIds.includes(d.id))
        .reduce((s, d) => s + d.selling_price, 0);
      setAmount(String(total));
    }
  }, [selectedDisbursementIds, clientDisbursements]);

  const toggleDisbursement = (id: string) => {
    setSelectedDisbursementIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleProceedToSignature = () => {
    if (!clientId) { toast.error('Please select a client'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Please enter a valid amount'); return; }
    if (selectedClient && amt > selectedClient.outstanding_balance && selectedClient.outstanding_balance > 0) {
      toast.error(`Amount exceeds outstanding balance (${formatPeso(selectedClient.outstanding_balance)})`);
      return;
    }
    if ((method === 'gcash' || method === 'online_transfer') && !referenceNumber.trim()) {
      toast.error('Please enter a reference number');
      return;
    }
    if (!driveConnected) {
      setConfirmedClientName('');
      setNamePrompt(true);
      return;
    }
    setShowSignature(true);
  };

  const handleNamePromptConfirm = () => {
    if (!confirmedClientName.trim()) return;
    setNamePrompt(false);
    setShowSignature(true);
  };

  const handleSignatureConfirm = async (signatureDataUrl: string) => {
    setSaving(true);
    try {
      const amt = parseFloat(amount);
      const nameForSig = driveConnected ? (selectedClient?.name ?? 'unknown') : confirmedClientName;
      const signatureRef = await processSignature(signatureDataUrl, nameForSig, 'payment');
      await addPayment({
        client_id: clientId,
        date,
        amount: amt,
        method,
        reference_number: (method !== 'cash' && referenceNumber.trim()) ? referenceNumber.trim() : undefined,
        signature_image: signatureRef,
        disbursement_ids: selectedDisbursementIds.length > 0 ? selectedDisbursementIds : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(driveConnected ? 'Payment saved! Signature backed up to Drive.' : 'Payment saved!');
      setShowSignature(false);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'OFFLINE') {
        toast.error('No internet connection. Please try again when online.');
      } else {
        toast.error('Failed to save payment. Please try again.');
      }
      setShowSignature(false);
    } finally {
      setSaving(false);
    }
  };

  // Name prompt when Drive is not connected
  if (namePrompt) {
    const clientDisplayName = selectedClient?.name ?? 'the client';
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Google Drive not connected</p>
            <h2 className="text-base font-bold text-gray-900">Confirm Client Name</h2>
            <p className="text-sm text-gray-500 mt-1">
              Ask <span className="font-semibold">{clientDisplayName}</span> to type their full name to proceed.
            </p>
          </div>
          <input
            type="text"
            autoFocus
            value={confirmedClientName}
            onChange={e => setConfirmedClientName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleNamePromptConfirm(); }}
            placeholder="Client's full name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setNamePrompt(false)}
              className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              disabled={!confirmedClientName.trim()}
              onClick={handleNamePromptConfirm}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSignature) {
    const sigClientName = driveConnected ? selectedClient?.name : confirmedClientName;
    return (
      <>
        <SignaturePad
          onConfirm={handleSignatureConfirm}
          onCancel={() => setShowSignature(false)}
          clientName={sigClientName}
          amount={amount ? formatPeso(parseFloat(amount)) : undefined}
        />
        {saving && (
          <div className="fixed inset-0 z-[100] bg-white/90 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-semibold text-gray-800">Saving payment...</p>
            <p className="text-sm text-gray-500">Please wait, don't close the app</p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Record Payment" />

      <div className="p-4 space-y-4">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          {selectedClient ? (
            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedClient.name}</p>
                <p className="text-xs text-gray-500">
                  Balance: <span className={selectedClient.outstanding_balance > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {formatPeso(selectedClient.outstanding_balance)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => { setClientId(''); setClientSearch(''); }}
                className="text-xs text-blue-600 font-medium"
              >
                Change
              </button>
            </div>
          ) : (
            <>
            {!clientSearch && (
              <RecentClients onSelect={(id) => { setClientId(id); setShowClientDropdown(false); setClientSearch(''); }} />
            )}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Search client..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 max-h-48 overflow-y-auto shadow-lg">
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setClientId(c.id); setShowClientDropdown(false); setClientSearch(''); }}
                      className="w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{c.name}</span>
                      <span className={`text-xs ml-2 ${c.outstanding_balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatPeso(c.outstanding_balance)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱) *</label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Payment amount"
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {selectedClient && selectedClient.outstanding_balance > 0 && (
              <button
                onClick={() => setAmount(String(selectedClient.outstanding_balance))}
                className="px-4 py-3 rounded-xl bg-green-50 text-green-700 text-xs font-medium whitespace-nowrap"
              >
                Full: {formatPeso(selectedClient.outstanding_balance)}
              </button>
            )}
          </div>
          <QuickAmounts
            amounts={[100, 200, 500, 1000, 1500, 2000, 3000, 5000]}
            onSelect={(a) => setAmount(String(a))}
            selected={parseFloat(amount) || undefined}
          />
        </div>

        {/* Link to specific loads */}
        {selectedClient && selectedClient.outstanding_balance > 0 && clientDisbursements.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDisbursements(!showDisbursements)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700"
            >
              <span>Link to specific load(s) (optional)</span>
              {showDisbursements ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showDisbursements && (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {clientDisbursements.map(d => {
                  const isSelected = selectedDisbursementIds.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDisbursement(d.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isSelected ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{formatDate(d.date)}</span>
                          <NetworkBadge network={d.network} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{formatPeso(d.selling_price)}</p>
                      </div>
                    </button>
                  );
                })}
                {selectedDisbursementIds.length > 0 && (
                  <div className="px-4 py-2 bg-blue-50 flex items-center justify-between">
                    <span className="text-xs text-blue-700 font-medium">
                      {selectedDisbursementIds.length} load(s) selected
                    </span>
                    <span className="text-sm font-bold text-blue-800">
                      {formatPeso(
                        clientDisbursements
                          .filter(d => selectedDisbursementIds.includes(d.id))
                          .reduce((s, d) => s + d.selling_price, 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {([
              { key: 'cash' as const, label: 'Cash', color: 'bg-gray-600' },
              { key: 'gcash' as const, label: 'GCash', color: 'bg-purple-600' },
              { key: 'online_transfer' as const, label: 'Online', color: 'bg-teal-600' },
            ]).map(m => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                className={`flex-1 py-3 text-xs font-semibold ${
                  method === m.key ? `${m.color} text-white` : 'bg-white text-gray-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Reference Number */}
        {method !== 'cash' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number *</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              placeholder="Transaction reference"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Proceed to Signature */}
        <button
          onClick={handleProceedToSignature}
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl font-semibold text-base active:bg-green-700"
        >
          <Wallet size={18} /> Proceed to Signature
        </button>
      </div>
    </div>
  );
}
