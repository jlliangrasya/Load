import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Phone, Wallet, AlertCircle, ClipboardList } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';

export default function UnpaidList() {
  const navigate = useNavigate();

  const unpaidClients = useLiveQuery(
    () => db.clients
      .filter(c => c.outstanding_balance > 0)
      .toArray()
      .then(cs => cs.sort((a, b) => b.outstanding_balance - a.outstanding_balance)),
    []
  );

  // IDs already on the collection list
  const collectionClientIds = useLiveQuery(
    () => db.collection_list.toArray().then(items => new Set(items.map(i => i.client_id))),
    []
  );

  const totalUnpaid = unpaidClients?.reduce((s, c) => s + c.outstanding_balance, 0) ?? 0;
  const isLoading = unpaidClients === undefined;

  const handleAddToCollect = async (clientId: string, amount: number) => {
    await db.collection_list.add({
      id: uuid(),
      client_id: clientId,
      amount,
      collected: 0,
      created_at: new Date().toISOString(),
    });
    toast.success('Added to collection list');
  };

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

        {/* Go to Collection List */}
        <button
          onClick={() => navigate('/collect')}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-3 rounded-xl font-semibold text-sm active:bg-amber-600"
        >
          <ClipboardList size={16} /> View Collection List
        </button>

        {/* Client List */}
        {unpaidClients && unpaidClients.length > 0 ? (
          <div className="space-y-3">
            {unpaidClients.map(c => {
              const alreadyAdded = collectionClientIds?.has(c.id);
              return (
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
                    {alreadyAdded ? (
                      <span className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg bg-amber-50 text-amber-600 text-xs font-medium">
                        <ClipboardList size={14} /> Listed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddToCollect(c.id, c.outstanding_balance)}
                        className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg bg-amber-500 text-white text-xs font-medium active:bg-amber-600"
                      >
                        <ClipboardList size={14} /> + List
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
