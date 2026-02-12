import { create } from 'zustand';
import type { Drawing } from '@/types';
import { supabase } from '@/lib/supabase';

interface DrawingStore {
  drawings: Drawing[];
  loading: boolean;
  loadDrawings: (projectId: string) => Promise<void>;
  addDrawing: (projectId: string, file: File, description?: string) => Promise<Drawing>;
  deleteDrawing: (id: string) => Promise<void>;
  getDrawingFile: (id: string) => Promise<Blob | undefined>;
  getDrawingSignedUrl: (id: string) => Promise<string | null>;
}

function mapRow(r: any): Drawing {
  return {
    id: r.id, projectId: r.project_id, name: r.name, fileName: r.file_name,
    fileType: r.file_type, fileSize: r.file_size, version: r.version,
    uploadedAt: r.uploaded_at, description: r.description || '', filePath: r.file_path,
  };
}

export const useDrawingStore = create<DrawingStore>((set) => ({
  drawings: [],
  loading: false,

  loadDrawings: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('drawings').select('*')
      .eq('project_id', projectId).order('uploaded_at', { ascending: false });
    set({ drawings: (data || []).map(mapRow), loading: false });
  },

  addDrawing: async (projectId, file, description) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileType = file.name.toLowerCase().endsWith('.dwg') ? 'dwg'
      : file.name.toLowerCase().endsWith('.dxf') ? 'dxf'
      : file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'other';

    const filePath = `${user.id}/${projectId}/${crypto.randomUUID()}_${file.name}`;
    await supabase.storage.from('drawings').upload(filePath, file);

    // Check existing versions
    const { count } = await supabase.from('drawings')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('name', file.name);

    const { data: row } = await supabase.from('drawings').insert({
      project_id: projectId, name: file.name, file_name: file.name,
      file_type: fileType, file_size: file.size, version: (count || 0) + 1,
      file_path: filePath, description: description || '',
    }).select().single();

    const drawing = mapRow(row);
    set((s) => ({ drawings: [drawing, ...s.drawings] }));
    return drawing;
  },

  deleteDrawing: async (id) => {
    const { data: row } = await supabase.from('drawings').select('file_path').eq('id', id).single();
    if (row?.file_path) await supabase.storage.from('drawings').remove([row.file_path]);
    await supabase.from('drawings').delete().eq('id', id);
    set((s) => ({ drawings: s.drawings.filter((d) => d.id !== id) }));
  },

  getDrawingFile: async (id) => {
    const { data: row, error: rowErr } = await supabase.from('drawings').select('file_path').eq('id', id).single();
    if (rowErr) { console.error('[getDrawingFile] DB error:', rowErr); return undefined; }
    if (!row?.file_path) { console.error('[getDrawingFile] No file_path for id:', id); return undefined; }
    console.log('[getDrawingFile] Downloading:', row.file_path);
    const { data, error } = await supabase.storage.from('drawings').download(row.file_path);
    if (error) { console.error('[getDrawingFile] Storage error:', error); return undefined; }
    if (!data) { console.error('[getDrawingFile] No data returned'); return undefined; }
    console.log('[getDrawingFile] Downloaded:', data.size, 'bytes');
    return data;
  },

  getDrawingSignedUrl: async (id) => {
    const { data: row, error: rowErr } = await supabase.from('drawings').select('file_path').eq('id', id).single();
    if (rowErr) { console.error('[getDrawingSignedUrl] DB error:', rowErr); return null; }
    if (!row?.file_path) { console.error('[getDrawingSignedUrl] No file_path for id:', id); return null; }
    const { data, error } = await supabase.storage.from('drawings').createSignedUrl(row.file_path, 3600);
    if (error) { console.error('[getDrawingSignedUrl] Signed URL error:', error); return null; }
    return data.signedUrl;
  },
}));
