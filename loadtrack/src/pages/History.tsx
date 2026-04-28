import { useState, useMemo } from 'react';
import { Search, Filter, X, FileDown, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useDisbursements } from '../hooks/useDisbursements';
import { usePayments } from '../hooks/usePayments';
import { useClients } from '../hooks/useClients';
import { formatPeso } from '../utils/currency';
import { exportDisbursementsPdf, exportPaymentsPdf, exportPaymentReceipt } from '../utils/exportPdf';
import { exportDisbursementsXlsx, exportPaymentsXlsx } from '../utils/exportXlsx';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import EmptyState from '../components/shared/EmptyState';
import SignatureImage from '../components/signature/SignatureImage';
import toast from 'react-hot-toast';
import type { Client } from '../types';

type HistoryTab = 'disbursements' | 'payments';

export default function History() {
  const [tab, setTab] = useState<HistoryTab>('disbursements');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [networkFilter, setNetworkFilter] = useState<'' | 'smart' | 'globe'>('');
  const [clientSearch, setClientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'success' | 'failed' | 'returned'>('');
  const [methodFilter, setMethodFilter] = useState<'' | 'cash' | 'gcash' | 'online_transfer'>('');
  const [signatureModal, setSignatureModal] = useState<{ image: string; date: string; amount: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { deleteDisbursement, disbursements: allDisbursements } = useDisbursements();
  const { deletePayment, payments: allPayments } = usePayments();
  const { clients } = useClients();

  const disbursements = allDisbursements;
  const payments = allPayments;
  const clientsMap = useMemo(() => {
    const map: Record<string, Client> = {};
    clients.forEach(c => { map[c.id] = c; });
    return map;
  }, [clients]);

  const hasActiveFilters = dateFrom || dateTo || networkFilter || clientSearch || statusFilter || methodFilter;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setNetworkFilter('');
    setClientSearch(''); setStatusFilter(''); setMethodFilter('');
  };

  const handleDeleteDisbursement = async (id: string) => {
    try {
      await deleteDisbursement(id);
      setConfirmDeleteId(null);
      toast.success('Disbursement deleted');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
      setConfirmDeleteId(null);
    }
  };

  const handleDeletePayment = async (id: string) => {
    try {
      await deletePayment(id);
      setConfirmDeleteId(null);
      toast.success('Payment deleted');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
      setConfirmDeleteId(null);
    }
  };

  const filteredDisbursements = useMemo(() => {
    if (!disbursements) return [];
    return disbursements.filter(d => {
      if (dateFrom && d.date < dateFrom) return false;
      if (dateTo && d.date > dateTo) return false;
      if (networkFilter && d.network !== networkFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      if (clientSearch) {
        const name = clientsMap[d.client_id]?.name ?? '';
        if (!name.toLowerCase().includes(clientSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [disbursements, clientsMap, dateFrom, dateTo, networkFilter, statusFilter, clientSearch]);

  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    return payments.filter(p => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      if (methodFilter && p.method !== methodFilter) return false;
      if (clientSearch) {
        const name = clientsMap[p.client_id]?.name ?? '';
        if (!name.toLowerCase().includes(clientSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [payments, clientsMap, dateFrom, dateTo, methodFilter, clientSearch]);

  const isLoading = false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="History" showBack />
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
      <PageHeader title="History" showBack />

      <div className="p-4 space-y-4">
        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setTab('disbursements')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'disbursements' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Disbursements
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

        {/* Filter Toggle + Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium ${
              hasActiveFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter size={14} /> Filters {hasActiveFilters ? '(active)' : ''}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 font-medium">
              Clear all
            </button>
          )}
          <div className="ml-auto flex gap-1">
            <button
              onClick={async () => {
                try {
                  if (tab === 'disbursements') await exportDisbursementsPdf(filteredDisbursements);
                  else await exportPaymentsPdf(filteredPayments);
                  toast.success('PDF exported!');
                } catch { toast.error('Export failed'); }
              }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-medium"
              title="Export PDF"
            >
              <FileDown size={14} /> PDF
            </button>
            <button
              onClick={async () => {
                try {
                  if (tab === 'disbursements') await exportDisbursementsXlsx(filteredDisbursements);
                  else await exportPaymentsXlsx(filteredPayments);
                  toast.success('Excel exported!');
                } catch { toast.error('Export failed'); }
              }}
              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-green-50 text-green-600 text-xs font-medium"
              title="Export Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Client Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Search by client name..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tab-specific filters */}
            {tab === 'disbursements' && (
              <>
                {/* Network Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Network</label>
                  <div className="flex gap-1">
                    {[{ k: '', l: 'All' }, { k: 'smart', l: 'Smart' }, { k: 'globe', l: 'Globe' }].map(o => (
                      <button
                        key={o.k}
                        onClick={() => setNetworkFilter(o.k as typeof networkFilter)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                          networkFilter === o.k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <div className="flex gap-1">
                    {[{ k: '', l: 'All' }, { k: 'success', l: 'Success' }, { k: 'failed', l: 'Failed' }, { k: 'returned', l: 'Returned' }].map(o => (
                      <button
                        key={o.k}
                        onClick={() => setStatusFilter(o.k as typeof statusFilter)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                          statusFilter === o.k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === 'payments' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                <div className="flex gap-1">
                  {[{ k: '', l: 'All' }, { k: 'cash', l: 'Cash' }, { k: 'gcash', l: 'GCash' }, { k: 'online_transfer', l: 'Online' }].map(o => (
                    <button
                      key={o.k}
                      onClick={() => setMethodFilter(o.k as typeof methodFilter)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium ${
                        methodFilter === o.k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disbursements List */}
        {tab === 'disbursements' && (
          filteredDisbursements.length === 0 ? (
            <EmptyState
              title="No disbursements found"
              description={hasActiveFilters ? 'Try adjusting your filters.' : 'No disbursements recorded yet.'}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredDisbursements.map(d => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {clientsMap?.[d.client_id]?.name ?? 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{d.date}</span>
                      <button
                        onClick={() => setConfirmDeleteId(d.id)}
                        className="p-1 text-gray-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <NetworkBadge network={d.network} />
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPeso(d.selling_price)}</p>
                      <p className="text-[10px] text-gray-400">Face: {formatPeso(d.face_value)}</p>
                    </div>
                  </div>
                  {d.failure_reason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {d.failure_reason}</p>
                  )}
                  {confirmDeleteId === d.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteDisbursement(d.id)}
                        className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Payments List */}
        {tab === 'payments' && (
          filteredPayments.length === 0 ? (
            <EmptyState
              title="No payments found"
              description={hasActiveFilters ? 'Try adjusting your filters.' : 'No payments recorded yet.'}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredPayments.map(p => (
                <div key={p.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {clientsMap?.[p.client_id]?.name ?? 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{p.date}</span>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="p-1 text-gray-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PaymentMethodBadge method={p.method} />
                      {p.reference_number && (
                        <span className="text-[10px] text-gray-400">Ref: {p.reference_number}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-green-600">{formatPeso(p.amount)}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      onClick={() => setSignatureModal({ image: p.signature_image, date: p.date, amount: p.amount })}
                      className="text-xs text-blue-600 font-medium"
                    >
                      View Signature
                    </button>
                    <button
                      onClick={async () => {
                        try { await exportPaymentReceipt(p); toast.success('Receipt downloaded!'); }
                        catch { toast.error('Receipt export failed'); }
                      }}
                      className="text-xs text-purple-600 font-medium"
                    >
                      Download Receipt
                    </button>
                  </div>
                  {confirmDeleteId === p.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Signature Modal */}
      {signatureModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Payment Signature</h3>
              <button onClick={() => setSignatureModal(null)} className="p-1">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-3">
                <p className="text-xs text-gray-500">{signatureModal.date}</p>
                <p className="text-lg font-bold text-green-600">{formatPeso(signatureModal.amount)}</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-2 bg-gray-50">
                <SignatureImage signatureImage={signatureModal.image} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
