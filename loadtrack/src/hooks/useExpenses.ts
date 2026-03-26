import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Expense } from '../types';
import { v4 as uuid } from 'uuid';

export function useExpenses() {
  const expenses = useLiveQuery(
    () => db.expenses.orderBy('created_at').reverse().toArray(),
    []
  );

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
    await db.expenses.add(expense);
    return expense;
  }

  async function deleteExpense(id: string) {
    await db.expenses.delete(id);
  }

  return {
    expenses: expenses ?? [],
    addExpense,
    deleteExpense,
  };
}
