import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
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
    await db.disbursements.add(disbursement);

    if (data.status === 'success') {
      // Deduct from capital batch
      await db.capital_purchases.where('id').equals(data.capital_purchase_id).modify(batch => {
        batch.remaining_balance -= data.face_value;
      });
      // Add to client's outstanding balance
      await db.clients.where('id').equals(data.client_id).modify(c => {
        c.total_load_received += data.selling_price;
        c.outstanding_balance = c.total_load_received - c.total_paid;
        c.updated_at = new Date().toISOString();
      });
    }

    return disbursement;
  }

  async function getDisbursementsByClient(clientId: string) {
    return db.disbursements.where('client_id').equals(clientId).reverse().sortBy('created_at');
  }

  async function getTodayDisbursements() {
    const today = new Date().toISOString().split('T')[0];
    return db.disbursements.where('date').equals(today).toArray();
  }

  return {
    disbursements: disbursements ?? [],
    addDisbursement,
    getDisbursementsByClient,
    getTodayDisbursements,
  };
}
