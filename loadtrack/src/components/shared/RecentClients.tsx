import { useClients } from '../../hooks/useClients';
import { formatPeso } from '../../utils/currency';
import { Clock } from 'lucide-react';

interface RecentClientsProps {
  onSelect: (clientId: string) => void;
  exclude?: string;
}

export default function RecentClients({ onSelect, exclude }: RecentClientsProps) {
  const { clients } = useClients();

  const recentClients = clients
    .filter(c => c.id !== exclude)
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
    .slice(0, 5);

  if (recentClients.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={12} className="text-gray-400" />
        <p className="text-[10px] font-medium text-gray-400 uppercase">Recent Clients</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {recentClients.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left active:bg-gray-50 min-w-30"
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
