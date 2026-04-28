import { supabase } from '../lib/supabase';

export async function exportBackup(): Promise<string> {
  const [
    { data: capitals },
    { data: clients },
    { data: disbursements },
    { data: payments },
    { data: settings },
    { data: collection },
    { data: expenses },
    { data: commissionLogs },
  ] = await Promise.all([
    supabase.from('capital_purchases').select('*'),
    supabase.from('clients').select('*'),
    supabase.from('disbursements').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('app_settings').select('*'),
    supabase.from('collection_list').select('*'),
    supabase.from('expenses').select('*'),
    supabase.from('commission_logs').select('*'),
  ]);

  const data = {
    version: 5,
    exported_at: new Date().toISOString(),
    capital_purchases: capitals ?? [],
    clients: clients ?? [],
    disbursements: disbursements ?? [],
    payments: payments ?? [],
    app_settings: settings ?? [],
    collection_list: collection ?? [],
    expenses: expenses ?? [],
    commission_logs: commissionLogs ?? [],
  };
  return JSON.stringify(data, null, 2);
}

export async function importBackup(jsonStr: string) {
  const data = JSON.parse(jsonStr);
  if (!data.version || !data.clients) {
    throw new Error('Invalid backup file');
  }

  // Delete in dependency order
  await Promise.all([
    supabase.from('disbursements').delete().neq('id', ''),
    supabase.from('payments').delete().neq('id', ''),
    supabase.from('collection_list').delete().neq('id', ''),
    supabase.from('expenses').delete().neq('id', ''),
    supabase.from('commission_logs').delete().neq('id', ''),
  ]);
  await Promise.all([
    supabase.from('clients').delete().neq('id', ''),
    supabase.from('capital_purchases').delete().neq('id', ''),
  ]);

  // Re-insert
  if (data.capital_purchases?.length) await supabase.from('capital_purchases').insert(data.capital_purchases);
  if (data.clients?.length) await supabase.from('clients').insert(data.clients);
  if (data.disbursements?.length) await supabase.from('disbursements').insert(data.disbursements);
  if (data.payments?.length) await supabase.from('payments').insert(data.payments);
  if (data.collection_list?.length) await supabase.from('collection_list').insert(data.collection_list);
  if (data.expenses?.length) await supabase.from('expenses').insert(data.expenses);
  if (data.commission_logs?.length) await supabase.from('commission_logs').insert(data.commission_logs);
  if (data.app_settings?.length) await supabase.from('app_settings').upsert(data.app_settings);
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
