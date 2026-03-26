import Dexie, { type Table } from 'dexie';
import type { CapitalPurchase, Client, Disbursement, Payment, AppSettings } from '../types';

export class LoadTrackDB extends Dexie {
  capital_purchases!: Table<CapitalPurchase, string>;
  clients!: Table<Client, string>;
  disbursements!: Table<Disbursement, string>;
  payments!: Table<Payment, string>;
  app_settings!: Table<AppSettings, number>;

  constructor() {
    super('LoadTrackDB');
    this.version(1).stores({
      capital_purchases: 'id, date, network, created_at',
      clients: 'id, name, contact_number, created_at',
      disbursements: 'id, client_id, date, network, status, capital_purchase_id, created_at',
      payments: 'id, client_id, date, method, created_at',
      app_settings: 'id',
    });
  }
}

export const db = new LoadTrackDB();
