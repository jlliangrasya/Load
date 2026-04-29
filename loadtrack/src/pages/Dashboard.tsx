import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, AlertCircle, TrendingUp, SendHorizonal, Wallet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatPeso, formatDate } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import StatCard from '../components/shared/StatCard';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import type { Client, Disbursement, Payment, CapitalPurchase } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [capitals, setCapitals] = useState<CapitalPurchase[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [recentDisbursements, setRecentDisbursements] = useState<Disbursement[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [{ data: caps }, { data: cls }, { data: disbs }, { data: pays }] = await Promise.all([
      supabase.from('capital_purchases').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('disbursements').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(5),
    ]);
    setCapitals((caps ?? []) as CapitalPurchase[]);
    setClients((cls ?? []) as Client[]);
    setRecentDisbursements((disbs ?? []) as Disbursement[]);
    setRecentPayments((pays ?? []) as Payment[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const r = Math.random();
    const channels = [
      supabase.channel(`dash-capital-${r}`).on('postgres_changes', { event: '*', schema: 'public', table: 'capital_purchases' }, fetchData).subscribe(),
      supabase.channel(`dash-clients-${r}`).on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchData).subscribe(),
      supabase.channel(`dash-disbs-${r}`).on('postgres_changes', { event: '*', schema: 'public', table: 'disbursements' }, fetchData).subscribe(),
      supabase.channel(`dash-pays-${r}`).on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData).subscribe(),
    ];
    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [fetchData]);

  const smartBalance = capitals.filter(c => c.network === 'smart').reduce((s, c) => s + c.remaining_balance, 0);
  const globeBalance = capitals.filter(c => c.network === 'globe').reduce((s, c) => s + c.remaining_balance, 0);
  const totalOutstanding = clients.reduce((s, c) => s + c.outstanding_balance, 0);
  const unpaidClients = clients.filter(c => c.outstanding_balance > 0).length;

  const clientsMap: Record<string, Client> = {};
  clients.forEach(c => { clientsMap[c.id] = c; });

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
            value={formatPeso(smartBalance)}
            color="text-blue-600"
            icon={<TrendingUp size={16} />}
          />
          <StatCard
            label="Globe Balance"
            value={formatPeso(globeBalance)}
            color="text-red-600"
            icon={<TrendingUp size={16} />}
          />
          <StatCard
            label="Total Outstanding"
            value={formatPeso(totalOutstanding)}
            color="text-red-600"
            icon={<AlertCircle size={16} />}
          />
          <StatCard
            label="Unpaid Clients"
            value={String(unpaidClients)}
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
        {clients.length > 0 && (
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
          {recentDisbursements.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {recentDisbursements.map(d => (
                  <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {clientsMap[d.client_id]?.name ?? 'Unknown'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <NetworkBadge network={d.network} />
                        <StatusBadge status={d.status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatPeso(d.selling_price)}</p>
                      <p className="text-xs text-gray-500">{formatDate(d.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No disbursements yet</p>
          )}
        </div>

        {/* Recent Payments */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Recent Payments</h2>
          {recentPayments.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {recentPayments.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {clientsMap[p.client_id]?.name ?? 'Unknown'}
                      </p>
                      <PaymentMethodBadge method={p.method} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">{formatPeso(p.amount)}</p>
                      <p className="text-xs text-gray-500">{formatDate(p.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No payments yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
