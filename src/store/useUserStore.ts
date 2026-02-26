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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Generate internal email for Supabase Auth (workers may not have real email)
    const authEmail = data.email || `${data.username}@ldgradnja.local`;

    // 1. Save admin session before creating new user
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    if (!adminSession) throw new Error('Admin sesija nije aktivna');

    // 2. Create Supabase Auth account so the user can log in
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: data.password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    // 3. Restore admin session (signUp may have switched to new user)
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });

    // 4. Insert into app_users table with the auth user ID
    const { data: row, error } = await supabase.from('app_users').insert({
      admin_id: user.id,
      username: data.username,
      email: data.email || null,
      full_name: data.fullName,
      phone: data.phone,
      role: data.role,
      auth_user_id: authData.user?.id || null,
    }).select().single();

    if (error) {
      console.error('Error creating user:', error.message);
      throw new Error(error.message);
    }
    if (row) set((s) => ({ users: [mapUser(row), ...s.users] }));
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
