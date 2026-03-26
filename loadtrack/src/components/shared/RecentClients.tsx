import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { formatPeso } from '../../utils/currency';
import { Clock } from 'lucide-react';

interface RecentClientsProps {
  onSelect: (clientId: string) => void;
  exclude?: string;
}

export default function RecentClients({ onSelect, exclude }: RecentClientsProps) {
  const recentClients = useLiveQuery(
    () => db.clients.orderBy('updated_at').reverse().limit(10).toArray()
      .then(cs => cs.filter(c => c.id !== exclude)),
    [exclude]
  );

  if (!recentClients || recentClients.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={12} className="text-gray-400" />
        <p className="text-[10px] font-medium text-gray-400 uppercase">Recent Clients</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {recentClients.slice(0, 5).map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="flex-shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left active:bg-gray-50 min-w-[120px]"
          >
            <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${c.outstanding_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {c.outstanding_balance > 0 ? formatPeso(c.outstanding_balance) : 'Paid'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
