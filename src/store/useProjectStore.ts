import { create } from 'zustand';
import type { Project } from '@/types';
import { supabase } from '@/lib/supabase';

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  loadProjects: () => Promise<void>;
  addProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Project | undefined;
}

function mapRow(r: any): Project {
  return {
    id: r.id, name: r.name, location: r.location || '', startDate: r.start_date || '',
    investor: r.investor || '', status: r.status, description: r.description || '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    set({ projects: (data || []).map(mapRow), loading: false });
  },

  addProject: async (d) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data: row } = await supabase.from('projects').insert({
      user_id: user.id, name: d.name, location: d.location, start_date: d.startDate || null,
      investor: d.investor, status: d.status, description: d.description,
    }).select().single();
    const project = mapRow(row);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: async (id, data) => {
    const u: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) u.name = data.name;
    if (data.location !== undefined) u.location = data.location;
    if (data.startDate !== undefined) u.start_date = data.startDate;
    if (data.investor !== undefined) u.investor = data.investor;
    if (data.status !== undefined) u.status = data.status;
    if (data.description !== undefined) u.description = data.description;
    await supabase.from('projects').update(u).eq('id', id);
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...data, updatedAt: u.updated_at } : p)) }));
  },

  deleteProject: async (id) => {
    await supabase.from('projects').delete().eq('id', id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  getProject: (id) => get().projects.find((p) => p.id === id),
}));
