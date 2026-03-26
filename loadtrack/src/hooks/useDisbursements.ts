import { useLiveQuery } from 'dexie-react-hooks';
import { db, recalculateClientBalance, touchClientActivity } from '../db/database';
import type { Disbursement } from '../types';
import { v4 as uuid } from 'uuid';

export function useDisbursements() {
  const disbursements = useLiveQuery(
    () => db.disbursements.orderBy('created_at').reverse().toArray(),
    []
  );

  async function addDisbursement(data: {
    client_id: string;
    date: string;
    network: 'smart' | 'globe';
    face_value: number;
    selling_price: number;
    status: 'success' | 'failed' | 'returned';
    failure_reason?: string;
    capital_purchase_id: string;
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const disbursement: Disbursement = {
      id: uuid(),
      client_id: data.client_id,
      date: data.date,
      network: data.network,
      face_value: data.face_value,
      selling_price: data.selling_price,
      markup: data.selling_price - data.face_value,
      status: data.status,
      failure_reason: data.failure_reason,
      capital_purchase_id: data.capital_purchase_id,
      notes: data.notes,
      created_at: now,
    };

    await db.transaction('rw', [db.disbursements, db.capital_purchases, db.clients], async () => {
      await db.disbursements.add(disbursement);
      if (data.status === 'success') {
        await db.capital_purchases.where('id').equals(data.capital_purchase_id).modify(batch => {
          batch.remaining_balance = Math.max(0, batch.remaining_balance - data.face_value);
        });
        await db.clients.where('id').equals(data.client_id).modify(c => {
          c.total_load_received += data.selling_price;
          c.outstanding_balance = c.total_load_received - c.total_paid;
          c.updated_at = now;
        });
      }
    });

    await touchClientActivity(data.client_id);
    return disbursement;
  }

  /** Delete a disbursement and reverse its effects on capital + client balance */
  async function deleteDisbursement(id: string) {
    const d = await db.disbursements.get(id);
    if (!d) return;

    await db.transaction('rw', [db.disbursements, db.capital_purchases, db.clients], async () => {
      await db.disbursements.delete(id);
      if (d.status === 'success') {
        // Restore capital
        await db.capital_purchases.where('id').equals(d.capital_purchase_id).modify(batch => {
          batch.remaining_balance += d.face_value;
        });
      }
      // Always recalculate from source of truth
      await recalculateClientBalance(d.client_id);
    });
  }

  async function getDisbursementsByClient(clientId: string) {
    return db.disbursements.where('client_id').equals(clientId).reverse().sortBy('created_at');
  }

  return {
    disbursements: disbursements ?? [],
    addDisbursement,
    deleteDisbursement,
    getDisbursementsByClient,
  };
}
