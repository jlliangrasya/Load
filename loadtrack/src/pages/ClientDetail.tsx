import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SendHorizonal, Wallet, X, Search, Trash2, Share2 } from 'lucide-react';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import { generateClientStatement, shareClientStatement } from '../utils/statement';
import { useDisbursements } from '../hooks/useDisbursements';
import { usePayments } from '../hooks/usePayments';
import PageHeader from '../components/layout/PageHeader';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';
import type { Client, Disbursement, Payment } from '../types';

type Tab = 'disbursements' | 'payments';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { deleteDisbursement } = useDisbursements();
  const { deletePayment } = usePayments();
  const [client, setClient] = useState<Client | null>(null);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<Tab>('disbursements');
  const [signatureModal, setSignatureModal] = useState<{ image: string; date: string; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeleteDisbursement, setConfirmDeleteDisbursement] = useState<string | null>(null);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<string | null>(null);
  const [disbursementSearch, setDisbursementSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');

  useEffect(() => {
    if (!id) return;
    async function load() {
      const c = await db.clients.get(id!);
      if (c) {
        setClient(c);
        const d = await db.disbursements.where('client_id').equals(id!).toArray();
        setDisbursements(d.sort((a, b) => b.created_at.localeCompare(a.created_at)));
        const p = await db.payments.where('client_id').equals(id!).toArray();
        setPayments(p.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      }
      setLoading(false);
    }
    load();
  }, [id, refreshKey]);

  const filteredDisbursements = useMemo(() => {
    const q = disbursementSearch.trim().toLowerCase();
    if (!q) return disbursements;
    return disbursements.filter(d =>
      d.date.toLowerCase().includes(q) ||
      d.selling_price.toString().includes(q) ||
      d.face_value.toString().includes(q) ||
      d.markup.toString().includes(q) ||
      (d.network && d.network.toLowerCase().includes(q)) ||
      (d.status && d.status.toLowerCase().includes(q)) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  }, [disbursements, disbursementSearch]);

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(p =>
      p.date.toLowerCase().includes(q) ||
      p.amount.toString().includes(q) ||
      (p.method && p.method.toLowerCase().includes(q)) ||
      (p.reference_number && p.reference_number.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  }, [payments, paymentSearch]);

  const handleDeleteDisbursement = async (disbursementId: string) => {
    try {
      await deleteDisbursement(disbursementId);
      setConfirmDeleteDisbursement(null);
      toast.success('Disbursement deleted');
      setRefreshKey(k => k + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
      setConfirmDeleteDisbursement(null);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePayment(paymentId);
      setConfirmDeletePayment(null);
      toast.success('Payment deleted');
      setRefreshKey(k => k + 1);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      toast.error(msg);
      setConfirmDeletePayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Client Detail" showBack />
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="Client Detail" showBack />
        <div className="p-4 text-center text-gray-400 text-sm mt-12">Client not found</div>
      </div>
    );
  }

  const successDisbursements = disbursements.filter(d => d.status === 'success');
  const totalReceived = successDisbursements.reduce((s, d) => s + d.selling_price, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalReceived - totalPaid;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title={client.name} showBack />

      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-base font-semibold text-gray-900">{client.name}</p>
              <p className="text-xs text-gray-500">{client.contact_number}</p>
              {client.address && <p className="text-xs text-gray-400 mt-0.5">{client.address}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-[10px] text-blue-600 font-medium uppercase">Received</p>
              <p className="text-sm font-bold text-blue-700">{formatPeso(totalReceived)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-[10px] text-green-600 font-medium uppercase">Paid</p>
              <p className="text-sm font-bold text-green-700">{formatPeso(totalPaid)}</p>
            </div>
            <div className={`rounded-lg p-2 ${balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-[10px] font-medium uppercase ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Balance
              </p>
              <p className={`text-sm font-bold ${balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatPeso(balance)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(`/disburse?client=${client.id}`)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold active:bg-blue-700"
            >
              <SendHorizonal size={14} /> Disburse
            </button>
            <button
              onClick={() => navigate(`/payments?client=${client.id}`)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold active:bg-green-700"
            >
              <Wallet size={14} /> Pay
            </button>
            <button
              onClick={async () => {
                try {
                  const text = await generateClientStatement(client.id);
                  const result = await shareClientStatement(text);
                  if (result === 'shared') toast.success('Statement shared!');
                  else if (result === 'copied') toast.success('Statement copied to clipboard!');
                  else toast.error('Could not share statement');
                } catch { toast.error('Failed to generate statement'); }
              }}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold"
            >
              <Share2 size={14} /> Statement
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setTab('disbursements')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'disbursements' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Disbursements ({disbursements.length})
          </button>
          <button
            onClick={() => setTab('payments')}
            className={`flex-1 py-3 text-sm font-semibold ${
              tab === 'payments' ? 'bg-green-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Payments ({payments.length})
          </button>
        </div>

        {/* Disbursements Tab */}
        {tab === 'disbursements' && (
          disbursements.length === 0 ? (
            <EmptyState
              icon={<SendHorizonal size={40} />}
              title="No disbursements"
              description="No load has been sent to this client yet."
            />
          ) : (
            <>
              {/* Disbursement Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={disbursementSearch}
                  onChange={e => setDisbursementSearch(e.target.value)}
                  placeholder="Filter by date, amount, network..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {filteredDisbursements.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No disbursements match your filter.</p>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {filteredDisbursements.map(d => (
                    <div key={d.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <NetworkBadge network={d.network} />
                          <StatusBadge status={d.status} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{d.date}</span>
                          <button
                            onClick={() => setConfirmDeleteDisbursement(d.id)}
                            className="p-1 text-gray-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-gray-500">
                          Face: {formatPeso(d.face_value)} &middot; Markup: {formatPeso(d.markup)}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{formatPeso(d.selling_price)}</p>
                      </div>
                      {d.failure_reason && (
                        <p className="text-xs text-red-500 mt-1">Reason: {d.failure_reason}</p>
                      )}
                      {d.notes && <p className="text-xs text-gray-400 mt-1">{d.notes}</p>}

                      {/* Delete Confirmation */}
                      {confirmDeleteDisbursement === d.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                          <button
                            onClick={() => setConfirmDeleteDisbursement(null)}
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
              )}
            </>
          )
        )}

        {/* Payments Tab */}
        {tab === 'payments' && (
          payments.length === 0 ? (
            <EmptyState
              icon={<Wallet size={40} />}
              title="No payments"
              description="No payments have been recorded for this client."
            />
          ) : (
            <>
              {/* Payment Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={e => setPaymentSearch(e.target.value)}
                  placeholder="Filter by date, amount, method..."
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {filteredPayments.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">No payments match your filter.</p>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {filteredPayments.map(p => (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <PaymentMethodBadge method={p.method} />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{p.date}</span>
                          <button
                            onClick={() => setConfirmDeletePayment(p.id)}
                            className="p-1 text-gray-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          {p.reference_number && (
                            <p className="text-xs text-gray-500">Ref: {p.reference_number}</p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-green-600">{formatPeso(p.amount)}</p>
                      </div>
                      <button
                        onClick={() => setSignatureModal({ image: p.signature_image, date: p.date, amount: p.amount })}
                        className="mt-2 text-xs text-blue-600 font-medium"
                      >
                        View Signature
                      </button>
                      {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}

                      {/* Delete Confirmation */}
                      {confirmDeletePayment === p.id && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                          <button
                            onClick={() => setConfirmDeletePayment(null)}
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
              )}
            </>
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
                <img
                  src={signatureModal.image}
                  alt="Client signature"
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
