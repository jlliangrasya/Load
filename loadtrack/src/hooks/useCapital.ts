import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { CapitalPurchase } from '../types';
import { v4 as uuid } from 'uuid';

export function useCapital() {
  const capitals = useLiveQuery(
    () => db.capital_purchases.orderBy('created_at').reverse().toArray(),
    []
  );

  const smartBalance = useLiveQuery(
    () => db.capital_purchases
      .where('network').equals('smart')
      .toArray()
      .then(items => items.reduce((sum, c) => sum + c.remaining_balance, 0)),
    []
  );

  const globeBalance = useLiveQuery(
    () => db.capital_purchases
      .where('network').equals('globe')
      .toArray()
      .then(items => items.reduce((sum, c) => sum + c.remaining_balance, 0)),
    []
  );

  async function addCapital(data: {
    network: 'smart' | 'globe';
    face_value: number;
    cost_price: number;
    date: string;
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const capital: CapitalPurchase = {
      id: uuid(),
      date: data.date,
      network: data.network,
      face_value: data.face_value,
      cost_price: data.cost_price,
      commission: data.face_value - data.cost_price,
      remaining_balance: data.face_value,
      notes: data.notes,
      created_at: now,
    };
    await db.capital_purchases.add(capital);
    return capital;
  }

  async function getOldestAvailableBatch(network: 'smart' | 'globe') {
    const batches = await db.capital_purchases
      .where('network').equals(network)
      .toArray();
    const sorted = batches
      .filter(b => b.remaining_balance > 0)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return sorted[0] ?? null;
  }

  async function deductFromBatch(batchId: string, amount: number) {
    await db.capital_purchases.where('id').equals(batchId).modify(batch => {
      batch.remaining_balance -= amount;
    });
  }

  async function deleteCapital(id: string) {
    await db.capital_purchases.delete(id);
  }

  return {
    capitals: capitals ?? [],
    smartBalance: smartBalance ?? 0,
    globeBalance: globeBalance ?? 0,
    addCapital,
    getOldestAvailableBatch,
    deductFromBatch,
    deleteCapital,
  };
}
