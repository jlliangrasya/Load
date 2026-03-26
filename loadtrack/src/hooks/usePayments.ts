import { useLiveQuery } from 'dexie-react-hooks';
import { db, recalculateClientBalance, touchClientActivity } from '../db/database';
import type { Payment } from '../types';
import { v4 as uuid } from 'uuid';

export function usePayments() {
  const payments = useLiveQuery(
    () => db.payments.orderBy('created_at').reverse().toArray(),
    []
  );

  async function addPayment(data: {
    client_id: string;
    date: string;
    amount: number;
    method: 'cash' | 'gcash' | 'online_transfer';
    reference_number?: string;
    signature_image: string;
    disbursement_ids?: string[];
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: uuid(),
      client_id: data.client_id,
      date: data.date,
      amount: data.amount,
      method: data.method,
      reference_number: data.reference_number,
      signature_image: data.signature_image,
      disbursement_ids: data.disbursement_ids,
      notes: data.notes,
      created_at: now,
    };

    await db.transaction('rw', [db.payments, db.clients], async () => {
      await db.payments.add(payment);
      await db.clients.where('id').equals(data.client_id).modify(c => {
        c.total_paid += data.amount;
        c.outstanding_balance = c.total_load_received - c.total_paid;
        c.updated_at = now;
      });
    });

    await touchClientActivity(data.client_id);
    return payment;
  }

  /** Delete a payment and recalculate client balance from source of truth */
  async function deletePayment(id: string) {
    const p = await db.payments.get(id);
    if (!p) return;

    await db.transaction('rw', [db.payments, db.clients], async () => {
      await db.payments.delete(id);
      await recalculateClientBalance(p.client_id);
    });
  }

  async function getPaymentsByClient(clientId: string) {
    return db.payments.where('client_id').equals(clientId).reverse().sortBy('created_at');
  }

  return {
    payments: payments ?? [],
    addPayment,
    deletePayment,
    getPaymentsByClient,
  };
}
