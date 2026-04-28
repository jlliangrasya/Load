import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { recalculateClientBalance, touchClientActivity } from '../db/database';
import type { Payment } from '../types';
import { v4 as uuid } from 'uuid';

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);

  const fetchPayments = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPayments(data as Payment[]);
  }, []);

  useEffect(() => {
    fetchPayments();
    const channel = supabase
      .channel(`payments-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPayments]);

  async function addPayment(data: {
    client_id: string;
    date: string;
    amount: number;
    method: 'cash' | 'gcash' | 'online_transfer';
    reference_number?: string;
    signature_image: string;
    disbursement_ids?: string[];
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: uuid(),
      client_id: data.client_id,
      date: data.date,
      amount: data.amount,
      method: data.method,
      reference_number: data.reference_number,
      signature_image: data.signature_image,
      disbursement_ids: data.disbursement_ids,
      notes: data.notes,
      created_at: now,
    };

    await supabase.from('payments').insert(payment);
    await recalculateClientBalance(data.client_id);
    await touchClientActivity(data.client_id);
    await fetchPayments();
    return payment;
  }

  async function deletePayment(id: string) {
    const { data: p } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();
    if (!p) return;

    await supabase.from('payments').delete().eq('id', id);
    await recalculateClientBalance(p.client_id);
    await fetchPayments();
  }

  async function getPaymentsByClient(clientId: string): Promise<Payment[]> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return (data ?? []) as Payment[];
  }

  return { payments, addPayment, deletePayment, getPaymentsByClient };
}
