import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Expense } from '../types';
import { v4 as uuid } from 'uuid';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setExpenses(data as Expense[]);
  }, []);

  useEffect(() => {
    fetchExpenses();
    const channel = supabase
      .channel(`expenses-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchExpenses)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchExpenses]);

  async function addExpense(data: {
    date: string;
    category: string;
    description: string;
    amount: number;
  }) {
    const expense: Expense = {
      id: uuid(),
      date: data.date,
      category: data.category,
      description: data.description,
      amount: data.amount,
      created_at: new Date().toISOString(),
    };
    await supabase.from('expenses').insert(expense);
    await fetchExpenses();
    return expense;
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id);
    await fetchExpenses();
  }

  return { expenses, addExpense, deleteExpense };
}
