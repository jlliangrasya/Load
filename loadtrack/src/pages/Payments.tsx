import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Wallet, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { usePayments } from '../hooks/usePayments';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import SignaturePad from '../components/signature/SignaturePad';
import toast from 'react-hot-toast';

export default function Payments() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addPayment } = usePayments();

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), []);

  const [clientId, setClientId] = useState(searchParams.get('client') ?? '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'gcash' | 'online_transfer'>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showSignature, setShowSignature] = useState(false);

  const selectedClient = clients?.find(c => c.id === clientId);
  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  const handleProceedToSignature = () => {
    if (!clientId) { toast.error('Please select a client'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Please enter a valid amount'); return; }
    if ((method === 'gcash' || method === 'online_transfer') && !referenceNumber.trim()) {
      toast.error('Please enter a reference number');
      return;
    }
    setShowSignature(true);
  };

  const handleSignatureConfirm = async (signatureDataUrl: string) => {
    const amt = parseFloat(amount);
    await addPayment({
      client_id: clientId,
      date,
      amount: amt,
      method,
      reference_number: (method !== 'cash' && referenceNumber.trim()) ? referenceNumber.trim() : undefined,
      signature_image: signatureDataUrl,
      notes: notes.trim() || undefined,
    });
    toast.success('Payment recorded!');
    setShowSignature(false);
    navigate('/');
  };

  if (showSignature) {
    return (
      <SignaturePad
        onConfirm={handleSignatureConfirm}
        onCancel={() => setShowSignature(false)}
      />
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
        </div>

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
