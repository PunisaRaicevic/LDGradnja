import { create } from 'zustand';
import type { BillItem, InterimSituation, SituationItem, DiaryEntry } from '@/types';
import { db } from '@/lib/db';
import { generateId, getToday } from '@/lib/utils';

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

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  billItems: [],
  situations: [],
  diaryEntries: [],
  loading: false,

  loadBillItems: async (projectId) => {
    set({ loading: true });
    const billItems = await db.billItems.where('projectId').equals(projectId).sortBy('ordinal');
    set({ billItems, loading: false });
  },

  addBillItem: async (item) => {
    const billItem: BillItem = { ...item, id: generateId() };
    await db.billItems.add(billItem);
    set((state) => ({ billItems: [...state.billItems, billItem] }));
  },

  updateBillItem: async (id, data) => {
    await db.billItems.update(id, data);
    set((state) => ({
      billItems: state.billItems.map((b) => (b.id === id ? { ...b, ...data } : b)),
    }));
  },

  deleteBillItem: async (id) => {
    await db.billItems.delete(id);
    set((state) => ({ billItems: state.billItems.filter((b) => b.id !== id) }));
  },

  setBillItems: async (items) => {
    const projectId = items[0]?.projectId;
    if (projectId) {
      await db.billItems.where('projectId').equals(projectId).delete();
    }
    await db.billItems.bulkAdd(items);
    set({ billItems: items });
  },

  clearBillItems: async (projectId) => {
    await db.billItems.where('projectId').equals(projectId).delete();
    set({ billItems: [] });
  },

  loadSituations: async (projectId) => {
    set({ loading: true });
    const situations = await db.situations.where('projectId').equals(projectId).sortBy('number');
    set({ situations, loading: false });
  },

  addSituation: async (projectId, data) => {
    const existingSituations = get().situations;
    const number = existingSituations.length + 1;

    const situationId = generateId();
    const items: SituationItem[] = data.items.map((item) => ({
      ...item,
      id: generateId(),
      situationId,
    }));

    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    const prevCumulative = existingSituations.length > 0
      ? existingSituations[existingSituations.length - 1].cumulativeValue
      : 0;

    const situation: InterimSituation = {
      id: situationId,
      projectId,
      number,
      date: getToday(),
      periodFrom: data.periodFrom,
      periodTo: data.periodTo,
      items,
      totalValue,
      cumulativeValue: prevCumulative + totalValue,
      createdAt: new Date().toISOString(),
    };

    await db.situations.add(situation);
    set((state) => ({ situations: [...state.situations, situation] }));
  },

  deleteSituation: async (id) => {
    await db.situations.delete(id);
    set((state) => ({ situations: state.situations.filter((s) => s.id !== id) }));
  },

  loadDiaryEntries: async (projectId) => {
    set({ loading: true });
    const diaryEntries = await db.diaryEntries.where('projectId').equals(projectId).reverse().sortBy('date');
    set({ diaryEntries, loading: false });
  },

  addDiaryEntry: async (entry) => {
    const diaryEntry: DiaryEntry = {
      ...entry,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await db.diaryEntries.add(diaryEntry);
    set((state) => ({ diaryEntries: [diaryEntry, ...state.diaryEntries] }));
  },

  updateDiaryEntry: async (id, data) => {
    await db.diaryEntries.update(id, data);
    set((state) => ({
      diaryEntries: state.diaryEntries.map((d) => (d.id === id ? { ...d, ...data } : d)),
    }));
  },

  deleteDiaryEntry: async (id) => {
    await db.diaryEntries.delete(id);
    set((state) => ({ diaryEntries: state.diaryEntries.filter((d) => d.id !== id) }));
  },
}));
