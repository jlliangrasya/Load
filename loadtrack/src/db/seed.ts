import { db } from './database';
import { v4 as uuid } from 'uuid';
import type { CapitalPurchase, Client, Disbursement, Payment, AppSettings } from '../types';

const PLACEHOLDER_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export async function seedDatabase() {
  const clientCount = await db.clients.count();
  if (clientCount > 0) return; // Already seeded

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

  // Settings
  const settings: AppSettings = {
    id: 1,
    default_smart_markup: 2,
    default_globe_markup: 2,
    owner_name: 'Juan',
    business_name: 'Juan Load Center',
  };
  await db.app_settings.put(settings);

  // Capital Purchases
  const cap1Id = uuid();
  const cap2Id = uuid();
  const cap3Id = uuid();

  const capitals: CapitalPurchase[] = [
    {
      id: cap1Id, date: twoDaysAgo, network: 'smart',
      face_value: 5000, cost_price: 4750, commission: 250,
      remaining_balance: 3500, created_at: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: cap2Id, date: yesterday, network: 'smart',
      face_value: 3000, cost_price: 2850, commission: 150,
      remaining_balance: 2500, created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: cap3Id, date: today, network: 'globe',
      face_value: 4000, cost_price: 3800, commission: 200,
      remaining_balance: 3000, created_at: now,
    },
  ];
  await db.capital_purchases.bulkAdd(capitals);

  // Clients
  const clientIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
  const clients: Client[] = [
    {
      id: clientIds[0], name: 'Maria Santos', contact_number: '09171234567',
      address: 'Brgy. San Jose, Quezon City', latitude: 14.6507, longitude: 121.0495,
      total_load_received: 1520, total_paid: 1020, outstanding_balance: 500,
      created_at: now, updated_at: now,
    },
    {
      id: clientIds[1], name: 'Pedro Cruz', contact_number: '09281234567',
      address: 'Brgy. Poblacion, Makati', latitude: 14.5547, longitude: 121.0244,
      total_load_received: 1020, total_paid: 1020, outstanding_balance: 0,
      created_at: now, updated_at: now,
    },
    {
      id: clientIds[2], name: 'Ana Reyes', contact_number: '09351234567',
      address: 'Brgy. Rizal, Pasig', latitude: 14.5764, longitude: 121.0851,
      total_load_received: 2040, total_paid: 1020, outstanding_balance: 1020,
      created_at: now, updated_at: now,
    },
    {
      id: clientIds[3], name: 'Jose Garcia', contact_number: '09191234567',
      address: 'Brgy. San Antonio, Mandaluyong', latitude: 14.5794, longitude: 121.0359,
      total_load_received: 510, total_paid: 510, outstanding_balance: 0,
      created_at: now, updated_at: now,
    },
    {
      id: clientIds[4], name: 'Rosa Lim', contact_number: '09061234567',
      address: 'Brgy. Ugong, Taguig', latitude: 14.5243, longitude: 121.0534,
      total_load_received: 1530, total_paid: 510, outstanding_balance: 1020,
      created_at: now, updated_at: now,
    },
  ];
  await db.clients.bulkAdd(clients);

  // Disbursements (8 total: 6 success, 1 failed, 1 returned)
  const disbursements: Disbursement[] = [
    {
      id: uuid(), client_id: clientIds[0], date: twoDaysAgo, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'success',
      capital_purchase_id: cap1Id, created_at: new Date(Date.now() - 172000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[0], date: yesterday, network: 'globe',
      face_value: 1000, selling_price: 1010, markup: 10, status: 'success',
      capital_purchase_id: cap3Id, created_at: new Date(Date.now() - 85000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[1], date: twoDaysAgo, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'success',
      capital_purchase_id: cap1Id, created_at: new Date(Date.now() - 171000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[1], date: yesterday, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'success',
      capital_purchase_id: cap2Id, created_at: new Date(Date.now() - 84000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[2], date: yesterday, network: 'smart',
      face_value: 1000, selling_price: 1020, markup: 20, status: 'success',
      capital_purchase_id: cap1Id, created_at: new Date(Date.now() - 83000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[2], date: today, network: 'globe',
      face_value: 1000, selling_price: 1020, markup: 20, status: 'success',
      capital_purchase_id: cap3Id, created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[3], date: yesterday, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'success',
      capital_purchase_id: cap2Id, created_at: new Date(Date.now() - 82000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[4], date: today, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'failed',
      failure_reason: 'Wrong number',
      capital_purchase_id: cap2Id, created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[4], date: twoDaysAgo, network: 'smart',
      face_value: 500, selling_price: 510, markup: 10, status: 'success',
      capital_purchase_id: cap1Id, created_at: new Date(Date.now() - 170000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[4], date: yesterday, network: 'globe',
      face_value: 1000, selling_price: 1020, markup: 20, status: 'returned',
      failure_reason: 'Client refused',
      capital_purchase_id: cap3Id, created_at: new Date(Date.now() - 80000000).toISOString(),
    },
  ];
  await db.disbursements.bulkAdd(disbursements);

  // Payments (4 total)
  const payments: Payment[] = [
    {
      id: uuid(), client_id: clientIds[0], date: yesterday, amount: 510,
      method: 'cash', signature_image: PLACEHOLDER_SIGNATURE,
      created_at: new Date(Date.now() - 80000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[0], date: today, amount: 510,
      method: 'gcash', reference_number: 'GC-20240315-001',
      signature_image: PLACEHOLDER_SIGNATURE,
      created_at: new Date(Date.now() - 3000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[1], date: yesterday, amount: 1020,
      method: 'online_transfer', reference_number: 'BPI-2024031500123',
      signature_image: PLACEHOLDER_SIGNATURE,
      created_at: new Date(Date.now() - 79000000).toISOString(),
    },
    {
      id: uuid(), client_id: clientIds[2], date: today, amount: 1020,
      method: 'cash', signature_image: PLACEHOLDER_SIGNATURE,
      created_at: new Date(Date.now() - 2000000).toISOString(),
    },
  ];
  await db.payments.bulkAdd(payments);
}
