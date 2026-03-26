import { db } from '../db/database';

export async function exportBackup(): Promise<string> {
  const [capitals, clients, disbursements, payments, settings, collection, expenses, commissionLogs] = await Promise.all([
    db.capital_purchases.toArray(),
    db.clients.toArray(),
    db.disbursements.toArray(),
    db.payments.toArray(),
    db.app_settings.toArray(),
    db.collection_list.toArray(),
    db.expenses.toArray(),
    db.commission_logs.toArray(),
  ]);
  const data = {
    version: 4,
    exported_at: new Date().toISOString(),
    capital_purchases: capitals,
    clients,
    disbursements,
    payments,
    app_settings: settings,
    collection_list: collection,
    expenses,
    commission_logs: commissionLogs,
  };
  return JSON.stringify(data, null, 2);
}

export async function importBackup(jsonStr: string) {
  const data = JSON.parse(jsonStr);
  if (!data.version || !data.clients) {
    throw new Error('Invalid backup file');
  }

  await db.transaction('rw',
    [db.capital_purchases, db.clients, db.disbursements, db.payments, db.app_settings, db.collection_list, db.expenses, db.commission_logs],
    async () => {
      await db.capital_purchases.clear();
      await db.clients.clear();
      await db.disbursements.clear();
      await db.payments.clear();
      await db.app_settings.clear();
      await db.collection_list.clear();
      await db.expenses.clear();
      await db.commission_logs.clear();

      // Import
      if (data.capital_purchases?.length) await db.capital_purchases.bulkAdd(data.capital_purchases);
      if (data.clients?.length) await db.clients.bulkAdd(data.clients);
      if (data.disbursements?.length) await db.disbursements.bulkAdd(data.disbursements);
      if (data.payments?.length) await db.payments.bulkAdd(data.payments);
      if (data.app_settings?.length) await db.app_settings.bulkAdd(data.app_settings);
      if (data.collection_list?.length) await db.collection_list.bulkAdd(data.collection_list);
      if (data.expenses?.length) await db.expenses.bulkAdd(data.expenses);
      if (data.commission_logs?.length) await db.commission_logs.bulkAdd(data.commission_logs);
    }
  );
}

export function downloadBackup(jsonStr: string) {
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `loadtrack-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
