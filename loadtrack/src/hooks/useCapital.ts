import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CapitalPurchase } from '../types';
import { v4 as uuid } from 'uuid';

export function useCapital() {
  const [capitals, setCapitals] = useState<CapitalPurchase[]>([]);
  const [smartBalance, setSmartBalance] = useState(0);
  const [globeBalance, setGlobeBalance] = useState(0);

  const fetchCapitals = useCallback(async () => {
    const { data } = await supabase
      .from('capital_purchases')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      const items = data as CapitalPurchase[];
      setCapitals(items);
      setSmartBalance(items.filter(c => c.network === 'smart').reduce((s, c) => s + c.remaining_balance, 0));
      setGlobeBalance(items.filter(c => c.network === 'globe').reduce((s, c) => s + c.remaining_balance, 0));
    }
  }, []);

  useEffect(() => {
    fetchCapitals();
    const channel = supabase
      .channel(`capital_purchases-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'capital_purchases' }, fetchCapitals)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCapitals]);

  async function addCapital(data: {
    network: 'smart' | 'globe';
    face_value: number;
    cost_price: number;
    date: string;
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const capital: CapitalPurchase = {
      id: uuid(),
      date: data.date,
      network: data.network,
      face_value: data.face_value,
      cost_price: data.cost_price,
      commission: data.face_value - data.cost_price,
      remaining_balance: data.face_value,
      notes: data.notes,
      created_at: now,
    };
    await supabase.from('capital_purchases').insert(capital);
    await fetchCapitals();
    return capital;
  }

  async function getOldestAvailableBatch(network: 'smart' | 'globe') {
    const { data } = await supabase
      .from('capital_purchases')
      .select('*')
      .eq('network', network)
      .gt('remaining_balance', 0)
      .order('created_at', { ascending: true })
      .limit(1);
    return (data?.[0] as CapitalPurchase) ?? null;
  }

  async function deductFromBatch(batchId: string, amount: number) {
    const { data } = await supabase
      .from('capital_purchases')
      .select('remaining_balance')
      .eq('id', batchId)
      .single();
    if (data) {
      await supabase
        .from('capital_purchases')
        .update({ remaining_balance: Math.max(0, data.remaining_balance - amount) })
        .eq('id', batchId);
    }
  }

  async function restoreToBatch(batchId: string, amount: number) {
    const { data } = await supabase
      .from('capital_purchases')
      .select('remaining_balance')
      .eq('id', batchId)
      .single();
    if (data) {
      await supabase
        .from('capital_purchases')
        .update({ remaining_balance: data.remaining_balance + amount })
        .eq('id', batchId);
    }
  }

  async function hasLinkedDisbursements(id: string): Promise<boolean> {
    const { count } = await supabase
      .from('disbursements')
      .select('id', { count: 'exact', head: true })
      .eq('capital_purchase_id', id);
    return (count ?? 0) > 0;
  }

  async function deleteCapital(id: string) {
    if (await hasLinkedDisbursements(id)) {
      throw new Error('Cannot delete capital with linked disbursements. Delete the disbursements first.');
    }
    await supabase.from('capital_purchases').delete().eq('id', id);
    await fetchCapitals();
  }

  return {
    capitals,
    smartBalance,
    globeBalance,
    addCapital,
    getOldestAvailableBatch,
    deductFromBatch,
    restoreToBatch,
    hasLinkedDisbursements,
    deleteCapital,
  };
}
