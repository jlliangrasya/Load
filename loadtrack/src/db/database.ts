import Dexie, { type Table } from 'dexie';
import type { CapitalPurchase, Client, Disbursement, Payment, AppSettings, CollectionItem, Expense, CommissionLog } from '../types';

export class LoadTrackDB extends Dexie {
  capital_purchases!: Table<CapitalPurchase, string>;
  clients!: Table<Client, string>;
  disbursements!: Table<Disbursement, string>;
  payments!: Table<Payment, string>;
  app_settings!: Table<AppSettings, number>;
  collection_list!: Table<CollectionItem, string>;
  expenses!: Table<Expense, string>;
  commission_logs!: Table<CommissionLog, string>;

  constructor() {
    super('LoadTrackDB');
    this.version(1).stores({
      capital_purchases: 'id, date, network, created_at',
      clients: 'id, name, contact_number, created_at',
      disbursements: 'id, client_id, date, network, status, capital_purchase_id, created_at',
      payments: 'id, client_id, date, method, created_at',
      app_settings: 'id',
    });
    this.version(2).stores({
      capital_purchases: 'id, date, network, created_at',
      clients: 'id, name, contact_number, created_at',
      disbursements: 'id, client_id, date, network, status, capital_purchase_id, created_at',
      payments: 'id, client_id, date, method, created_at',
      app_settings: 'id',
      collection_list: 'id, client_id, collected, created_at',
    }).upgrade(tx => {
      return tx.table('app_settings').toCollection().modify(s => {
        if (s.auto_markup_enabled === undefined) s.auto_markup_enabled = 1;
      });
    });
    this.version(3).stores({
      capital_purchases: 'id, date, network, created_at',
      clients: 'id, name, contact_number, created_at',
      disbursements: 'id, client_id, date, network, status, capital_purchase_id, created_at',
      payments: 'id, client_id, date, method, created_at',
      app_settings: 'id',
      collection_list: 'id, client_id, collected, created_at',
      expenses: 'id, date, category, created_at',
    });
    this.version(4).stores({
      capital_purchases: 'id, date, network, created_at',
      clients: 'id, name, contact_number, created_at, last_activity',
      disbursements: 'id, client_id, date, network, status, capital_purchase_id, created_at',
      payments: 'id, client_id, date, method, created_at',
      app_settings: 'id',
      collection_list: 'id, client_id, collected, created_at',
      expenses: 'id, date, category, created_at',
      commission_logs: 'id, date, network, created_at',
    });
  }
}

export const db = new LoadTrackDB();

export async function recalculateClientBalance(clientId: string) {
  const disbursements = await db.disbursements.where('client_id').equals(clientId).toArray();
  const payments = await db.payments.where('client_id').equals(clientId).toArray();
  const totalReceived = disbursements
    .filter(d => d.status === 'success')
    .reduce((s, d) => s + d.selling_price, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  await db.clients.update(clientId, {
    total_load_received: totalReceived,
    total_paid: totalPaid,
    outstanding_balance: totalReceived - totalPaid,
    updated_at: new Date().toISOString(),
  });
}

/** Update the client's last_activity timestamp */
export async function touchClientActivity(clientId: string) {
  await db.clients.update(clientId, { last_activity: new Date().toISOString() });
}
