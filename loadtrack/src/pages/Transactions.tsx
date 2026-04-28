import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, ShoppingCart, SendHorizonal, Wallet } from 'lucide-react';
import { useCapital } from '../hooks/useCapital';
import { useDisbursements } from '../hooks/useDisbursements';
import { usePayments } from '../hooks/usePayments';
import { useClients } from '../hooks/useClients';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import EmptyState from '../components/shared/EmptyState';
import type { Client } from '../types';

type Tab = 'load' | 'payments';

interface LoadRow {
  id: string;
  type: 'buy' | 'disburse';
  date: string;
  network: 'smart' | 'globe';
  amount: number;
  created_at: string;
  cost_price?: number;
  commission?: number;
  remaining_balance?: number;
  client_id?: string;
  face_value?: number;
  markup?: number;
  status?: 'success' | 'failed' | 'returned';
  failure_reason?: string;
}

interface PaymentRow {
  id: string;
  date: string;
  client_id: string;
  amount: number;
  method: 'cash' | 'gcash' | 'online_transfer';
  reference_number?: string;
  created_at: string;
}

export default function Transactions() {
  const [tab, setTab] = useState<Tab>('load');
  const [monthStr, setMonthStr] = useState(format(new Date(), 'yyyy-MM'));

  const monthDate = parseISO(`${monthStr}-01`);
  const mStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
  const mEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

  const { capitals } = useCapital();
  const { disbursements } = useDisbursements();
  const { payments } = usePayments();
  const { clients } = useClients();
  const clientsMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach(c => { m[c.id] = c; });
    return m;
  }, [clients]);

  // LOAD tab rows
  const loadRows = useMemo<LoadRow[]>(() => {
    const result: LoadRow[] = [];
    for (const c of capitals) {
      if (c.date < mStart || c.date > mEnd) continue;
      result.push({
        id: c.id, type: 'buy', date: c.date, network: c.network, amount: c.face_value,
        created_at: c.created_at, cost_price: c.cost_price, commission: c.commission,
        remaining_balance: c.remaining_balance,
      });
    }
    for (const d of disbursements) {
      if (d.date < mStart || d.date > mEnd) continue;
      result.push({
        id: d.id, type: 'disburse', date: d.date, network: d.network, amount: d.selling_price,
        created_at: d.created_at, client_id: d.client_id, face_value: d.face_value,
        markup: d.markup, status: d.status, failure_reason: d.failure_reason,
      });
    }
    result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return result;
  }, [capitals, disbursements, mStart, mEnd]);

  // PAYMENTS tab rows
  const paymentRows = useMemo<PaymentRow[]>(() => {
    return (payments)
      .filter(p => p.date >= mStart && p.date <= mEnd)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [payments, mStart, mEnd]);

  // Summaries
  const totalBought = useMemo(
    () => loadRows.filter(r => r.type === 'buy').reduce((s, r) => s + r.amount, 0), [loadRows]
  );
  const totalDisbursed = useMemo(
    () => loadRows.filter(r => r.type === 'disburse' && r.status === 'success').reduce((s, r) => s + r.amount, 0), [loadRows]
  );
  const totalCollected = useMemo(
    () => paymentRows.reduce((s, r) => s + r.amount, 0), [paymentRows]
  );

  // Group helpers
  function groupByDate<T extends { date: string }>(items: T[]) {
    const map = new Map<string, T[]>();
    for (const r of items) {
      const existing = map.get(r.date);
      if (existing) existing.push(r);
      else map.set(r.date, [r]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }

  const groupedLoad = useMemo(() => groupByDate(loadRows), [loadRows]);
  const groupedPayments = useMemo(() => groupByDate(paymentRows), [paymentRows]);

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
        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setTab('load')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'load' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Load
          </button>
          <button
            onClick={() => setTab('payments')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'payments' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Payments
          </button>
        </div>

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

        {/* Summaries */}
        {tab === 'load' ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50 rounded-xl p-3">
              <p className="text-[10px] font-medium text-purple-600 uppercase">Bought</p>
              <p className="text-lg font-bold text-purple-700">{formatPeso(totalBought)}</p>
              <p className="text-[10px] text-purple-500">{loadRows.filter(r => r.type === 'buy').length} purchase(s)</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-[10px] font-medium text-blue-600 uppercase">Disbursed</p>
              <p className="text-lg font-bold text-blue-700">{formatPeso(totalDisbursed)}</p>
              <p className="text-[10px] text-blue-500">{loadRows.filter(r => r.type === 'disburse').length} transaction(s)</p>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-medium text-green-600 uppercase">Total Collected</p>
            <p className="text-lg font-bold text-green-700">{formatPeso(totalCollected)}</p>
            <p className="text-[10px] text-green-500">{paymentRows.length} payment(s)</p>
          </div>
        )}

        {/* LOAD Tab Content */}
        {tab === 'load' && (
          groupedLoad.length === 0 ? (
            <EmptyState title="No load transactions" description={`Nothing recorded for ${format(monthDate, 'MMMM yyyy')}.`} />
          ) : (
            <div className="space-y-4">
              {groupedLoad.map(([date, items]) => (
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
          )
        )}

        {/* PAYMENTS Tab Content */}
        {tab === 'payments' && (
          groupedPayments.length === 0 ? (
            <EmptyState title="No payments" description={`No payments recorded for ${format(monthDate, 'MMMM yyyy')}.`} />
          ) : (
            <div className="space-y-4">
              {groupedPayments.map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-1">
                    {format(parseISO(date), 'EEEE, MMM d')}
                  </p>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {items.map(row => (
                      <div key={row.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                              <Wallet size={10} /> PAYMENT
                            </span>
                            <PaymentMethodBadge method={row.method} />
                          </div>
                          <p className="text-sm font-bold text-green-700">+{formatPeso(row.amount)}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="font-medium text-gray-700">
                            {clientsMap?.[row.client_id]?.name ?? 'Unknown'}
                          </span>
                          {row.reference_number && (
                            <span>Ref: {row.reference_number}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function BuyRow({ row }: { row: LoadRow }) {
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

function DisburseRow({ row, clientName }: { row: LoadRow; clientName: string }) {
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
