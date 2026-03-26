import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, ShoppingCart, SendHorizonal } from 'lucide-react';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import type { Client } from '../types';

interface TransactionRow {
  id: string;
  type: 'buy' | 'disburse';
  date: string;
  network: 'smart' | 'globe';
  amount: number;
  created_at: string;
  // buy-specific
  cost_price?: number;
  commission?: number;
  remaining_balance?: number;
  // disburse-specific
  client_id?: string;
  face_value?: number;
  markup?: number;
  status?: 'success' | 'failed' | 'returned';
  failure_reason?: string;
}

export default function Transactions() {
  const [monthStr, setMonthStr] = useState(format(new Date(), 'yyyy-MM'));

  const monthDate = parseISO(`${monthStr}-01`);
  const mStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const mEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  const capitals = useLiveQuery(() => db.capital_purchases.toArray(), []);
  const disbursements = useLiveQuery(() => db.disbursements.toArray(), []);
  const clientsMap = useLiveQuery(
    () => db.clients.toArray().then(cs => {
      const m: Record<string, Client> = {};
      cs.forEach(c => { m[c.id] = c; });
      return m;
    }), []
  );

  const rows = useMemo<TransactionRow[]>(() => {
    const result: TransactionRow[] = [];

    for (const c of capitals ?? []) {
      if (c.date < mStart || c.date > mEnd) continue;
      result.push({
        id: c.id,
        type: 'buy',
        date: c.date,
        network: c.network,
        amount: c.face_value,
        created_at: c.created_at,
        cost_price: c.cost_price,
        commission: c.commission,
        remaining_balance: c.remaining_balance,
      });
    }

    for (const d of disbursements ?? []) {
      if (d.date < mStart || d.date > mEnd) continue;
      result.push({
        id: d.id,
        type: 'disburse',
        date: d.date,
        network: d.network,
        amount: d.selling_price,
        created_at: d.created_at,
        client_id: d.client_id,
        face_value: d.face_value,
        markup: d.markup,
        status: d.status,
        failure_reason: d.failure_reason,
      });
    }

    result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return result;
  }, [capitals, disbursements, mStart, mEnd]);

  // Monthly summaries
  const totalBought = useMemo(
    () => rows.filter(r => r.type === 'buy').reduce((s, r) => s + r.amount, 0), [rows]
  );
  const totalDisbursed = useMemo(
    () => rows.filter(r => r.type === 'disburse' && r.status === 'success').reduce((s, r) => s + r.amount, 0), [rows]
  );
  const buyCount = rows.filter(r => r.type === 'buy').length;
  const disburseCount = rows.filter(r => r.type === 'disburse').length;

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const r of rows) {
      const existing = map.get(r.date);
      if (existing) existing.push(r);
      else map.set(r.date, [r]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const goMonth = (delta: number) => {
    const d = parseISO(`${monthStr}-01`);
    d.setMonth(d.getMonth() + delta);
    setMonthStr(format(d, 'yyyy-MM'));
  };

  const isLoading = capitals === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Transactions" showBack />
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="Transactions" showBack />

      <div className="p-4 space-y-4">
        {/* Month Picker */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-2 py-1">
          <button onClick={() => goMonth(-1)} className="p-2 text-gray-500 active:text-gray-800">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {format(monthDate, 'MMMM yyyy')}
          </span>
          <button onClick={() => goMonth(1)} className="p-2 text-gray-500 active:text-gray-800">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-[10px] font-medium text-purple-600 uppercase">Bought</p>
            <p className="text-lg font-bold text-purple-700">{formatPeso(totalBought)}</p>
            <p className="text-[10px] text-purple-500">{buyCount} purchase(s)</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[10px] font-medium text-blue-600 uppercase">Disbursed</p>
            <p className="text-lg font-bold text-blue-700">{formatPeso(totalDisbursed)}</p>
            <p className="text-[10px] text-blue-500">{disburseCount} transaction(s)</p>
          </div>
        </div>

        {/* Transaction List */}
        {grouped.length === 0 ? (
          <EmptyState
            title="No transactions"
            description={`Nothing recorded for ${format(monthDate, 'MMMM yyyy')}.`}
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-gray-500 mb-2 px-1">
                  {format(parseISO(date), 'EEEE, MMM d')}
                </p>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {items.map(row => (
                    <div key={row.id} className="px-4 py-3">
                      {row.type === 'buy' ? (
                        <BuyRow row={row} />
                      ) : (
                        <DisburseRow row={row} clientName={clientsMap?.[row.client_id!]?.name ?? 'Unknown'} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BuyRow({ row }: { row: TransactionRow }) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
            <ShoppingCart size={10} /> BUY
          </span>
          <NetworkBadge network={row.network} />
        </div>
        <p className="text-sm font-bold text-purple-700">+{formatPeso(row.amount)}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Cost: {formatPeso(row.cost_price!)} &middot; Commission: {formatPeso(row.commission!)}</span>
        <span className={row.remaining_balance! < 500 ? 'text-red-500 font-medium' : ''}>
          Bal: {formatPeso(row.remaining_balance!)}
        </span>
      </div>
    </>
  );
}

function DisburseRow({ row, clientName }: { row: TransactionRow; clientName: string }) {
  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
            <SendHorizonal size={10} /> SEND
          </span>
          <NetworkBadge network={row.network} />
          <StatusBadge status={row.status!} />
        </div>
        <p className="text-sm font-bold text-blue-700">-{formatPeso(row.amount)}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-700">{clientName}</span>
        <span>Face: {formatPeso(row.face_value!)} &middot; Markup: {formatPeso(row.markup!)}</span>
      </div>
      {row.failure_reason && (
        <p className="text-xs text-red-500 mt-1">Reason: {row.failure_reason}</p>
      )}
    </>
  );
}
