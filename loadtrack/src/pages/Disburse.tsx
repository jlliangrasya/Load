import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SendHorizonal, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';
import { db } from '../db/database';
import { useDisbursements } from '../hooks/useDisbursements';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import SignaturePad from '../components/signature/SignaturePad';
import toast from 'react-hot-toast';
import QuickAmounts from '../components/shared/QuickAmounts';
import RecentClients from '../components/shared/RecentClients';

type PaymentStatus = 'not_yet' | 'paid';
type PayMethod = 'cash' | 'gcash' | 'online_transfer';

export default function Disburse() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addDisbursement } = useDisbursements();

  const clients = useLiveQuery(() => db.clients.orderBy('name').toArray(), []);
  const settings = useLiveQuery(() => db.app_settings.get(1), []);

  const [clientId, setClientId] = useState(searchParams.get('client') ?? '');
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [network, setNetwork] = useState<'smart' | 'globe'>('smart');
  const [faceValue, setFaceValue] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [manualSellingPrice, setManualSellingPrice] = useState(false);
  const [status, setStatus] = useState<'success' | 'failed' | 'returned'>('success');
  const [failureReason, setFailureReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Payment inline fields
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('not_yet');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [showSignature, setShowSignature] = useState(false);

  const availableBatch = useLiveQuery(
    () => db.capital_purchases
      .where('network').equals(network)
      .toArray()
      .then(batches => batches
        .filter(b => b.remaining_balance > 0)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
      ),
    [network]
  );

  // Auto-fill selling price from face value + markup (only if user hasn't manually edited)
  useEffect(() => {
    if (manualSellingPrice) return;
    const fv = parseFloat(faceValue) || 0;
    if (fv > 0) {
      const autoEnabled = settings?.auto_markup_enabled !== 0;
      if (autoEnabled) {
        const defaultMarkup = network === 'smart'
          ? (settings?.default_smart_markup ?? 2)
          : (settings?.default_globe_markup ?? 2);
        setSellingPrice(String(fv + defaultMarkup));
      } else {
        setSellingPrice(String(fv));
      }
    }
  }, [faceValue, network, settings, manualSellingPrice]);

  const markup = (parseFloat(sellingPrice) || 0) - (parseFloat(faceValue) || 0);
  const hideSellingPrice = settings?.hide_selling_if_equal === 1 && faceValue && sellingPrice && faceValue === sellingPrice;
  const selectedClient = clients?.find(c => c.id === clientId);

  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  // Validate before submit/signature
  function validate(): boolean {
    if (!clientId) { toast.error('Please select a client'); return false; }
    const fv = parseFloat(faceValue);
    const sp = parseFloat(sellingPrice);
    if (!fv || fv <= 0) { toast.error('Please enter a valid face value'); return false; }
    if (!sp || sp <= 0) { toast.error('Please enter a valid selling price'); return false; }
    if (sp < fv) { toast.error('Selling price should not be less than face value (negative markup)'); return false; }
    if (!availableBatch) { toast.error(`No available ${network} capital batch`); return false; }

    if (status === 'success' && fv > availableBatch.remaining_balance) {
      toast.error(`Not enough balance in ${network} batch (${formatPeso(availableBatch.remaining_balance)} remaining)`);
      return false;
    }

    if ((status === 'failed' || status === 'returned') && !failureReason.trim()) {
      toast.error('Please enter a reason for the failure/return');
      return false;
    }

    if (status === 'success' && paymentStatus === 'paid') {
      if ((payMethod === 'gcash' || payMethod === 'online_transfer') && !referenceNumber.trim()) {
        toast.error('Please enter a reference number');
        return false;
      }
    }

    return true;
  }

  // Save disbursement + optional payment (all in transaction)
  async function saveDisbursement(signatureImage?: string) {
    try {
    const fv = parseFloat(faceValue);
    const sp = parseFloat(sellingPrice);

    await addDisbursement({
      client_id: clientId,
      date,
      network,
      face_value: fv,
      selling_price: sp,
      status,
      failure_reason: (status !== 'success' && failureReason.trim()) ? failureReason.trim() : undefined,
      capital_purchase_id: availableBatch!.id,
      notes: notes.trim() || undefined,
    });

    // If paid at time of disbursement, create payment in a transaction
    if (status === 'success' && paymentStatus === 'paid') {
      const now = new Date().toISOString();
      await db.transaction('rw', [db.payments, db.clients], async () => {
        await db.payments.add({
          id: uuid(),
          client_id: clientId,
          date,
          amount: sp,
          method: payMethod,
          reference_number: (payMethod !== 'cash' && referenceNumber.trim()) ? referenceNumber.trim() : undefined,
          signature_image: signatureImage ?? '',
          created_at: now,
        });
        await db.clients.where('id').equals(clientId).modify(c => {
          c.total_paid += sp;
          c.outstanding_balance = c.total_load_received - c.total_paid;
          c.updated_at = now;
        });
      });
    }

    const paidLabel = paymentStatus === 'paid' ? ' (Paid)' : '';
    toast.success(status === 'success' ? `Load disbursed!${paidLabel}` : `Disbursement recorded as ${status}`);
    navigate('/');
    } catch {
      toast.error('Failed to save. Please try again.');
    }
  }

  // Handle the main submit button
  const handleSubmit = () => {
    if (!validate()) return;

    // If paid with cash → need signature first
    if (status === 'success' && paymentStatus === 'paid' && payMethod === 'cash') {
      setShowSignature(true);
      return;
    }

    // Otherwise save directly
    saveDisbursement();
  };

  // Signature confirmed for cash payment
  const handleSignatureConfirm = (dataUrl: string) => {
    setShowSignature(false);
    saveDisbursement(dataUrl);
  };

  // Full-screen signature
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
      <PageHeader title="Disburse Load" />

      <div className="p-4 space-y-4">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          {selectedClient ? (
            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedClient.name}</p>
                <p className="text-xs text-gray-500">Balance: {formatPeso(selectedClient.outstanding_balance)}</p>
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
            {!selectedClient && !clientSearch && (
              <RecentClients onSelect={(id) => { setClientId(id); setShowClientDropdown(false); }} />
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
                      <span className="text-xs text-gray-500 ml-2">{c.contact_number}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            </>
          )}
        </div>

        {/* Network Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Network *</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            <button
              onClick={() => setNetwork('smart')}
              className={`flex-1 py-3 text-sm font-semibold ${
                network === 'smart' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
              }`}
            >
              Smart
            </button>
            <button
              onClick={() => setNetwork('globe')}
              className={`flex-1 py-3 text-sm font-semibold ${
                network === 'globe' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'
              }`}
            >
              Globe
            </button>
          </div>
        </div>

        {/* Capital Batch Info */}
        {availableBatch ? (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NetworkBadge network={network} />
                <span className="text-xs text-gray-500">Batch: {availableBatch.date}</span>
              </div>
              <p className="text-sm font-semibold">{formatPeso(availableBatch.remaining_balance)} left</p>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-sm text-red-600">No available {network} capital batch. Add capital first.</p>
          </div>
        )}

        {/* Face Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Face Value (₱) *</label>
          <input
            type="number"
            inputMode="decimal"
            value={faceValue}
            onChange={e => setFaceValue(e.target.value)}
            placeholder="Load amount"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          <QuickAmounts
            amounts={[100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000]}
            onSelect={(a) => { setFaceValue(String(a)); setManualSellingPrice(false); }}
            selected={parseFloat(faceValue) || undefined}
          />
        </div>

        {/* Selling Price — hidden when equal to face value if setting is on */}
        {!hideSellingPrice && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₱) *</label>
            <input
              type="number"
              inputMode="decimal"
              value={sellingPrice}
              onChange={e => { setSellingPrice(e.target.value); setManualSellingPrice(true); }}
              placeholder="What client pays"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {!hideSellingPrice && faceValue && sellingPrice && markup > 0 && (
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-600 font-medium">Markup</p>
            <p className="text-lg font-bold text-green-700">{formatPeso(markup)}</p>
          </div>
        )}

        {/* Disbursement Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Disbursement Status</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['success', 'failed', 'returned'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-3 text-xs font-semibold capitalize ${
                  status === s
                    ? s === 'success' ? 'bg-green-600 text-white'
                      : s === 'failed' ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Failure Reason */}
        {status !== 'success' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <input
              type="text"
              value={failureReason}
              onChange={e => setFailureReason(e.target.value)}
              placeholder="e.g. wrong number, network error"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Payment Status - only shown for successful disbursements */}
        {status === 'success' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">Payment</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              <button
                onClick={() => setPaymentStatus('not_yet')}
                className={`flex-1 py-3 text-sm font-semibold ${
                  paymentStatus === 'not_yet' ? 'bg-red-500 text-white' : 'bg-white text-gray-600'
                }`}
              >
                Not Yet Paid
              </button>
              <button
                onClick={() => setPaymentStatus('paid')}
                className={`flex-1 py-3 text-sm font-semibold ${
                  paymentStatus === 'paid' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                Paid
              </button>
            </div>

            {paymentStatus === 'paid' && (
              <>
                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-200">
                    {([
                      { key: 'cash' as const, label: 'Cash', color: 'bg-gray-600' },
                      { key: 'gcash' as const, label: 'GCash', color: 'bg-purple-600' },
                      { key: 'online_transfer' as const, label: 'Online', color: 'bg-teal-600' },
                    ]).map(m => (
                      <button
                        key={m.key}
                        onClick={() => setPayMethod(m.key)}
                        className={`flex-1 py-2.5 text-xs font-semibold ${
                          payMethod === m.key ? `${m.color} text-white` : 'bg-white text-gray-600'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference Number for GCash / Online */}
                {payMethod !== 'cash' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Reference Number *</label>
                    <input
                      type="text"
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}
                      placeholder="Transaction reference"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Cash info */}
                {payMethod === 'cash' && (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    A signature will be required on the next step to confirm cash payment.
                  </p>
                )}
              </>
            )}

            {paymentStatus === 'not_yet' && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                This will be added to the client's outstanding balance for collection later.
              </p>
            )}
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

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-semibold text-base active:bg-blue-700"
        >
          <SendHorizonal size={18} />
          {status === 'success'
            ? paymentStatus === 'paid' && payMethod === 'cash'
              ? 'Proceed to Signature'
              : paymentStatus === 'paid'
                ? 'Disburse & Record Payment'
                : 'Disburse Load'
            : `Record as ${status}`}
        </button>
      </div>
    </div>
  );
}
