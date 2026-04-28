import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Client } from '../types';
import { v4 as uuid } from 'uuid';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);

  const fetchClients = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (data) setClients(data as Client[]);
  }, []);

  useEffect(() => {
    fetchClients();
    const channel = supabase
      .channel('clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, fetchClients)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchClients]);

  async function addClient(data: {
    name: string;
    contact_number: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const now = new Date().toISOString();
    const client: Client = {
      id: uuid(),
      name: data.name,
      contact_number: data.contact_number,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      total_load_received: 0,
      total_paid: 0,
      outstanding_balance: 0,
      created_at: now,
      updated_at: now,
    };
    await supabase.from('clients').insert(client);
    await fetchClients();
    return client;
  }

  async function updateClient(id: string, data: Partial<Client>) {
    await supabase
      .from('clients')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    await fetchClients();
  }

  async function deleteClient(id: string) {
    const { data: disbursements } = await supabase
      .from('disbursements')
      .select('id, capital_purchase_id, face_value, status')
      .eq('client_id', id);

    if (disbursements) {
      for (const d of disbursements) {
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
      }
    }

    await supabase.from('disbursements').delete().eq('client_id', id);
    await supabase.from('payments').delete().eq('client_id', id);
    await supabase.from('collection_list').delete().eq('client_id', id);
    await supabase.from('clients').delete().eq('id', id);
    await fetchClients();
  }

  async function getClient(id: string): Promise<Client | undefined> {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    return data as Client ?? undefined;
  }

  return { clients, addClient, updateClient, deleteClient, getClient };
}
