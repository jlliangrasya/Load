export interface CapitalPurchase {
  id: string;
  date: string;
  network: 'smart' | 'globe';
  face_value: number;
  cost_price: number;
  commission: number;
  remaining_balance: number;
  notes?: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  contact_number: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  total_load_received: number;
  total_paid: number;
  outstanding_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Disbursement {
  id: string;
  client_id: string;
  date: string;
  network: 'smart' | 'globe';
  face_value: number;
  selling_price: number;
  markup: number;
  status: 'success' | 'failed' | 'returned';
  failure_reason?: string;
  capital_purchase_id: string;
  notes?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  client_id: string;
  date: string;
  amount: number;
  method: 'cash' | 'gcash' | 'online_transfer';
  reference_number?: string;
  signature_image: string;
  notes?: string;
  created_at: string;
}

export interface AppSettings {
  id: number;
  default_smart_markup: number;
  default_globe_markup: number;
  owner_name: string;
  business_name: string;
}

export interface ProfitSummary {
  period: string;
  total_capital_spent: number;
  total_commission_earned: number;
  total_markup_earned: number;
  total_gross_income: number;
  gross_profit: number;
  losses_from_failed: number;
  net_profit: number;
  by_network: {
    smart: NetworkSummary;
    globe: NetworkSummary;
  };
}

export interface NetworkSummary {
  capital_spent: number;
  commission: number;
  markup: number;
  disbursed_count: number;
  failed_count: number;
}
