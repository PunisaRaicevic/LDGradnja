import { create } from 'zustand';
import type { Project } from '@/types';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

interface ProjectStore {
  projects: Project[];
  loading: boolean;
  loadProjects: () => Promise<void>;
  addProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  getProject: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const projects = await db.projects.orderBy('createdAt').reverse().toArray();
    set({ projects, loading: false });
  },

  addProject: async (data) => {
    const project: Project = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.projects.add(project);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  updateProject: async (id, data) => {
    const updated = { ...data, updatedAt: new Date().toISOString() };
    await db.projects.update(id, updated);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    }));
  },

  deleteProject: async (id) => {
    await db.projects.delete(id);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  getProject: (id) => get().projects.find((p) => p.id === id),
}));
