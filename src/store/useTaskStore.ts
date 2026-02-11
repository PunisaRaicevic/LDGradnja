import { create } from 'zustand';
import type { Task, MaterialRequest, ProjectPhoto } from '@/types';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

interface TaskStore {
  tasks: Task[];
  materialRequests: MaterialRequest[];
  photos: ProjectPhoto[];
  loading: boolean;

  loadTasks: (projectId: string) => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  loadMaterialRequests: (projectId: string) => Promise<void>;
  addMaterialRequest: (data: Omit<MaterialRequest, 'id' | 'createdAt' | 'photos'>, photoFiles?: File[]) => Promise<void>;
  updateMaterialRequestStatus: (id: string, status: MaterialRequest['status']) => Promise<void>;

  loadPhotos: (projectId: string) => Promise<void>;
  addPhoto: (projectId: string, file: File, description?: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  materialRequests: [],
  photos: [],
  loading: false,

  loadTasks: async (projectId) => {
    set({ loading: true });
    const tasks = await db.tasks.where('projectId').equals(projectId).toArray();
    set({ tasks, loading: false });
  },

  addTask: async (data) => {
    const task: Task = {
      ...data,
      id: generateId(),
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.tasks.add(task);
    set((state) => ({ tasks: [...state.tasks, task] }));
  },

  updateTask: async (id, data) => {
    const updated = { ...data, updatedAt: new Date().toISOString() };
    await db.tasks.update(id, updated);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updated } : t)),
    }));
  },

  deleteTask: async (id) => {
    await db.tasks.delete(id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  loadMaterialRequests: async (projectId) => {
    const materialRequests = await db.materialRequests.where('projectId').equals(projectId).toArray();
    set({ materialRequests });
  },

  addMaterialRequest: async (data, photoFiles) => {
    const id = generateId();
    const photos = (photoFiles || []).map((file) => ({
      id: generateId(),
      requestId: id,
      fileData: file as unknown as Blob,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    }));
    const request: MaterialRequest = {
      ...data,
      id,
      photos,
      createdAt: new Date().toISOString(),
    };
    await db.materialRequests.add(request);
    set((state) => ({ materialRequests: [...state.materialRequests, request] }));
  },

  updateMaterialRequestStatus: async (id, status) => {
    await db.materialRequests.update(id, { status });
    set((state) => ({
      materialRequests: state.materialRequests.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
    }));
  },

  loadPhotos: async (projectId) => {
    const photos = await db.photos.where('projectId').equals(projectId).reverse().sortBy('date');
    set({ photos });
  },

  addPhoto: async (projectId, file, description) => {
    const photo: ProjectPhoto = {
      id: generateId(),
      projectId,
      fileName: file.name,
      fileData: file,
      description,
      date: new Date().toISOString().split('T')[0],
      uploadedAt: new Date().toISOString(),
    };
    await db.photos.add(photo);
    set((state) => ({ photos: [photo, ...state.photos] }));
  },

  deletePhoto: async (id) => {
    await db.photos.delete(id);
    set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }));
  },
}));
