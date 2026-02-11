import { create } from 'zustand';
import type { BillItem, InterimSituation, SituationItem, DiaryEntry } from '@/types';
import { supabase } from '@/lib/supabase';
import { getToday } from '@/lib/utils';

interface FinanceStore {
  billItems: BillItem[];
  situations: InterimSituation[];
  diaryEntries: DiaryEntry[];
  loading: boolean;

  loadBillItems: (projectId: string) => Promise<void>;
  addBillItem: (item: Omit<BillItem, 'id'>) => Promise<void>;
  updateBillItem: (id: string, data: Partial<BillItem>) => Promise<void>;
  deleteBillItem: (id: string) => Promise<void>;
  setBillItems: (items: BillItem[]) => Promise<void>;
  clearBillItems: (projectId: string) => Promise<void>;

  loadSituations: (projectId: string) => Promise<void>;
  addSituation: (projectId: string, data: { periodFrom: string; periodTo: string; items: Omit<SituationItem, 'id' | 'situationId'>[] }) => Promise<void>;
  deleteSituation: (id: string) => Promise<void>;

  loadDiaryEntries: (projectId: string) => Promise<void>;
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateDiaryEntry: (id: string, data: Partial<DiaryEntry>) => Promise<void>;
  deleteDiaryEntry: (id: string) => Promise<void>;
}

