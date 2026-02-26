import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Trash2, UserPlus, Mail, Phone, Shield, X, User } from 'lucide-react';
import type { AppUser } from '@/types';

const emptyForm = {
  fullName: '',
  username: '',
  password: '',
  email: '',
  phone: '',
  role: 'worker' as 'admin' | 'worker',
};

export default function Users() {
  const {
    users, loading, loadUsers, createUser, updateUser, deleteUser,
    projectMembers, loadProjectMembers, addProjectMember, removeProjectMember,
  } = useUserStore();
  const { projects, loadProjects } = useProjectStore();

  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail modal
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);

  // Project assignment
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignRole, setAssignRole] = useState<'admin' | 'worker'>('worker');

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, [loadUsers, loadProjects]);

  const filteredUsers = users.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.fullName || !form.username || !form.password) {
      setFormError('Ime, korisničko ime i lozinka su obavezni.');
      return;
    }
    if (form.username.length < 3) {
      setFormError('Korisničko ime mora imati najmanje 3 karaktera.');
      return;
    }
    if (form.password.length < 6) {
      setFormError('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createUser({
        username: form.username,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        role: form.role,
        email: form.email || undefined,
      });
      setCreateDialogOpen(false);
      setForm(emptyForm);
    } catch (err: any) {
      setFormError(err.message || 'Greška pri kreiranju korisnika.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDetail = (user: AppUser) => {
    setSelectedUser(user);
    setEditForm({
      fullName: user.fullName,
      username: user.username || '',
      password: '',
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
    setEditMode(false);
    setDetailOpen(true);
    loadProjectMembers('');
    // Load all project members for this user - we load per project, so load for all projects
    loadUserProjectMembers(user.id);
  };

  const loadUserProjectMembers = async (userId: string) => {
    // We need to query project_members for this specific user
    // Since the store loads by projectId, we'll use supabase directly
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase
      .from('project_members')
      .select('*, app_users(full_name, email), projects(name)')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    if (data) {
      useUserStore.setState({
        projectMembers: data.map((r: any) => ({
          id: r.id,
          projectId: r.project_id,
          userId: r.user_id,
          role: r.role,
          addedAt: r.added_at,
          userName: r.app_users?.full_name,
          userEmail: r.app_users?.email,
          projectName: r.projects?.name,
        })),
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await updateUser(selectedUser.id, editForm);
      setSelectedUser({ ...selectedUser, ...editForm });
      setEditMode(false);
    } catch (err: any) {
      setFormError(err.message || 'Greška pri ažuriranju.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Da li ste sigurni da želite obrisati ovog korisnika?')) return;
    try {
      await deleteUser(userId);
      setDetailOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      alert('Greška: ' + (err.message || 'Nije moguće obrisati korisnika.'));
    }
  };

  const handleAddToProject = async () => {
    if (!selectedUser || !assignProjectId) return;
    // Check if already assigned (prevent duplicate)
    if (projectMembers.some((pm) => pm.projectId === assignProjectId)) {
      alert('Korisnik je već dodijeljen na ovaj projekat.');
      return;
    }
    try {
      await addProjectMember(assignProjectId, selectedUser.id, assignRole);
    } catch (err: any) {
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        // Already exists, just refresh the list
      } else {
        alert('Greška: ' + (err.message || 'Nije moguće dodati korisnika.'));
        return;
      }
    }
    await loadUserProjectMembers(selectedUser.id);
    setAssignProjectId('');
  };

  const handleRemoveFromProject = async (memberId: string) => {
    try {
      await removeProjectMember(memberId);
      if (selectedUser) await loadUserProjectMembers(selectedUser.id);
    } catch (err: any) {
      alert('Greška: ' + err.message);
    }
  };

  // Projects the selected user is NOT already on
  const availableProjects = projects.filter(
    (p) => !projectMembers.some((pm) => pm.projectId === p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl lg:text-2xl font-bold">Korisnici</h1>
        <Button onClick={() => { setForm(emptyForm); setFormError(''); setCreateDialogOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-2" />Novi korisnik
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži korisnike..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading && users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Učitavanje...</div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {search ? 'Nema rezultata pretrage' : 'Nema korisnika. Dodajte prvog korisnika.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleOpenDetail(user)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{user.fullName}</h3>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : 'Radnik'}
                      </Badge>
                    </div>
                    {user.username && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{user.username}</span>
                      </div>
                    )}
                    {user.email && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                    {user.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>
                  {user.authUserId && (
                    <span title="Registrovan">
                      <Shield className="h-4 w-4 text-green-500 flex-shrink-0" />
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent onClose={() => setCreateDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novi korisnik</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {formError && (
              <div className="text-sm text-destructive bg-destructive/10 rounded p-2">{formError}</div>
            )}
            <div>
              <Label>Ime i prezime *</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Npr. Marko Marković" />
            </div>
            <div>
              <Label>Korisničko ime *</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Npr. marko" />
            </div>
            <div>
              <Label>Lozinka *</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Najmanje 6 karaktera" />
            </div>
            <div>
              <Label>Email (opciono)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="marko@firma.com" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+387 61 123 456" />
            </div>
            <div>
              <Label>Uloga</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'worker' })}>
                <option value="worker">Radnik</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Kreiranje...' : 'Kreiraj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent onClose={() => setDetailOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Uredi korisnika' : 'Detalji korisnika'}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* User info */}
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <Label>Ime i prezime</Label>
                    <Input value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Telefon</Label>
                    <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Uloga</Label>
                    <Select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'worker' })}>
                      <option value="worker">Radnik</option>
                      <option value="admin">Admin</option>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdate} disabled={saving}>
                      {saving ? 'Čuvanje...' : 'Sačuvaj'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Otkaži</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{selectedUser.fullName}</h3>
                    <Badge variant={selectedUser.role === 'admin' ? 'default' : 'secondary'}>
                      {selectedUser.role === 'admin' ? 'Admin' : 'Radnik'}
                    </Badge>
                    {selectedUser.authUserId && (
                      <Badge variant="success">Aktivan</Badge>
                    )}
                  </div>
                  {selectedUser.username && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />Korisničko ime: {selectedUser.username}
                    </div>
                  )}
                  {selectedUser.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />{selectedUser.email}
                    </div>
                  )}
                  {selectedUser.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />{selectedUser.phone}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>Uredi</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedUser.id)}>
                      <Trash2 className="h-4 w-4 mr-1" />Obriši
                    </Button>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="border-t" />

              {/* Project assignments */}
              <div>
                <h4 className="font-semibold mb-3">Projekti</h4>

                {/* Current assignments */}
                {projectMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground mb-3">Korisnik nije dodijeljen ni na jedan projekat.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {projectMembers.map((pm) => (
                      <div key={pm.id} className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{pm.projectName || 'Projekat'}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {pm.role === 'admin' ? 'Admin' : 'Radnik'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemoveFromProject(pm.id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add to project */}
                {availableProjects.length > 0 && (
                  <div className="flex gap-2">
                    <Select
                      value={assignProjectId}
                      onChange={(e) => setAssignProjectId(e.target.value)}
                      className="flex-1"
                    >
                      <option value="">Izaberi projekat...</option>
                      {availableProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                    <Select
                      value={assignRole}
                      onChange={(e) => setAssignRole(e.target.value as 'admin' | 'worker')}
                      className="w-28"
                    >
                      <option value="worker">Radnik</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleAddToProject}
                      disabled={!assignProjectId}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
