import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Phone, Wallet, AlertCircle } from 'lucide-react';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import EmptyState from '../components/shared/EmptyState';

export default function UnpaidList() {
  const navigate = useNavigate();

  const unpaidClients = useLiveQuery(
    () => db.clients
      .filter(c => c.outstanding_balance > 0)
      .toArray()
      .then(cs => cs.sort((a, b) => b.outstanding_balance - a.outstanding_balance)),
    []
  );

  const totalUnpaid = unpaidClients?.reduce((s, c) => s + c.outstanding_balance, 0) ?? 0;
  const isLoading = unpaidClients === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Unpaid Clients" showBack />
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Unpaid Clients" showBack />

      <div className="p-4 space-y-4">
        {/* Total Unpaid */}
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-red-600 uppercase">Total Unpaid</p>
          <p className="text-2xl font-bold text-red-700">{formatPeso(totalUnpaid)}</p>
          <p className="text-xs text-red-500 mt-1">{unpaidClients?.length ?? 0} client(s)</p>
        </div>

        {/* Client List */}
        {unpaidClients && unpaidClients.length > 0 ? (
          <div className="space-y-3">
            {unpaidClients.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact_number}</p>
                  </div>
                  <p className="text-base font-bold text-red-600">{formatPeso(c.outstanding_balance)}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`tel:${c.contact_number}`}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium"
                  >
                    <Phone size={14} /> Call
                  </a>
                  <button
                    onClick={() => navigate(`/payments?client=${c.id}`)}
                    className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-green-600 text-white text-xs font-medium active:bg-green-700"
                  >
                    <Wallet size={14} /> Collect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<AlertCircle size={48} />}
            title="All caught up!"
            description="No clients with outstanding balances."
          />
        )}
      </div>
    </div>
  );
}
