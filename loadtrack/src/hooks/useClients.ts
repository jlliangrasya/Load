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

  async function deleteClient(id: string) {
    await db.clients.delete(id);
  }

  async function addToOutstanding(clientId: string, amount: number) {
    await db.clients.where('id').equals(clientId).modify(c => {
      c.total_load_received += amount;
      c.outstanding_balance = c.total_load_received - c.total_paid;
      c.updated_at = new Date().toISOString();
    });
  }

  async function addPaymentToClient(clientId: string, amount: number) {
    await db.clients.where('id').equals(clientId).modify(c => {
      c.total_paid += amount;
      c.outstanding_balance = c.total_load_received - c.total_paid;
      c.updated_at = new Date().toISOString();
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
    addToOutstanding,
    addPaymentToClient,
    getClient,
  };
}
