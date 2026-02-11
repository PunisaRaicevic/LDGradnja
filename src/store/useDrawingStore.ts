import { create } from 'zustand';
import type { Drawing } from '@/types';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';

interface DrawingStore {
  drawings: Drawing[];
  loading: boolean;
  loadDrawings: (projectId: string) => Promise<void>;
  addDrawing: (projectId: string, file: File, description?: string) => Promise<Drawing>;
  deleteDrawing: (id: string) => Promise<void>;
  getDrawingFile: (id: string) => Promise<Blob | undefined>;
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  drawings: [],
  loading: false,

  loadDrawings: async (projectId) => {
    set({ loading: true });
    const drawings = await db.drawings
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('uploadedAt');
    set({ drawings, loading: false });
  },

  addDrawing: async (projectId, file, description) => {
    const fileType = file.name.toLowerCase().endsWith('.dwg')
      ? 'dwg' as const
      : file.name.toLowerCase().endsWith('.pdf')
        ? 'pdf' as const
        : 'other' as const;

    const existingVersions = await db.drawings
      .where('projectId')
      .equals(projectId)
      .filter((d) => d.name === file.name)
      .count();

    const drawing: Drawing = {
      id: generateId(),
      projectId,
      name: file.name,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      version: existingVersions + 1,
      uploadedAt: new Date().toISOString(),
      description,
      fileData: file,
    };

    await db.drawings.add(drawing);
    set((state) => ({ drawings: [drawing, ...state.drawings] }));
    return drawing;
  },

  deleteDrawing: async (id) => {
    await db.drawings.delete(id);
    set((state) => ({ drawings: state.drawings.filter((d) => d.id !== id) }));
  },

  getDrawingFile: async (id) => {
    const drawing = await db.drawings.get(id);
    return drawing?.fileData;
  },
}));
