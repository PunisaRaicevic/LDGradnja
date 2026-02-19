import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, MapPin, Calendar, User, Pencil, Trash2 } from 'lucide-react';
import { formatDate, getToday } from '@/lib/utils';
import type { Project } from '@/types';

const statusVariant: Record<string, 'default' | 'success' | 'warning'> = {
  active: 'success',
  completed: 'default',
  paused: 'warning',
};

const statusLabel: Record<string, string> = {
  active: 'Aktivan',
  completed: 'Završen',
  paused: 'Pauziran',
};

const emptyForm = {
  name: '',
  location: '',
  startDate: getToday(),
  investor: '',
  status: 'active' as Project['status'],
  description: '',
};

export default function ProjectList() {
  const { projects, loadProjects, addProject, updateProject, deleteProject } = useProjectStore();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase()) ||
      p.investor.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      location: project.location,
      startDate: project.startDate,
      investor: project.investor,
      status: project.status,
      description: project.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.location || !form.investor) return;
    if (editingId) {
      await updateProject(editingId, form);
    } else {
      await addProject(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteProject(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold">Projekti</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novi projekat
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži projekte..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nema projekata za prikaz
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Link to={`/projects/${project.id}`}>
                    <CardTitle className="text-lg hover:text-primary cursor-pointer">
                      {project.name}
                    </CardTitle>
                  </Link>
                  <Badge variant={statusVariant[project.status]}>
                    {statusLabel[project.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{project.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{project.investor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(project.startDate)}</span>
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex gap-2">
                  <Link to={`/projects/${project.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Otvori
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(project)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(project.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Uredi projekat' : 'Novi projekat'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Naziv projekta *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Npr. Stambeni objekat Centar" />
            </div>
            <div>
              <Label>Lokacija *</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Npr. Banja Luka, Ul. Kralja Petra" />
            </div>
            <div>
              <Label>Investitor *</Label>
              <Input value={form.investor} onChange={(e) => setForm({ ...form, investor: e.target.value })} placeholder="Ime investitora" />
            </div>
            <div>
              <Label>Datum početka</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}>
                <option value="active">Aktivan</option>
                <option value="paused">Pauziran</option>
                <option value="completed">Završen</option>
              </Select>
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kratki opis projekta..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave}>{editingId ? 'Sačuvaj' : 'Kreiraj'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent onClose={() => setDeleteConfirm(null)} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Obriši projekat?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ova akcija je nepovratna. Svi podaci vezani za ovaj projekat će biti obrisani.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Otkaži</Button>
            <Button variant="destructive" onClick={handleDelete}>Obriši</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