function mapBillItem(r: any): BillItem {
  return { id: r.id, projectId: r.project_id, ordinal: r.ordinal || '', description: r.description, unit: r.unit || '', quantity: Number(r.quantity), unitPrice: Number(r.unit_price), totalPrice: Number(r.total_price) };
}
function mapSituation(r: any, items: SituationItem[]): InterimSituation {
  return { id: r.id, projectId: r.project_id, number: r.number, date: r.date, periodFrom: r.period_from || '', periodTo: r.period_to || '', items, totalValue: Number(r.total_value), cumulativeValue: Number(r.cumulative_value), createdAt: r.created_at };
}
function mapSituationItem(r: any): SituationItem {
  return { id: r.id, situationId: r.situation_id, billItemId: r.bill_item_id, percentComplete: Number(r.percent_complete), quantityDone: Number(r.quantity_done), value: Number(r.value), cumulativePercent: Number(r.cumulative_percent), cumulativeQuantity: Number(r.cumulative_quantity), cumulativeValue: Number(r.cumulative_value) };
}
function mapDiary(r: any): DiaryEntry {
  return { id: r.id, projectId: r.project_id, date: r.date, weather: r.weather || '', temperature: r.temperature || '', workerCount: r.worker_count, workDescription: r.work_description || '', materials: r.materials || '', specialEvents: r.special_events || '', createdAt: r.created_at };
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  billItems: [], situations: [], diaryEntries: [], loading: false,

  loadBillItems: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('bill_items').select('*').eq('project_id', projectId).order('ordinal');
    set({ billItems: (data || []).map(mapBillItem), loading: false });
  },

  addBillItem: async (item) => {
    const { data: row } = await supabase.from('bill_items').insert({
      project_id: item.projectId, ordinal: item.ordinal, description: item.description,
      unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice, total_price: item.totalPrice,
    }).select().single();
    if (row) set((s) => ({ billItems: [...s.billItems, mapBillItem(row)] }));
  },

  updateBillItem: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.ordinal !== undefined) u.ordinal = data.ordinal;
    if (data.description !== undefined) u.description = data.description;
    if (data.unit !== undefined) u.unit = data.unit;
    if (data.quantity !== undefined) u.quantity = data.quantity;
    if (data.unitPrice !== undefined) u.unit_price = data.unitPrice;
    if (data.totalPrice !== undefined) u.total_price = data.totalPrice;
    await supabase.from('bill_items').update(u).eq('id', id);
    set((s) => ({ billItems: s.billItems.map((b) => (b.id === id ? { ...b, ...data } : b)) }));
  },

  deleteBillItem: async (id) => {
    await supabase.from('bill_items').delete().eq('id', id);
    set((s) => ({ billItems: s.billItems.filter((b) => b.id !== id) }));
  },

  setBillItems: async (items) => {
    const projectId = items[0]?.projectId;
    if (projectId) {
      await supabase.from('bill_items').delete().eq('project_id', projectId);
      const rows = items.map((i) => ({
        project_id: i.projectId, ordinal: i.ordinal, description: i.description,
        unit: i.unit, quantity: i.quantity, unit_price: i.unitPrice, total_price: i.totalPrice,
      }));
      const { data } = await supabase.from('bill_items').insert(rows).select();
      set({ billItems: (data || []).map(mapBillItem) });
    }
  },

  clearBillItems: async (projectId) => {
    await supabase.from('bill_items').delete().eq('project_id', projectId);
    set({ billItems: [] });
  },

  loadSituations: async (projectId) => {
    set({ loading: true });
    const { data: sitRows } = await supabase.from('situations').select('*').eq('project_id', projectId).order('number');
    const situations: InterimSituation[] = [];
    for (const sr of sitRows || []) {
      const { data: itemRows } = await supabase.from('situation_items').select('*').eq('situation_id', sr.id);
      situations.push(mapSituation(sr, (itemRows || []).map(mapSituationItem)));
    }
    set({ situations, loading: false });
  },

  addSituation: async (projectId, data) => {
    const existing = get().situations;
    const number = existing.length + 1;
    const totalValue = data.items.reduce((sum, i) => sum + i.value, 0);
    const prevCum = existing.length > 0 ? existing[existing.length - 1].cumulativeValue : 0;

    const { data: sitRow } = await supabase.from('situations').insert({
      project_id: projectId, number, date: getToday(), period_from: data.periodFrom,
      period_to: data.periodTo, total_value: totalValue, cumulative_value: prevCum + totalValue,
    }).select().single();
    if (!sitRow) return;

    const itemRows = data.items.map((i) => ({
      situation_id: sitRow.id, bill_item_id: i.billItemId, percent_complete: i.percentComplete,
      quantity_done: i.quantityDone, value: i.value, cumulative_percent: i.cumulativePercent,
      cumulative_quantity: i.cumulativeQuantity, cumulative_value: i.cumulativeValue,
    }));
    const { data: insertedItems } = await supabase.from('situation_items').insert(itemRows).select();
    const situation = mapSituation(sitRow, (insertedItems || []).map(mapSituationItem));
    set((s) => ({ situations: [...s.situations, situation] }));
  },

  deleteSituation: async (id) => {
    await supabase.from('situations').delete().eq('id', id);
    set((s) => ({ situations: s.situations.filter((sit) => sit.id !== id) }));
  },

  loadDiaryEntries: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('diary_entries').select('*').eq('project_id', projectId).order('date', { ascending: false });
    set({ diaryEntries: (data || []).map(mapDiary), loading: false });
  },

  addDiaryEntry: async (entry) => {
    const { data: row } = await supabase.from('diary_entries').insert({
      project_id: entry.projectId, date: entry.date, weather: entry.weather,
      temperature: entry.temperature, worker_count: entry.workerCount,
      work_description: entry.workDescription, materials: entry.materials, special_events: entry.specialEvents,
    }).select().single();
    if (row) set((s) => ({ diaryEntries: [mapDiary(row), ...s.diaryEntries] }));
  },

  updateDiaryEntry: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.date !== undefined) u.date = data.date;
    if (data.weather !== undefined) u.weather = data.weather;
    if (data.temperature !== undefined) u.temperature = data.temperature;
    if (data.workerCount !== undefined) u.worker_count = data.workerCount;
    if (data.workDescription !== undefined) u.work_description = data.workDescription;
    if (data.materials !== undefined) u.materials = data.materials;
    if (data.specialEvents !== undefined) u.special_events = data.specialEvents;
    await supabase.from('diary_entries').update(u).eq('id', id);
    set((s) => ({ diaryEntries: s.diaryEntries.map((d) => (d.id === id ? { ...d, ...data } : d)) }));
  },

  deleteDiaryEntry: async (id) => {
    await supabase.from('diary_entries').delete().eq('id', id);
    set((s) => ({ diaryEntries: s.diaryEntries.filter((d) => d.id !== id) }));
  },
}));
