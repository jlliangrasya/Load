import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatPeso } from './currency';
import { db } from '../db/database';
import type { Disbursement, Payment } from '../types';

async function getClientName(clientId: string): Promise<string> {
  const c = await db.clients.get(clientId);
  return c?.name ?? 'Unknown';
}

async function getSettings() {
  const s = await db.app_settings.get(1);
  return { businessName: s?.business_name ?? 'LoadTrack', ownerName: s?.owner_name ?? '' };
}

function addHeader(doc: jsPDF, title: string, businessName: string) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 26);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
  doc.setLineWidth(0.5);
  doc.line(14, 35, 196, 35);
}

export async function exportDisbursementsPdf(disbursements: Disbursement[]) {
  const { businessName } = await getSettings();
  const doc = new jsPDF();
  addHeader(doc, 'Disbursements Report', businessName);

  const rows = await Promise.all(
    disbursements.map(async (d) => [
      d.date,
      await getClientName(d.client_id),
      d.network.charAt(0).toUpperCase() + d.network.slice(1),
      formatPeso(d.face_value),
      formatPeso(d.selling_price),
      formatPeso(d.markup),
      d.status.charAt(0).toUpperCase() + d.status.slice(1),
    ])
  );

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Client', 'Network', 'Face Value', 'Selling Price', 'Markup', 'Status']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  doc.save('disbursements-report.pdf');
}

export async function exportPaymentsPdf(payments: Payment[]) {
  const { businessName } = await getSettings();
  const doc = new jsPDF();
  addHeader(doc, 'Payments Report', businessName);

  const methodLabel = (m: string) => m === 'online_transfer' ? 'Online' : m === 'gcash' ? 'GCash' : 'Cash';

  const rows = await Promise.all(
    payments.map(async (p) => [
      p.date,
      await getClientName(p.client_id),
      formatPeso(p.amount),
      methodLabel(p.method),
      p.reference_number ?? '-',
    ])
  );

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Client', 'Amount', 'Method', 'Reference']],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
  });

  doc.save('payments-report.pdf');
}

export async function exportPaymentReceipt(payment: Payment) {
  const { businessName, ownerName } = await getSettings();
  const clientName = await getClientName(payment.client_id);
  const methodLabel = payment.method === 'online_transfer' ? 'Online Transfer' : payment.method === 'gcash' ? 'GCash' : 'Cash';

  const doc = new jsPDF({ format: [80, 150] }); // receipt size

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, 40, 10, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  if (ownerName) doc.text(ownerName, 40, 15, { align: 'center' });
  doc.text('Payment Receipt', 40, 20, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 23, 75, 23);

  let y = 28;
  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label, 5, y);
    doc.setFont('helvetica', 'bold');
    doc.text(value, 75, y, { align: 'right' });
    y += 5;
  };

  line('Date:', payment.date);
  line('Client:', clientName);
  line('Amount:', formatPeso(payment.amount));
  line('Method:', methodLabel);
  if (payment.reference_number) line('Ref #:', payment.reference_number);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y + 2, 75, y + 2);

  y += 8;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Signature:', 5, y);

  if (payment.signature_image && payment.signature_image.length > 100) {
    try {
      doc.addImage(payment.signature_image, 'PNG', 5, y + 2, 65, 20);
    } catch { /* ignore image errors */ }
  }

  doc.save(`receipt-${payment.date}-${clientName.replace(/\s/g, '_')}.pdf`);
}

export async function exportProfitReportPdf(
  period: string,
  summary: {
    total_capital_spent: number;
    total_commission_earned: number;
    total_markup_earned: number;
    gross_profit: number;
    losses_from_failed: number;
    net_profit: number;
  }
) {
  const { businessName } = await getSettings();
  const doc = new jsPDF();
  addHeader(doc, `Profit Report — ${period}`, businessName);

  autoTable(doc, {
    startY: 40,
    head: [['Metric', 'Amount']],
    body: [
      ['Capital Spent', formatPeso(summary.total_capital_spent)],
      ['Commission Earned', formatPeso(summary.total_commission_earned)],
      ['Markup Earned', formatPeso(summary.total_markup_earned)],
      ['Gross Profit', formatPeso(summary.gross_profit)],
      ['Losses (Failed/Returned)', formatPeso(summary.losses_from_failed)],
      ['Net Profit', formatPeso(summary.net_profit)],
    ],
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
  });

  doc.save(`profit-report-${period}.pdf`);
}
