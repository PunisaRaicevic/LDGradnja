import { create } from 'zustand';
import type { Contract } from '@/types';
import { supabase } from '@/lib/supabase';

interface ContractStore {
  contracts: Contract[];
  loading: boolean;
  loadContracts: (projectId: string) => Promise<void>;
  addContract: (data: Omit<Contract, 'id' | 'createdAt'>, file?: File) => Promise<void>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<void>;
  deleteContract: (id: string) => Promise<void>;
}

function mapRow(r: any): Contract {
  return {
    id: r.id, projectId: r.project_id, type: r.type, contractNumber: r.contract_number || '',
    date: r.date || '', amount: Number(r.amount), deadline: r.deadline || '',
    partyName: r.party_name, contactInfo: r.contact_info || '', scopeOfWork: r.scope_of_work || '',
    paymentTerms: r.payment_terms || '', filePath: r.file_path, fileName: r.file_name, createdAt: r.created_at,
  };
}

export const useContractStore = create<ContractStore>((set) => ({
  contracts: [],
  loading: false,

  loadContracts: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('contracts').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    set({ contracts: (data || []).map(mapRow), loading: false });
  },

  addContract: async (data, file) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      filePath = `${user.id}/${data.projectId}/${crypto.randomUUID()}_${file.name}`;
      fileName = file.name;
      await supabase.storage.from('contracts').upload(filePath, file);
    }

    const { data: row } = await supabase.from('contracts').insert({
      project_id: data.projectId, type: data.type, contract_number: data.contractNumber,
      date: data.date || null, amount: data.amount, deadline: data.deadline || null,
      party_name: data.partyName, contact_info: data.contactInfo, scope_of_work: data.scopeOfWork,
      payment_terms: data.paymentTerms, file_path: filePath, file_name: fileName,
    }).select().single();
    if (row) set((s) => ({ contracts: [...s.contracts, mapRow(row)] }));
  },

  updateContract: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.type !== undefined) u.type = data.type;
    if (data.contractNumber !== undefined) u.contract_number = data.contractNumber;
    if (data.date !== undefined) u.date = data.date;
    if (data.amount !== undefined) u.amount = data.amount;
    if (data.deadline !== undefined) u.deadline = data.deadline;
    if (data.partyName !== undefined) u.party_name = data.partyName;
    if (data.contactInfo !== undefined) u.contact_info = data.contactInfo;
    if (data.scopeOfWork !== undefined) u.scope_of_work = data.scopeOfWork;
    if (data.paymentTerms !== undefined) u.payment_terms = data.paymentTerms;
    await supabase.from('contracts').update(u).eq('id', id);
    set((s) => ({ contracts: s.contracts.map((c) => (c.id === id ? { ...c, ...data } : c)) }));
  },

  deleteContract: async (id) => {
    const { data: row } = await supabase.from('contracts').select('file_path').eq('id', id).single();
    if (row?.file_path) await supabase.storage.from('contracts').remove([row.file_path]);
    await supabase.from('contracts').delete().eq('id', id);
    set((s) => ({ contracts: s.contracts.filter((c) => c.id !== id) }));
  },
}));
