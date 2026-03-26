import { useState } from 'react';
import { Plus, Trash2, Package } from 'lucide-react';
import { useCapital } from '../hooks/useCapital';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';

export default function Capital() {
  const { capitals, addCapital, deleteCapital, smartBalance, globeBalance } = useCapital();
  const [showForm, setShowForm] = useState(false);
  const [network, setNetwork] = useState<'smart' | 'globe'>('smart');
  const [faceValue, setFaceValue] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const commission = (parseFloat(faceValue) || 0) - (parseFloat(costPrice) || 0);

  const resetForm = () => {
    setFaceValue('');
    setCostPrice('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const fv = parseFloat(faceValue);
    const cp = parseFloat(costPrice);
    if (!fv || fv <= 0) { toast.error('Please enter a valid face value'); return; }
    if (!cp || cp <= 0) { toast.error('Please enter a valid cost price'); return; }
    if (cp >= fv) { toast.error('Cost price should be less than face value'); return; }

    await addCapital({ network, face_value: fv, cost_price: cp, date, notes: notes || undefined });
    toast.success('Capital purchase added!');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteCapital(id);
    setConfirmDelete(null);
    toast.success('Capital purchase deleted');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Capital" showBack />

      <div className="p-4 space-y-4">
        {/* Balance Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-600 uppercase">Smart Balance</p>
            <p className="text-xl font-bold text-blue-700">{formatPeso(smartBalance)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs font-medium text-red-600 uppercase">Globe Balance</p>
            <p className="text-xl font-bold text-red-700">{formatPeso(globeBalance)}</p>
          </div>
        </div>

        {/* Add Button / Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
          >
            <Plus size={18} /> Add Capital Purchase
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Add Capital Purchase</h3>

            {/* Network Toggle */}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Face Value (₱)</label>
              <input
                type="number"
                inputMode="decimal"
                value={faceValue}
                onChange={e => setFaceValue(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price (₱)</label>
              <input
                type="number"
                inputMode="decimal"
                value={costPrice}
                onChange={e => setCostPrice(e.target.value)}
                placeholder="e.g. 950"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {(faceValue || costPrice) && (
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-xs text-green-600 font-medium">Commission Earned</p>
                <p className="text-lg font-bold text-green-700">{formatPeso(commission)}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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

            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Capital List */}
        {capitals.length === 0 ? (
          <EmptyState
            icon={<Package size={48} />}
            title="No capital purchases yet"
            description="Tap the button above to record your first load purchase."
          />
        ) : (
          <div className="space-y-3">
            {capitals.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <NetworkBadge network={c.network} />
                    <span className="text-xs text-gray-500">{c.date}</span>
                  </div>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="p-1 text-gray-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Face Value</p>
                    <p className="text-sm font-semibold">{formatPeso(c.face_value)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Cost</p>
                    <p className="text-sm font-semibold">{formatPeso(c.cost_price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Commission</p>
                    <p className="text-sm font-semibold text-green-600">{formatPeso(c.commission)}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Remaining Balance</p>
                  <p className={`text-sm font-bold ${c.remaining_balance < 500 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatPeso(c.remaining_balance)}
                  </p>
                </div>
                {c.notes && <p className="text-xs text-gray-400 mt-1">{c.notes}</p>}

                {/* Delete Confirmation */}
                {confirmDelete === c.id && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
