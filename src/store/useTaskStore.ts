import { create } from 'zustand';
import type { Task, MaterialRequest, ProjectPhoto, Message } from '@/types';
import { supabase } from '@/lib/supabase';

interface TaskStore {
  tasks: Task[];
  materialRequests: MaterialRequest[];
  photos: ProjectPhoto[];
  messages: Message[];
  loading: boolean;

  loadTasks: (projectId: string) => Promise<void>;
  addTask: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  loadMaterialRequests: (projectId: string) => Promise<void>;
  addMaterialRequest: (data: Omit<MaterialRequest, 'id' | 'createdAt' | 'photos'>, photoFiles?: File[]) => Promise<void>;
  updateMaterialRequestStatus: (id: string, status: MaterialRequest['status']) => Promise<void>;

  loadMessages: (projectId: string) => Promise<void>;
  sendMessage: (data: { projectId: string; senderName: string; content: string; messageType?: Message['messageType']; relatedTaskId?: string; relatedRequestId?: string }, imageFile?: File) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  loadPhotos: (projectId: string) => Promise<void>;
  addPhoto: (projectId: string, file: File, description?: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
}

function mapTask(r: any): Task {
  return {
    id: r.id, projectId: r.project_id, title: r.title, description: r.description || '',
    priority: r.priority, deadline: r.deadline || '', assignedTo: r.assigned_to || '',
    status: r.status, attachments: [], createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapRequest(r: any, photos: any[]): MaterialRequest {
  return {
    id: r.id, projectId: r.project_id, description: r.description,
    status: r.status, createdBy: r.created_by || '', photos, createdAt: r.created_at,
  };
}
function mapMessage(r: any): Message {
  return {
    id: r.id, projectId: r.project_id, senderName: r.sender_name, content: r.content || '',
    imagePath: r.image_path || undefined, imageName: r.image_name || undefined,
    messageType: r.message_type || 'text', relatedTaskId: r.related_task_id || undefined,
    relatedRequestId: r.related_request_id || undefined, createdAt: r.created_at,
  };
}
function mapPhoto(r: any): ProjectPhoto {
  return {
    id: r.id, projectId: r.project_id, fileName: r.file_name, filePath: r.file_path,
    description: r.description || '', date: r.date || '', uploadedAt: r.uploaded_at,
  };
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [], materialRequests: [], photos: [], messages: [], loading: false,

  loadTasks: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    set({ tasks: (data || []).map(mapTask), loading: false });
  },

  addTask: async (data) => {
    const { data: row } = await supabase.from('tasks').insert({
      project_id: data.projectId, title: data.title, description: data.description,
      priority: data.priority, deadline: data.deadline || null, assigned_to: data.assignedTo, status: data.status,
    }).select().single();
    if (row) set((s) => ({ tasks: [...s.tasks, mapTask(row)] }));
  },

  updateTask: async (id, data) => {
    const u: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) u.title = data.title;
    if (data.description !== undefined) u.description = data.description;
    if (data.priority !== undefined) u.priority = data.priority;
    if (data.deadline !== undefined) u.deadline = data.deadline;
    if (data.assignedTo !== undefined) u.assigned_to = data.assignedTo;
    if (data.status !== undefined) u.status = data.status;
    await supabase.from('tasks').update(u).eq('id', id);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...data, updatedAt: u.updated_at } : t)) }));
  },

  deleteTask: async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  loadMaterialRequests: async (projectId) => {
    const { data: rows } = await supabase.from('material_requests').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
    const requests: MaterialRequest[] = [];
    for (const r of rows || []) {
      const { data: photoRows } = await supabase.from('request_photos').select('*').eq('request_id', r.id);
      requests.push(mapRequest(r, (photoRows || []).map((p: any) => ({
        id: p.id, requestId: p.request_id, fileName: p.file_name, description: p.description || '', uploadedAt: p.uploaded_at,
      }))));
    }
    set({ materialRequests: requests });
  },

  addMaterialRequest: async (data, photoFiles) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: row } = await supabase.from('material_requests').insert({
      project_id: data.projectId, description: data.description, status: data.status, created_by: data.createdBy,
    }).select().single();
    if (!row) return;

    const photos: { id: string; requestId: string; fileName: string; filePath?: string; uploadedAt: string }[] = [];
    for (const file of photoFiles || []) {
      const filePath = `${user.id}/${data.projectId}/${crypto.randomUUID()}_${file.name}`;
      await supabase.storage.from('photos').upload(filePath, file);
      const { data: photoRow } = await supabase.from('request_photos').insert({
        request_id: row.id, file_name: file.name, file_path: filePath,
      }).select().single();
      if (photoRow) photos.push({ id: photoRow.id, requestId: row.id, fileName: file.name, filePath, uploadedAt: photoRow.uploaded_at });
    }

    set((s) => ({ materialRequests: [...s.materialRequests, mapRequest(row, photos)] }));
  },

  updateMaterialRequestStatus: async (id, status) => {
    await supabase.from('material_requests').update({ status }).eq('id', id);
    set((s) => ({ materialRequests: s.materialRequests.map((r) => r.id === id ? { ...r, status } : r) }));
  },

  loadMessages: async (projectId) => {
    const { data } = await supabase.from('messages').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
    set({ messages: (data || []).map(mapMessage) });
  },

  sendMessage: async (data, imageFile) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let imagePath: string | undefined;
    let imageName: string | undefined;

    if (imageFile) {
      imagePath = `${user.id}/${data.projectId}/${crypto.randomUUID()}_${imageFile.name}`;
      imageName = imageFile.name;
      await supabase.storage.from('photos').upload(imagePath, imageFile);
    }

    const { data: row } = await supabase.from('messages').insert({
      project_id: data.projectId,
      sender_name: data.senderName,
      content: data.content,
      image_path: imagePath || null,
      image_name: imageName || null,
      message_type: imageFile ? 'image' : (data.messageType || 'text'),
      related_task_id: data.relatedTaskId || null,
      related_request_id: data.relatedRequestId || null,
    }).select().single();

    if (row) set((s) => ({ messages: [...s.messages, mapMessage(row)] }));
  },

  deleteMessage: async (id) => {
    const { data: row } = await supabase.from('messages').select('image_path').eq('id', id).single();
    if (row?.image_path) await supabase.storage.from('photos').remove([row.image_path]);
    await supabase.from('messages').delete().eq('id', id);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
  },

  loadPhotos: async (projectId) => {
    const { data } = await supabase.from('project_photos').select('*').eq('project_id', projectId).order('date', { ascending: false });
    set({ photos: (data || []).map(mapPhoto) });
  },

  addPhoto: async (projectId, file, description) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const filePath = `${user.id}/${projectId}/${crypto.randomUUID()}_${file.name}`;
    await supabase.storage.from('photos').upload(filePath, file);

    const { data: row } = await supabase.from('project_photos').insert({
      project_id: projectId, file_name: file.name, file_path: filePath,
      description: description || '', date: new Date().toISOString().split('T')[0],
    }).select().single();
    if (row) set((s) => ({ photos: [mapPhoto(row), ...s.photos] }));
  },

  deletePhoto: async (id) => {
    const { data: row } = await supabase.from('project_photos').select('file_path').eq('id', id).single();
    if (row?.file_path) await supabase.storage.from('photos').remove([row.file_path]);
    await supabase.from('project_photos').delete().eq('id', id);
    set((s) => ({ photos: s.photos.filter((p) => p.id !== id) }));
  },
}));
