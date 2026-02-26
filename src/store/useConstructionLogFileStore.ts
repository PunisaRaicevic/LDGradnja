import { create } from 'zustand';
import type { ConstructionLogFile } from '@/types';
import { supabase } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

async function downloadFromStorage(filePath: string): Promise<Blob | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return undefined;

  const encodedPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/construction-log-files/${encodedPath}?t=${Date.now()}`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    cache: 'no-store',
  });

  if (!res.ok) return undefined;
  return await res.blob();
}

function getFileType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  return 'other';
}

interface ConstructionLogFileStore {
  files: ConstructionLogFile[];
  loading: boolean;
  loadFiles: (projectId: string) => Promise<void>;
  addFile: (projectId: string, file: File, description?: string) => Promise<ConstructionLogFile>;
  deleteFile: (id: string) => Promise<void>;
  getFile: (id: string) => Promise<Blob | undefined>;
  getSignedUrl: (id: string) => Promise<string | null>;
}

function mapRow(r: any): ConstructionLogFile {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    description: r.description || '',
    uploadedAt: r.uploaded_at,
    filePath: r.file_path,
  };
}

export const useConstructionLogFileStore = create<ConstructionLogFileStore>((set) => ({
  files: [],
  loading: false,

  loadFiles: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('construction_log_files').select('*')
      .eq('project_id', projectId).order('uploaded_at', { ascending: false });
    set({ files: (data || []).map(mapRow), loading: false });
  },

  addFile: async (projectId, file, description) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const fileType = getFileType(file.name);
    const safeFileName = sanitizeFileName(file.name);
    const filePath = `${user.id}/${projectId}/${crypto.randomUUID()}_${safeFileName}`;
    await supabase.storage.from('construction-log-files').upload(filePath, file);

    const { data: row } = await supabase.from('construction_log_files').insert({
      project_id: projectId,
      name: file.name,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      file_path: filePath,
      description: description || '',
    }).select().single();

    const logFile = mapRow(row);
    set((s) => ({ files: [logFile, ...s.files] }));
    return logFile;
  },

  deleteFile: async (id) => {
    const { data: row } = await supabase.from('construction_log_files').select('file_path').eq('id', id).single();
    if (row?.file_path) await supabase.storage.from('construction-log-files').remove([row.file_path]);
    await supabase.from('construction_log_files').delete().eq('id', id);
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
  },

  getFile: async (id) => {
    const { data: row, error } = await supabase.from('construction_log_files').select('file_path').eq('id', id).single();
    if (error || !row?.file_path) return undefined;
    return await downloadFromStorage(row.file_path);
  },

  getSignedUrl: async (id) => {
    const { data: row, error } = await supabase.from('construction_log_files').select('file_path').eq('id', id).single();
    if (error || !row?.file_path) return null;
    const { data, error: urlErr } = await supabase.storage.from('construction-log-files').createSignedUrl(row.file_path, 3600);
    if (urlErr) return null;
    return data?.signedUrl || null;
  },
}));
