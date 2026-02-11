import { create } from 'zustand';
import type { Contract } from '@/types';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

interface ContractStore {
  contracts: Contract[];
  loading: boolean;
  loadContracts: (projectId: string) => Promise<void>;
  addContract: (data: Omit<Contract, 'id' | 'createdAt'>, file?: File) => Promise<void>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
}

export const useContractStore = create<ContractStore>((set) => ({
  contracts: [],
  loading: false,

  loadContracts: async (projectId) => {
    set({ loading: true });
    const contracts = await db.contracts.where('projectId').equals(projectId).toArray();
    set({ contracts, loading: false });
  },

  addContract: async (data, file) => {
    const contract: Contract = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      fileData: file,
      fileName: file?.name,
    };
    await db.contracts.add(contract);
    set((state) => ({ contracts: [...state.contracts, contract] }));
  },

  updateContract: async (id, data) => {
    await db.contracts.update(id, data);
    set((state) => ({
      contracts: state.contracts.map((c) => (c.id === id ? { ...c, ...data } : c)),
    }));
  },

  deleteContract: async (id) => {
    await db.contracts.delete(id);
    set((state) => ({ contracts: state.contracts.filter((c) => c.id !== id) }));
  },
}));
