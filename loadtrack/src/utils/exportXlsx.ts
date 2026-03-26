import * as XLSX from 'xlsx';
import { db } from '../db/database';
import type { Disbursement, Payment } from '../types';

async function getClientName(clientId: string): Promise<string> {
  const c = await db.clients.get(clientId);
  return c?.name ?? 'Unknown';
}

export async function exportDisbursementsXlsx(disbursements: Disbursement[]) {
  const rows = await Promise.all(
    disbursements.map(async (d) => ({
      Date: d.date,
      Client: await getClientName(d.client_id),
      Network: d.network.charAt(0).toUpperCase() + d.network.slice(1),
      'Face Value': d.face_value,
      'Selling Price': d.selling_price,
      Markup: d.markup,
      Status: d.status.charAt(0).toUpperCase() + d.status.slice(1),
      'Failure Reason': d.failure_reason ?? '',
      Notes: d.notes ?? '',
    }))
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Disbursements');
  XLSX.writeFile(wb, 'disbursements.xlsx');
}

export async function exportPaymentsXlsx(payments: Payment[]) {
  const methodLabel = (m: string) => m === 'online_transfer' ? 'Online Transfer' : m === 'gcash' ? 'GCash' : 'Cash';

  const rows = await Promise.all(
    payments.map(async (p) => ({
      Date: p.date,
      Client: await getClientName(p.client_id),
      Amount: p.amount,
      Method: methodLabel(p.method),
      'Reference Number': p.reference_number ?? '',
      Notes: p.notes ?? '',
    }))
  );

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Payments');
  XLSX.writeFile(wb, 'payments.xlsx');
}

export async function exportClientsXlsx() {
  const clients = await db.clients.orderBy('name').toArray();
  const rows = clients.map(c => ({
    Name: c.name,
    'Contact Number': c.contact_number,
    Address: c.address ?? '',
    'Total Load Received': c.total_load_received,
    'Total Paid': c.total_paid,
    'Outstanding Balance': c.outstanding_balance,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  XLSX.writeFile(wb, 'clients.xlsx');
}

export async function exportFullReportXlsx(
  period: string,
  summary: {
    total_capital_spent: number;
    total_commission_earned: number;
    total_markup_earned: number;
    gross_profit: number;
    losses_from_failed: number;
    total_expenses: number;
    net_profit: number;
  }
) {
  const summaryRows = [
    { Metric: 'Period', Value: period },
    { Metric: 'Capital Spent', Value: summary.total_capital_spent },
    { Metric: 'Commission Earned', Value: summary.total_commission_earned },
    { Metric: 'Markup Earned', Value: summary.total_markup_earned },
    { Metric: 'Gross Profit', Value: summary.gross_profit },
    { Metric: 'Losses (Failed/Returned)', Value: summary.losses_from_failed },
    { Metric: 'Expenses', Value: summary.total_expenses },
    { Metric: 'Net Profit', Value: summary.net_profit },
  ];

  const ws = XLSX.utils.json_to_sheet(summaryRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Profit Summary');
  XLSX.writeFile(wb, `profit-report-${period}.xlsx`);
}
