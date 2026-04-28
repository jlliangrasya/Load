import { supabase } from '../lib/supabase';
import { formatPeso } from './currency';
import { format, parseISO } from 'date-fns';

/**
 * Generate a shareable plain-text client statement.
 */
export async function generateClientStatement(clientId: string): Promise<string> {
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (!client) throw new Error(`Client ${clientId} not found`);

  const { data: disbursements } = await supabase.from('disbursements').select('*').eq('client_id', clientId).order('date');
  const { data: payments } = await supabase.from('payments').select('*').eq('client_id', clientId).order('date');
  const { data: settings } = await supabase.from('app_settings').select('business_name').eq('id', 1).single();
  const businessName = settings?.business_name ?? 'LoadTrack';

  const successDisbursements = (disbursements ?? []).filter((d: { status: string }) => d.status === 'success');

  const totalReceived = successDisbursements.reduce((sum: number, d: { selling_price: number }) => sum + d.selling_price, 0);
  const totalPaid = (payments ?? []).reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
  const balance = totalReceived - totalPaid;

  const today = format(new Date(), 'MMMM d, yyyy');
  const border = '═══════════════════════════════';
  const divider = '───────────────────────────────';
  const subtotal = '──────────';

  const lines: string[] = [];

  // Header
  lines.push(border);
  lines.push(businessName.toUpperCase());
  lines.push('Client Statement');
  lines.push(border);
  lines.push(`Client: ${client.name}`);
  lines.push(`Contact: ${client.contact_number}`);
  lines.push(`As of: ${today}`);
  lines.push(divider);
  lines.push('');

  // Load Received
  lines.push('LOAD RECEIVED:');
  for (const d of successDisbursements as { date: string; network: string; selling_price: number }[]) {
    const dateStr = format(parseISO(d.date), 'MMM d');
    const network = d.network.charAt(0).toUpperCase() + d.network.slice(1);
    const amount = formatPeso(d.selling_price);
    lines.push(`  ${dateStr.padEnd(8)}${network.padEnd(7)}${amount}`);
  }
  lines.push(`${''.padEnd(15)}${subtotal}`);
  lines.push(`  Total Received: ${formatPeso(totalReceived)}`);
  lines.push('');

  // Payments
  lines.push('PAYMENTS:');
  for (const p of (payments ?? []) as { date: string; method: string; amount: number }[]) {
    const dateStr = format(parseISO(p.date), 'MMM d');
    const method = formatMethod(p.method);
    const amount = formatPeso(p.amount);
    lines.push(`  ${dateStr.padEnd(8)}${method.padEnd(7)}${amount}`);
  }
  lines.push(`${''.padEnd(15)}${subtotal}`);
  lines.push(`  Total Paid:     ${formatPeso(totalPaid)}`);
  lines.push('');

  // Footer
  lines.push(divider);
  lines.push(`OUTSTANDING BALANCE: ${formatPeso(balance)}`);
  lines.push(border);

  return lines.join('\n');
}

function formatMethod(method: string): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'gcash':
      return 'GCash';
    case 'online_transfer':
      return 'Transfer';
    default:
      return method;
  }
}

/**
 * Share or copy the statement text.
 * Returns 'shared' | 'copied' | 'failed'.
 */
export async function shareClientStatement(text: string): Promise<string> {
  // Try native share API first (mobile)
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch {
      // User cancelled or share failed – fall through to clipboard
    }
  }

  // Fall back to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
