import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Plus, Trash2, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import { useExpenses } from '../hooks/useExpenses';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';

const CATEGORIES = ['Transport', 'Fees', 'Supplies', 'Food', 'Commission', 'Other'];

export default function Expenses() {
  const { expenses, addExpense, deleteExpense } = useExpenses();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('Transport');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [monthStr, setMonthStr] = useState(format(new Date(), 'yyyy-MM'));

  const monthDate = parseISO(`${monthStr}-01`);
  const mStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const mEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date >= mStart && e.date <= mEnd)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [expenses, mStart, mEnd]
  );

  const totalMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthExpenses.forEach(e => {
      map[e.category] = (map[e.category] ?? 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const goMonth = (delta: number) => {
    const d = parseISO(`${monthStr}-01`);
    d.setMonth(d.getMonth() + delta);
    setMonthStr(format(d, 'yyyy-MM'));
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Transport');
    setShowForm(false);
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!description.trim()) { toast.error('Enter a description'); return; }
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await addExpense({ date, category, description: description.trim(), amount: amt });
      toast.success('Expense added!');
      resetForm();
    } catch {
      toast.error('Failed to add expense');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      setConfirmDelete(null);
      toast.success('Expense deleted');
    } catch {
      toast.error('Failed to delete');
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Expenses" showBack />

      <div className="p-4 space-y-4">
        {/* Month Picker */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-2 py-1">
          <button onClick={() => goMonth(-1)} className="p-2 text-gray-500"><ChevronLeft size={20} /></button>
          <span className="text-sm font-semibold text-gray-900">{format(monthDate, 'MMMM yyyy')}</span>
          <button onClick={() => goMonth(1)} className="p-2 text-gray-500"><ChevronRight size={20} /></button>
        </div>

        {/* Monthly Total */}
        <div className="bg-orange-50 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-orange-600 uppercase">Total Expenses</p>
          <p className="text-2xl font-bold text-orange-700">{formatPeso(totalMonth)}</p>
          <p className="text-xs text-orange-500 mt-1">{monthExpenses.length} expense(s)</p>
        </div>

        {/* Category Breakdown */}
        {byCategory.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {byCategory.map(([cat, amt]) => (
              <div key={cat} className="bg-white rounded-lg border border-gray-200 px-3 py-1.5">
                <span className="text-xs text-gray-500">{cat}</span>
                <span className="text-xs font-semibold text-gray-900 ml-1">{formatPeso(amt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add Button / Form */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm active:bg-orange-600"
          >
            <Plus size={18} /> Add Expense
          </button>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Add Expense</h3>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      category === c ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What was this expense for?"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₱) *</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 150"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={resetForm} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-semibold text-sm active:bg-orange-600">
                Save
              </button>
            </div>
          </div>
        )}

        {/* Expense List */}
        {monthExpenses.length === 0 ? (
          <EmptyState
            icon={<Receipt size={48} />}
            title="No expenses this month"
            description="Tap above to record transport, fees, or other costs."
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {monthExpenses.map(e => (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700">
                      {e.category}
                    </span>
                    <span className="text-xs text-gray-500">{e.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-orange-700">{formatPeso(e.amount)}</p>
                    <button onClick={() => setConfirmDelete(e.id)} className="p-1 text-gray-400"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-600">{e.description}</p>
                {confirmDelete === e.id && (
                  <div className="mt-2 pt-2 border-t border-gray-200 flex gap-2">
                    <button onClick={() => setConfirmDelete(null)} className="flex-1 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium">Cancel</button>
                    <button onClick={() => handleDelete(e.id)} className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium">Delete</button>
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
