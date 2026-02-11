import { create } from 'zustand';
import type { Expense } from '@/types';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  loadExpenses: (projectId: string) => Promise<void>;
  loadAllExpenses: () => Promise<void>;
  addExpense: (data: Omit<Expense, 'id' | 'createdAt'>, receiptFile?: File) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

export const useExpenseStore = create<ExpenseStore>((set) => ({
  expenses: [],
  loading: false,

  loadExpenses: async (projectId) => {
    set({ loading: true });
    const expenses = await db.expenses.where('projectId').equals(projectId).reverse().sortBy('date');
    set({ expenses, loading: false });
  },

  loadAllExpenses: async () => {
    set({ loading: true });
    const expenses = await db.expenses.orderBy('date').reverse().toArray();
    set({ expenses, loading: false });
  },

  addExpense: async (data, receiptFile) => {
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      receiptFileData: receiptFile,
      receiptFileName: receiptFile?.name,
    };
    await db.expenses.add(expense);
    set((state) => ({ expenses: [expense, ...state.expenses] }));
  },

  updateExpense: async (id, data) => {
    await db.expenses.update(id, data);
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)),
    }));
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },
}));
