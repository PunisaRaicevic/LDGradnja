import { create } from 'zustand';
import type { AppUser, ProjectMember } from '@/types';
import { supabase } from '@/lib/supabase';

interface UserStore {
  users: AppUser[];
  projectMembers: ProjectMember[];
  loading: boolean;

  loadUsers: () => Promise<void>;
  createUser: (data: { username: string; password: string; fullName: string; phone: string; role: 'admin' | 'worker'; email?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<Pick<AppUser, 'fullName' | 'phone' | 'role' | 'email'>>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  loadProjectMembers: (projectId: string) => Promise<void>;
  addProjectMember: (projectId: string, userId: string, role: 'admin' | 'worker') => Promise<void>;
  removeProjectMember: (memberId: string) => Promise<void>;
}

function mapUser(r: any): AppUser {
  return {
    id: r.id,
    adminId: r.admin_id,
    username: r.username || null,
    email: r.email || '',
    fullName: r.full_name,
    phone: r.phone || '',
    role: r.role,
    authUserId: r.auth_user_id || null,
    createdAt: r.created_at,
  };
}

function mapMember(r: any): ProjectMember {
  return {
    id: r.id,
    projectId: r.project_id,
    userId: r.user_id,
    role: r.role,
    addedAt: r.added_at,
    userName: r.app_users?.full_name,
    userEmail: r.app_users?.email,
    projectName: r.projects?.name,
  };
}

export const useUserStore = create<UserStore>((set) => ({
  users: [],
  projectMembers: [],
  loading: false,

  loadUsers: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false });
    set({ users: (data || []).map(mapUser), loading: false });
  },

  createUser: async (data) => {
    // Account creation runs server-side in the `create-user` Edge Function
    // (service role). This lets public signups stay DISABLED, and avoids the
    // old client-side signUp that briefly swapped the admin's own session and
    // could leave orphaned auth accounts on partial failure.
    const { data: result, error } = await supabase.functions.invoke('create-user', {
      body: {
        username: data.username,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        email: data.email || null,
      },
    });

    if (error) {
      // On a non-2xx response the function's JSON body (with our friendly
      // { error } message) is on error.context, a Response object.
      let msg = error.message;
      try {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === 'function') {
          const parsed = await ctx.json();
          if (parsed?.error) msg = parsed.error;
        }
      } catch { /* fall back to error.message */ }
      throw new Error(msg);
    }
    if (result?.error) throw new Error(result.error);
    if (result?.user) set((s) => ({ users: [mapUser(result.user), ...s.users] }));
  },

  updateUser: async (id, data) => {
    const u: Record<string, any> = {};
    if (data.fullName !== undefined) u.full_name = data.fullName;
    if (data.phone !== undefined) u.phone = data.phone;
    if (data.role !== undefined) u.role = data.role;
    if (data.email !== undefined) u.email = data.email;

    const { error } = await supabase.from('app_users').update(u).eq('id', id);
    if (error) {
      console.error('Error updating user:', error.message);
      throw new Error(error.message);
    }
    set((s) => ({
      users: s.users.map((usr) =>
        usr.id === id ? { ...usr, ...data } : usr
      ),
    }));
  },

  deleteUser: async (id) => {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) {
      console.error('Error deleting user:', error.message);
      throw new Error(error.message);
    }
    set((s) => ({
      users: s.users.filter((u) => u.id !== id),
      projectMembers: s.projectMembers.filter((pm) => pm.userId !== id),
    }));
  },

  loadProjectMembers: async (projectId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('project_members')
      .select('*, app_users(full_name, email), projects(name)')
      .eq('project_id', projectId)
      .order('added_at', { ascending: false });
    set({ projectMembers: (data || []).map(mapMember), loading: false });
  },

  addProjectMember: async (projectId, userId, role) => {
    const { data: row, error } = await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: userId,
      role,
    }).select('*, app_users(full_name, email), projects(name)').single();

    if (error) {
      console.error('Error adding member:', error.message);
      throw new Error(error.message);
    }
    if (row) set((s) => ({ projectMembers: [mapMember(row), ...s.projectMembers] }));
  },

  removeProjectMember: async (memberId) => {
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (error) {
      console.error('Error removing member:', error.message);
      throw new Error(error.message);
    }
    set((s) => ({
      projectMembers: s.projectMembers.filter((pm) => pm.id !== memberId),
    }));
  },
}));
