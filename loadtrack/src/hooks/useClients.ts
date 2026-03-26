import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Client } from '../types';
import { v4 as uuid } from 'uuid';

export function useClients() {
  const clients = useLiveQuery(
    () => db.clients.orderBy('name').toArray(),
    []
  );

  async function addClient(data: {
    name: string;
    contact_number: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const now = new Date().toISOString();
    const client: Client = {
      id: uuid(),
      name: data.name,
      contact_number: data.contact_number,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      total_load_received: 0,
      total_paid: 0,
      outstanding_balance: 0,
      created_at: now,
      updated_at: now,
    };
    await db.clients.add(client);
    return client;
  }

  async function updateClient(id: string, data: Partial<Client>) {
    await db.clients.update(id, { ...data, updated_at: new Date().toISOString() });
  }

  /** Cascade delete: removes client + all their disbursements, payments, and collection items */
  async function deleteClient(id: string) {
    await db.transaction('rw', [db.clients, db.disbursements, db.payments, db.collection_list], async () => {
      // Restore capital for successful disbursements before deleting
      const disbursements = await db.disbursements.where('client_id').equals(id).toArray();
      for (const d of disbursements) {
        if (d.status === 'success') {
          await db.capital_purchases.where('id').equals(d.capital_purchase_id).modify(batch => {
            batch.remaining_balance += d.face_value;
          });
        }
      }
      await db.disbursements.where('client_id').equals(id).delete();
      await db.payments.where('client_id').equals(id).delete();
      await db.collection_list.where('client_id').equals(id).delete();
      await db.clients.delete(id);
    });
  }

  async function getClient(id: string) {
    return db.clients.get(id);
  }

  return {
    clients: clients ?? [],
    addClient,
    updateClient,
    deleteClient,
    getClient,
  };
}
