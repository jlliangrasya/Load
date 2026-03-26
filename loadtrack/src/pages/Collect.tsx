import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Trash2, CheckCircle, ClipboardList, PenTool, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { db } from '../db/database';
import { formatPeso } from '../utils/currency';
import PageHeader from '../components/layout/PageHeader';
import SignaturePad from '../components/signature/SignaturePad';
import NetworkBadge from '../components/shared/NetworkBadge';
import StatusBadge from '../components/shared/StatusBadge';
import PaymentMethodBadge from '../components/shared/PaymentMethodBadge';
import EmptyState from '../components/shared/EmptyState';
import toast from 'react-hot-toast';
import type { Client, Disbursement, Payment } from '../types';

export default function Collect() {
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);
  const [signingItemId, setSigningItemId] = useState<string | null>(null);
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [clientDisbursements, setClientDisbursements] = useState<Disbursement[]>([]);
  const [clientPayments, setClientPayments] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Bulk select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);
  const [isBulkCollecting, setIsBulkCollecting] = useState(false);

  const items = useLiveQuery(
    () => db.collection_list.orderBy('created_at').toArray(),
    []
  );

  const clientsMap = useLiveQuery(
    () => db.clients.toArray().then(cs => {
      const m: Record<string, Client> = {};
      cs.forEach(c => { m[c.id] = c; });
      return m;
    }), []
  );

  const pendingItems = items?.filter(i => !i.collected) ?? [];
  const collectedItems = items?.filter(i => i.collected) ?? [];

  // Sync collection item amounts with live client balances
  useEffect(() => {
    if (!clientsMap || !items) return;
    const pendingOnly = items.filter(i => !i.collected);
    pendingOnly.forEach(item => {
      const client = clientsMap[item.client_id];
      if (!client) return;
      const liveBalance = client.outstanding_balance;
      // If the client's outstanding balance has changed (e.g. paid elsewhere),
      // update the collection item amount to match the live balance.
      if (liveBalance >= 0 && liveBalance !== item.amount) {
        if (liveBalance === 0) {
          // Client is fully paid — mark as collected automatically
          db.collection_list.update(item.id, { collected: 1, amount: 0 }).catch(err => {
            console.error('Failed to auto-mark collected:', err);
          });
        } else {
          db.collection_list.update(item.id, { amount: liveBalance }).catch(err => {
            console.error('Failed to sync collection amount:', err);
          });
        }
      }
    });
  }, [clientsMap, items]);

  const totalToCollect = pendingItems.reduce((s, i) => s + i.amount, 0);
  const totalCollected = collectedItems.reduce((s, i) => s + i.amount, 0);

  // Load transaction history when a client is expanded
  useEffect(() => {
    if (!expandedItemId) {
      setClientDisbursements([]);
      setClientPayments([]);
      return;
    }
    const item = items?.find(i => i.id === expandedItemId);
    if (!item) return;

    setLoadingHistory(true);
    Promise.all([
      db.disbursements.where('client_id').equals(item.client_id).toArray(),
      db.payments.where('client_id').equals(item.client_id).toArray(),
    ]).then(([disb, pay]) => {
      setClientDisbursements(disb.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setClientPayments(pay.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setLoadingHistory(false);
    }).catch(err => {
      toast.error('Failed to load transaction history');
      console.error(err);
      setLoadingHistory(false);
    });
  }, [expandedItemId, items]);

  const handleToggleExpand = (itemId: string) => {
    setExpandedItemId(expandedItemId === itemId ? null : itemId);
  };

  const getEffectiveMax = useCallback((item: { client_id: string; amount: number }): number => {
    // Use the live client outstanding_balance as the true max
    const client = clientsMap?.[item.client_id];
    if (client && client.outstanding_balance >= 0) {
      return client.outstanding_balance;
    }
    return item.amount;
  }, [clientsMap]);

  const getPayAmount = (itemId: string, maxAmount: number): number => {
    const custom = payAmounts[itemId];
    if (custom !== undefined && custom !== '') {
      const parsed = parseFloat(custom);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return maxAmount;
  };

  const handleStartCollect = (itemId: string) => {
    const item = items?.find(i => i.id === itemId);
    if (!item) return;
    const effectiveMax = getEffectiveMax(item);
    const amount = getPayAmount(itemId, effectiveMax);
    if (amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount > effectiveMax) {
      toast.error(`Amount cannot exceed outstanding balance of ${formatPeso(effectiveMax)}`);
      return;
    }
    setSigningItemId(itemId);
  };

  const handleClearList = async () => {
    try {
      await db.collection_list.clear();
      setConfirmClear(false);
      setSelectedIds(new Set());
      toast.success('Collection list cleared');
    } catch (err) {
      toast.error('Failed to clear collection list');
      console.error(err);
    }
  };

  const handleRemoveItem = async (id: string) => {
    try {
      await db.collection_list.delete(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Removed from list');
    } catch (err) {
      toast.error('Failed to remove item');
      console.error(err);
    }
  };

  const handleSignatureConfirm = async (signatureDataUrl: string) => {
    if (!signingItemId) return;

    try {
      const item = await db.collection_list.get(signingItemId);
      if (!item) { toast.error('Collection item not found'); return; }

      const client = await db.clients.get(item.client_id);
      if (!client) { toast.error('Client not found'); return; }

      const effectiveMax = client.outstanding_balance;
      const payAmount = getPayAmount(signingItemId, effectiveMax);

      if (payAmount <= 0) { toast.error('Invalid payment amount'); return; }
      if (payAmount > effectiveMax) {
        toast.error(`Amount exceeds outstanding balance of ${formatPeso(effectiveMax)}`);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Record the payment
      await db.payments.add({
        id: uuid(),
        client_id: item.client_id,
        date: today,
        amount: payAmount,
        method: 'cash',
        signature_image: signatureDataUrl,
        created_at: now,
      });

      // Update client balance
      await db.clients.where('id').equals(item.client_id).modify(c => {
        c.total_paid += payAmount;
        c.outstanding_balance = c.total_load_received - c.total_paid;
        c.updated_at = now;
      });

      const remaining = effectiveMax - payAmount;

      if (remaining <= 0) {
        // Fully paid -- mark as collected
        await db.collection_list.update(signingItemId, {
          collected: 1,
          signature_image: signatureDataUrl,
        });
        toast.success(`${formatPeso(payAmount)} collected -- fully paid!`);
      } else {
        // Partial -- update the remaining amount on the collection item
        await db.collection_list.update(signingItemId, {
          amount: remaining,
        });
        toast.success(`${formatPeso(payAmount)} collected -- ${formatPeso(remaining)} remaining`);
      }
    } catch (err) {
      toast.error('Failed to process collection');
      console.error(err);
    }

    // Clean up signing state
    const completedId = signingItemId;
    setSigningItemId(null);
    setPayAmounts(prev => { const n = { ...prev }; delete n[completedId]; return n; });

    // If we are in bulk mode, advance to the next item
    if (isBulkCollecting) {
      setBulkQueue(prev => {
        const remaining = prev.filter(id => id !== completedId);
        if (remaining.length > 0) {
          // Start collecting the next item
          setTimeout(() => {
            const nextId = remaining[0];
            const nextItem = items?.find(i => i.id === nextId);
            if (nextItem) {
              const nextMax = clientsMap?.[nextItem.client_id]?.outstanding_balance ?? nextItem.amount;
              if (nextMax <= 0) {
                // Skip items with zero balance
                setBulkQueue(r => r.filter(id => id !== nextId));
                return;
              }
              setSigningItemId(nextId);
            }
          }, 300);
        } else {
          setIsBulkCollecting(false);
          setSelectedIds(new Set());
          toast.success('Bulk collection complete!');
        }
        return remaining;
      });
    }
  };

  // --- Bulk select handlers ---
  const handleToggleSelect = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map(i => i.id)));
    }
  };

  const handleCollectSelected = () => {
    const queue = pendingItems
      .filter(i => selectedIds.has(i.id))
      .filter(i => {
        const max = getEffectiveMax(i);
        return max > 0;
      })
      .map(i => i.id);

    if (queue.length === 0) {
      toast.error('No valid items to collect');
      return;
    }

    setBulkQueue(queue);
    setIsBulkCollecting(true);
    // Start with the first item
    setSigningItemId(queue[0]);
  };

  const handleCancelBulk = () => {
    setSigningItemId(null);
    setBulkQueue([]);
    setIsBulkCollecting(false);
  };

  // Full-screen signature
  if (signingItemId) {
    const sigItem = items?.find(i => i.id === signingItemId);
    const sigClient = sigItem ? clientsMap?.[sigItem.client_id] : null;
    const sigMax = sigItem ? getEffectiveMax(sigItem) : 0;
    const sigAmount = sigItem ? getPayAmount(signingItemId, sigMax) : 0;
    const bulkProgress = isBulkCollecting
      ? `(${bulkQueue.indexOf(signingItemId) + 1} of ${bulkQueue.length})`
      : '';
    return (
      <div>
        {sigClient && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-blue-600 text-white px-4 py-2 text-center">
            <p className="text-sm font-semibold">{sigClient.name} {bulkProgress}</p>
            <p className="text-xs text-blue-200">Collecting {formatPeso(sigAmount)}</p>
          </div>
        )}
        <div className="pt-12">
          <SignaturePad
            onConfirm={handleSignatureConfirm}
            onCancel={isBulkCollecting ? handleCancelBulk : () => setSigningItemId(null)}
          />
        </div>
      </div>
    );
  }

  const isLoading = items === undefined;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageHeader title="To Be Collected" showBack />
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const allSelected = pendingItems.length > 0 && selectedIds.size === pendingItems.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader title="To Be Collected" showBack />

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-medium text-amber-600 uppercase">To Collect</p>
            <p className="text-lg font-bold text-amber-700">{formatPeso(totalToCollect)}</p>
            <p className="text-[10px] text-amber-500">{pendingItems.length} client(s)</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-[10px] font-medium text-green-600 uppercase">Collected</p>
            <p className="text-lg font-bold text-green-700">{formatPeso(totalCollected)}</p>
            <p className="text-[10px] text-green-500">{collectedItems.length} done</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/unpaid')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm"
          >
            + Add from Unpaid
          </button>
          {(items?.length ?? 0) > 0 && (
            !confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-red-300 text-red-600 text-sm font-medium"
              >
                <Trash2 size={14} /> Clear
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-3 rounded-xl border border-gray-300 text-gray-600 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearList}
                  className="px-3 py-3 rounded-xl bg-red-600 text-white text-xs font-medium"
                >
                  Confirm
                </button>
              </div>
            )
          )}
        </div>

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div>
            {/* Section header with Select All */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Pending Collection</h3>
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 active:text-gray-900"
              >
                {allSelected
                  ? <CheckSquare size={16} className="text-blue-600" />
                  : <Square size={16} className="text-gray-400" />
                }
                Select All
              </button>
            </div>

            {/* Collect Selected button */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleCollectSelected}
                className="w-full mb-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold active:bg-blue-700"
              >
                <PenTool size={16} />
                Collect Selected ({selectedIds.size})
              </button>
            )}

            <div className="space-y-3">
              {pendingItems.map(item => {
                const client = clientsMap?.[item.client_id];
                const isExpanded = expandedItemId === item.id;
                const effectiveMax = getEffectiveMax(item);
                const customAmount = payAmounts[item.id];
                const isPartial = customAmount !== undefined && customAmount !== '' && parseFloat(customAmount) !== effectiveMax;
                const isSelected = selectedIds.has(item.id);

                return (
                  <div key={item.id} className={`bg-white rounded-xl border overflow-hidden ${isSelected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-amber-200'}`}>
                    {/* Header -- tap to expand, with checkbox */}
                    <div className="flex items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleSelect(item.id); }}
                        className="pl-4 pr-2 py-3 flex items-center"
                      >
                        {isSelected
                          ? <CheckSquare size={18} className="text-blue-600" />
                          : <Square size={18} className="text-gray-300" />
                        }
                      </button>
                      <button
                        onClick={() => handleToggleExpand(item.id)}
                        className="flex-1 pr-4 py-3 flex items-center justify-between"
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold text-gray-900">{client?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{client?.contact_number}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-red-600">{formatPeso(effectiveMax)}</p>
                          {isExpanded
                            ? <ChevronUp size={16} className="text-gray-400" />
                            : <ChevronDown size={16} className="text-gray-400" />
                          }
                        </div>
                      </button>
                    </div>

                    {/* Expanded: Transaction History */}
                    {isExpanded && (
                      <div className="border-t border-amber-100 px-4 py-3 space-y-3">
                        {loadingHistory ? (
                          <div className="py-4 text-center text-xs text-gray-400">Loading history...</div>
                        ) : (
                          <>
                            {/* Disbursements (loads received) */}
                            <div>
                              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Load Received</p>
                              {clientDisbursements.filter(d => d.status === 'success').length === 0 ? (
                                <p className="text-xs text-gray-400">No disbursements</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {clientDisbursements.filter(d => d.status === 'success').map(d => (
                                    <div key={d.id} className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <NetworkBadge network={d.network} />
                                        <span className="text-xs text-gray-600">{d.date}</span>
                                      </div>
                                      <span className="text-xs font-semibold text-blue-700">+{formatPeso(d.selling_price)}</span>
                                    </div>
                                  ))}
                                  {clientDisbursements.filter(d => d.status !== 'success').map(d => (
                                    <div key={d.id} className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between opacity-60">
                                      <div className="flex items-center gap-2">
                                        <StatusBadge status={d.status} />
                                        <span className="text-xs text-gray-500">{d.date}</span>
                                      </div>
                                      <span className="text-xs text-gray-500 line-through">{formatPeso(d.selling_price)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Payments */}
                            <div>
                              <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Payments Made</p>
                              {clientPayments.length === 0 ? (
                                <p className="text-xs text-gray-400">No payments yet</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {clientPayments.map(p => (
                                    <div key={p.id} className="bg-green-50 rounded-lg px-3 py-2 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <PaymentMethodBadge method={p.method} />
                                        <span className="text-xs text-gray-600">{p.date}</span>
                                      </div>
                                      <span className="text-xs font-semibold text-green-700">-{formatPeso(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Balance Summary */}
                            <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-600">Outstanding Balance</span>
                              <span className="text-sm font-bold text-red-600">
                                {formatPeso(client?.outstanding_balance ?? item.amount)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Collect Controls */}
                    <div className="border-t border-amber-100 px-4 py-3 space-y-2">
                      {/* Custom amount input */}
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Amount to collect</label>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={customAmount ?? ''}
                            onChange={e => setPayAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder={String(effectiveMax)}
                            max={effectiveMax}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <button
                          onClick={() => setPayAmounts(prev => ({ ...prev, [item.id]: String(effectiveMax) }))}
                          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium whitespace-nowrap"
                        >
                          Full: {formatPeso(effectiveMax)}
                        </button>
                      </div>

                      {isPartial && (
                        <p className="text-[10px] text-amber-600">
                          Partial payment -- {formatPeso(effectiveMax - (parseFloat(customAmount) || 0))} will remain on the list
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartCollect(item.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold active:bg-green-700"
                        >
                          <PenTool size={14} /> Collect with Signature
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="py-2.5 px-3 rounded-lg bg-gray-100 text-gray-500 text-xs"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collected Items */}
        {collectedItems.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Collected</h3>
            <div className="space-y-2">
              {collectedItems.map(item => {
                const client = clientsMap?.[item.client_id];
                return (
                  <div key={item.id} className="bg-green-50 rounded-xl border border-green-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle size={20} className="text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{client?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-green-600 font-medium">Paid with signature</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-green-700">{formatPeso(item.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(items?.length ?? 0) === 0 && (
          <EmptyState
            icon={<ClipboardList size={48} />}
            title="No collection list yet"
            description="Go to the Unpaid page to add clients you need to collect from today."
            action={
              <button
                onClick={() => navigate('/unpaid')}
                className="px-6 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold active:bg-amber-600"
              >
                Go to Unpaid List
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
