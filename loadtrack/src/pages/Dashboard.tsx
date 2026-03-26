import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, AlertCircle, TrendingUp, SendHorizonal, Wallet } from 'lucide-react';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import StatCard from '../components/shared/StatCard';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import type { Client } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const smartBalance = useLiveQuery(
    () => db.capital_purchases.where('network').equals('smart').toArray()
      .then(items => items.reduce((s, c) => s + c.remaining_balance, 0)),
    []
  );

  const globeBalance = useLiveQuery(
    () => db.capital_purchases.where('network').equals('globe').toArray()
      .then(items => items.reduce((s, c) => s + c.remaining_balance, 0)),
    []
  );

  const totalOutstanding = useLiveQuery(
    () => db.clients.toArray().then(cs => cs.reduce((s, c) => s + c.outstanding_balance, 0)),
    []
  );

  const unpaidClients = useLiveQuery(
    () => db.clients.filter(c => c.outstanding_balance > 0).count(),
    []
  );

  const collectedToday = useLiveQuery(
    () => db.payments.where('date').equals(today).toArray()
      .then(ps => ps.reduce((s, p) => s + p.amount, 0)),
    []
  );

  const disbursedToday = useLiveQuery(
    () => db.disbursements.where('date').equals(today).toArray()
      .then(ds => ds.filter(d => d.status === 'success').reduce((s, d) => s + d.selling_price, 0)),
    []
  );

  const recentDisbursements = useLiveQuery(
    () => db.disbursements.orderBy('created_at').reverse().limit(5).toArray(),
    []
  );

  const recentPayments = useLiveQuery(
    () => db.payments.orderBy('created_at').reverse().limit(5).toArray(),
    []
  );

  const clients = useLiveQuery(() => db.clients.toArray(), []);

  const clientsMap = useLiveQuery(
    () => db.clients.toArray().then(cs => {
      const map: Record<string, Client> = {};
      cs.forEach(c => { map[c.id] = c; });
      return map;
    }),
    []
  );

  const isLoading = smartBalance === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="LoadTrack" />
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="LoadTrack" />

      <div className="p-4 space-y-4">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Smart Balance"
            value={formatPeso(smartBalance ?? 0)}
            color="text-blue-600"
            icon={<TrendingUp size={16} />}
          />
          <StatCard
            label="Globe Balance"
            value={formatPeso(globeBalance ?? 0)}
            color="text-red-600"
            icon={<TrendingUp size={16} />}
          />
          <StatCard
            label="Total Outstanding"
            value={formatPeso(totalOutstanding ?? 0)}
            color="text-red-600"
            icon={<AlertCircle size={16} />}
          />
          <StatCard
            label="Collected Today"
            value={formatPeso(collectedToday ?? 0)}
            color="text-green-600"
          />
          <StatCard
            label="Disbursed Today"
            value={formatPeso(disbursedToday ?? 0)}
            color="text-blue-600"
          />
          <StatCard
            label="Unpaid Clients"
            value={String(unpaidClients ?? 0)}
            color="text-red-600"
            icon={<Users size={16} />}
            onClick={() => navigate('/unpaid')}
          />
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/disburse')}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-blue-700"
          >
            <SendHorizonal size={16} /> Disburse
          </button>
          <button
            onClick={() => navigate('/payments')}
            className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-green-700"
          >
            <Wallet size={16} /> Payment
          </button>
          <button
            onClick={() => navigate('/capital')}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-semibold text-sm active:bg-purple-700"
          >
            <Plus size={16} /> Buy Load
          </button>
        </div>

        {/* Quick Client Access */}
        {clients && clients.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Quick Disburse</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {clients
                .sort((a, b) => (b.last_activity ?? b.updated_at).localeCompare(a.last_activity ?? a.updated_at))
                .slice(0, 6)
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/disburse?client=${c.id}`)}
                    className="flex-shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-center active:bg-gray-50 min-w-[80px]"
                  >
                    <p className="text-xs font-semibold text-gray-900 truncate">{c.name.split(' ')[0]}</p>
                    <p className={`text-[10px] mt-0.5 ${c.outstanding_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {c.outstanding_balance > 0 ? '₱' + c.outstanding_balance.toLocaleString() : '✓'}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Recent Disbursements */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Disbursements</h2>
          {recentDisbursements && recentDisbursements.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {recentDisbursements.slice(0, 5).map(d => (
                  <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {clientsMap?.[d.client_id]?.name ?? 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <NetworkBadge network={d.network} />
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatPeso(d.selling_price)}</p>
                      <p className="text-xs text-gray-500">{d.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              {recentDisbursements.length > 5 && (
                <button
                  onClick={() => navigate('/transactions')}
                  className="w-full text-center py-2 text-xs text-blue-600 font-medium"
                >
                  View all {recentDisbursements.length} disbursements →
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No disbursements yet</p>
          )}
        </div>

        {/* Recent Payments */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Payments</h2>
          {recentPayments && recentPayments.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {recentPayments.slice(0, 5).map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {clientsMap?.[p.client_id]?.name ?? 'Unknown'}
                      </p>
                      <PaymentMethodBadge method={p.method} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatPeso(p.amount)}</p>
                      <p className="text-xs text-gray-500">{p.date}</p>
                    </div>
                  </div>
                ))}
              </div>
              {recentPayments.length > 5 && (
                <button
                  onClick={() => navigate('/transactions')}
                  className="w-full text-center py-2 text-xs text-green-600 font-medium"
                >
                  View all {recentPayments.length} payments →
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No payments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
