import Dexie from 'dexie';
import { supabase } from '../lib/supabase';

const MIGRATION_KEY = 'loadtrack_migrated_to_supabase';

class OldDB extends Dexie {
  capital_purchases!: Dexie.Table;
  clients!: Dexie.Table;
  disbursements!: Dexie.Table;
  payments!: Dexie.Table;
  app_settings!: Dexie.Table;
  collection_list!: Dexie.Table;
  expenses!: Dexie.Table;
  commission_logs!: Dexie.Table;

  constructor() {
    super('LoadTrackDB');
    this.version(1).stores({
      capital_purchases: 'id',
      clients: 'id',
      disbursements: 'id',
      payments: 'id',
      app_settings: 'id',
    });
    this.version(2).stores({ collection_list: 'id' });
    this.version(3).stores({ expenses: 'id' });
    this.version(4).stores({ commission_logs: 'id' });
    this.version(5).stores({});
    this.version(6).stores({});
  }
}

export async function migrateFromDexieIfNeeded(
  onProgress?: (msg: string) => void
): Promise<boolean> {
  // Already migrated
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  let oldDb: OldDB | null = null;
  try {
    // Check if the old IndexedDB database exists
    const dbNames = await indexedDB.databases?.();
    const exists = dbNames
      ? dbNames.some(d => d.name === 'LoadTrackDB')
      : true; // older browsers don't support .databases(), assume it might exist

    if (!exists) {
      localStorage.setItem(MIGRATION_KEY, '1');
      return false;
    }

    oldDb = new OldDB();
    const clientCount = await oldDb.clients.count();
    if (clientCount === 0) {
      localStorage.setItem(MIGRATION_KEY, '1');
      oldDb.close();
      return false;
    }

    onProgress?.(`Migrating ${clientCount} clients from local storage to cloud...`);

    const [capitals, clients, disbursements, payments, settings, collection, expenses, commissionLogs] =
      await Promise.all([
        oldDb.capital_purchases.toArray(),
        oldDb.clients.toArray(),
        oldDb.disbursements.toArray(),
        oldDb.payments.toArray(),
        oldDb.app_settings.toArray(),
        oldDb.collection_list.toArray(),
        oldDb.expenses.toArray(),
        oldDb.commission_logs.toArray(),
      ]);

    // Check if Supabase already has data — don't overwrite
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    if ((count ?? 0) > 0) {
      // Supabase already has data, skip migration
      localStorage.setItem(MIGRATION_KEY, '1');
      oldDb.close();
      return false;
    }

    onProgress?.('Uploading your data to the cloud...');

    // Upload in dependency order
    if (capitals.length) await supabase.from('capital_purchases').insert(capitals);
    if (clients.length) await supabase.from('clients').insert(clients);
    if (disbursements.length) await supabase.from('disbursements').insert(disbursements);
    if (payments.length) await supabase.from('payments').insert(payments);
    if (collection.length) await supabase.from('collection_list').insert(collection);
    if (expenses.length) await supabase.from('expenses').insert(expenses);
    if (commissionLogs.length) await supabase.from('commission_logs').insert(commissionLogs);
    if (settings.length) await supabase.from('app_settings').upsert(settings);

    localStorage.setItem(MIGRATION_KEY, '1');
    oldDb.close();

    onProgress?.(`Migration complete! ${clients.length} clients uploaded.`);
    return true;
  } catch (err) {
    console.error('Migration failed:', err);
    oldDb?.close();
    return false;
  }
}
