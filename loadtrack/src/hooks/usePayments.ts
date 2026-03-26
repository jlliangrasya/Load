import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
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
      notes: data.notes,
      created_at: now,
    };
    await db.payments.add(payment);

    // Update client totals
    await db.clients.where('id').equals(data.client_id).modify(c => {
      c.total_paid += data.amount;
      c.outstanding_balance = c.total_load_received - c.total_paid;
      c.updated_at = new Date().toISOString();
    });

    return payment;
  }

  async function getPaymentsByClient(clientId: string) {
    return db.payments.where('client_id').equals(clientId).reverse().sortBy('created_at');
  }

  async function getTodayPayments() {
    const today = new Date().toISOString().split('T')[0];
    return db.payments.where('date').equals(today).toArray();
  }

  return {
    payments: payments ?? [],
    addPayment,
    getPaymentsByClient,
    getTodayPayments,
  };
}
