import { create } from 'zustand';
import type { Expense } from '@/types';
import { supabase } from '@/lib/supabase';

interface ExpenseStore {
  expenses: Expense[];
  loading: boolean;
  loadExpenses: (projectId: string) => Promise<void>;
  loadAllExpenses: () => Promise<void>;
  addExpense: (data: Omit<Expense, 'id' | 'createdAt'>, receiptFile?: File) => Promise<void>;
  updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  confirmExpense: (id: string, data: Partial<Expense>) => Promise<void>;
}

function mapRow(r: any): Expense {
  return {
    id: r.id, projectId: r.project_id, date: r.date, supplier: r.supplier || '',
    description: r.description || '', quantity: Number(r.quantity), price: Number(r.price),
    totalAmount: Number(r.total_amount), category: r.category || 'ostalo',
    receiptFilePath: r.receipt_file_path, receiptFileName: r.receipt_file_name,
    invoiceNumber: r.invoice_number || undefined,
    dueDate: r.due_date || undefined,
    vendorTaxId: r.vendor_tax_id || undefined,
    taxAmount: r.tax_amount != null ? Number(r.tax_amount) : undefined,
    status: r.status || 'confirmed',
    extractionConfidence: r.extraction_confidence || undefined,
    lineItems: r.line_items || undefined,
    createdAt: r.created_at,
  };
}

export const useExpenseStore = create<ExpenseStore>((set) => ({
  expenses: [],
  loading: false,

  loadExpenses: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('expenses').select('*').eq('project_id', projectId).order('date', { ascending: false });
    set({ expenses: (data || []).map(mapRow), loading: false });
  },

  loadAllExpenses: async () => {
    set({ loading: true });
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    set({ expenses: (data || []).map(mapRow), loading: false });
  },

  addExpense: async (data, receiptFile) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let receiptFilePath: string | null = null;
    let receiptFileName: string | null = null;
    if (receiptFile) {
      receiptFilePath = `${user.id}/${data.projectId}/${crypto.randomUUID()}_${receiptFile.name}`;
      receiptFileName = receiptFile.name;
      await supabase.storage.from('receipts').upload(receiptFilePath, receiptFile);
    }

    const { data: row } = await supabase.from('expenses').insert({
      project_id: data.projectId, date: data.date, supplier: data.supplier,
      description: data.description, quantity: data.quantity, price: data.price,
      total_amount: data.totalAmount, category: data.category,
      receipt_file_path: receiptFilePath, receipt_file_name: receiptFileName,
      invoice_number: data.invoiceNumber || null,
      due_date: data.dueDate || null,
      vendor_tax_id: data.vendorTaxId || null,
      tax_amount: data.taxAmount ?? 0,
      status: data.status || 'confirmed',
      extraction_confidence: data.extractionConfidence || null,
      line_items: data.lineItems || null,
    }).select().single();
    if (row) set((s) => ({ expenses: [mapRow(row), ...s.expenses] }));
  },

  updateExpense: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.date !== undefined) u.date = data.date;
    if (data.supplier !== undefined) u.supplier = data.supplier;
    if (data.description !== undefined) u.description = data.description;
    if (data.quantity !== undefined) u.quantity = data.quantity;
    if (data.price !== undefined) u.price = data.price;
    if (data.totalAmount !== undefined) u.total_amount = data.totalAmount;
    if (data.category !== undefined) u.category = data.category;
    if (data.invoiceNumber !== undefined) u.invoice_number = data.invoiceNumber;
    if (data.dueDate !== undefined) u.due_date = data.dueDate;
    if (data.vendorTaxId !== undefined) u.vendor_tax_id = data.vendorTaxId;
    if (data.taxAmount !== undefined) u.tax_amount = data.taxAmount;
    if (data.status !== undefined) u.status = data.status;
    if (data.extractionConfidence !== undefined) u.extraction_confidence = data.extractionConfidence;
    if (data.lineItems !== undefined) u.line_items = data.lineItems;
    await supabase.from('expenses').update(u).eq('id', id);
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data } : e)) }));
  },

  confirmExpense: async (id, data) => {
    const u: Record<string, any> = { status: 'confirmed' };
    if (data.date !== undefined) u.date = data.date;
    if (data.supplier !== undefined) u.supplier = data.supplier;
    if (data.description !== undefined) u.description = data.description;
    if (data.quantity !== undefined) u.quantity = data.quantity;
    if (data.price !== undefined) u.price = data.price;
    if (data.totalAmount !== undefined) u.total_amount = data.totalAmount;
    if (data.category !== undefined) u.category = data.category;
    if (data.invoiceNumber !== undefined) u.invoice_number = data.invoiceNumber;
    if (data.dueDate !== undefined) u.due_date = data.dueDate;
    if (data.vendorTaxId !== undefined) u.vendor_tax_id = data.vendorTaxId;
    if (data.taxAmount !== undefined) u.tax_amount = data.taxAmount;
    if (data.lineItems !== undefined) u.line_items = data.lineItems;
    await supabase.from('expenses').update(u).eq('id', id);
    set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...data, status: 'confirmed' } : e)) }));
  },

  deleteExpense: async (id) => {
    const { data: row } = await supabase.from('expenses').select('receipt_file_path').eq('id', id).single();
    if (row?.receipt_file_path) await supabase.storage.from('receipts').remove([row.receipt_file_path]);
    await supabase.from('expenses').delete().eq('id', id);
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
  },
}));
