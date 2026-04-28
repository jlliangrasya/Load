import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { recalculateClientBalance, touchClientActivity } from '../db/database';
import type { Disbursement } from '../types';
import { v4 as uuid } from 'uuid';

export function useDisbursements() {
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);

  const fetchDisbursements = useCallback(async () => {
    const { data } = await supabase
      .from('disbursements')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setDisbursements(data as Disbursement[]);
  }, []);

  useEffect(() => {
    fetchDisbursements();
    const channel = supabase
      .channel('disbursements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disbursements' }, fetchDisbursements)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchDisbursements]);

  async function addDisbursement(data: {
    client_id: string;
    date: string;
    network: 'smart' | 'globe';
    face_value: number;
    selling_price: number;
    status: 'success' | 'failed' | 'returned';
    failure_reason?: string;
    capital_purchase_id: string;
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const disbursement: Disbursement = {
      id: uuid(),
      client_id: data.client_id,
      date: data.date,
      network: data.network,
      face_value: data.face_value,
      selling_price: data.selling_price,
      markup: data.selling_price - data.face_value,
      status: data.status,
      failure_reason: data.failure_reason,
      capital_purchase_id: data.capital_purchase_id,
      notes: data.notes,
      created_at: now,
    };

    await supabase.from('disbursements').insert(disbursement);

    if (data.status === 'success') {
      const { data: batch } = await supabase
        .from('capital_purchases')
        .select('remaining_balance')
        .eq('id', data.capital_purchase_id)
        .single();
      if (batch) {
        await supabase
          .from('capital_purchases')
          .update({ remaining_balance: Math.max(0, batch.remaining_balance - data.face_value) })
          .eq('id', data.capital_purchase_id);
      }
      await recalculateClientBalance(data.client_id);
    }

    await touchClientActivity(data.client_id);
    await fetchDisbursements();
    return disbursement;
  }

  async function deleteDisbursement(id: string) {
    const { data: d } = await supabase
      .from('disbursements')
      .select('*')
      .eq('id', id)
      .single();
    if (!d) return;

    await supabase.from('disbursements').delete().eq('id', id);

    if (d.status === 'success') {
      const { data: batch } = await supabase
        .from('capital_purchases')
        .select('remaining_balance')
        .eq('id', d.capital_purchase_id)
        .single();
      if (batch) {
        await supabase
          .from('capital_purchases')
          .update({ remaining_balance: batch.remaining_balance + d.face_value })
          .eq('id', d.capital_purchase_id);
      }
    }

    await recalculateClientBalance(d.client_id);
    await fetchDisbursements();
  }

  async function getDisbursementsByClient(clientId: string): Promise<Disbursement[]> {
    const { data } = await supabase
      .from('disbursements')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return (data ?? []) as Disbursement[];
  }

  return { disbursements, addDisbursement, deleteDisbursement, getDisbursementsByClient };
}
