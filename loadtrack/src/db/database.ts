import { supabase } from '../lib/supabase';
import type { AppSettings } from '../types';

/** Default settings values — used as fallback everywhere */
export const SETTINGS_DEFAULTS = {
  auto_markup_enabled: 0,
  discount_enabled: 0,
  discount_rates: '2,3,5',
  hide_selling_if_equal: 1,
  default_smart_markup: 0,
  default_globe_markup: 0,
  owner_name: '',
  business_name: 'LoadTrack',
  pin: '0000',
};

export async function getSettingsWithDefaults(): Promise<AppSettings> {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
  if (data) {
    const patched = { ...SETTINGS_DEFAULTS, ...data } as AppSettings;
    return patched;
  }
  const defaults = { id: 1, ...SETTINGS_DEFAULTS } as AppSettings;
  await supabase.from('app_settings').insert(defaults);
  return defaults;
}

export async function updateSettings(patch: Partial<AppSettings>) {
  await supabase.from('app_settings').update(patch).eq('id', 1);
}

export async function recalculateClientBalance(clientId: string) {
  const { data: disbursements } = await supabase
    .from('disbursements')
    .select('selling_price, status')
    .eq('client_id', clientId);

  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('client_id', clientId);

  const totalReceived = (disbursements ?? [])
    .filter((d: { status: string }) => d.status === 'success')
    .reduce((s: number, d: { selling_price: number }) => s + d.selling_price, 0);

  const totalPaid = (payments ?? [])
    .reduce((s: number, p: { amount: number }) => s + p.amount, 0);

  await supabase.from('clients').update({
    total_load_received: totalReceived,
    total_paid: totalPaid,
    outstanding_balance: totalReceived - totalPaid,
    updated_at: new Date().toISOString(),
  }).eq('id', clientId);
}

export async function touchClientActivity(clientId: string) {
  await supabase.from('clients').update({
    last_activity: new Date().toISOString(),
  }).eq('id', clientId);
}
