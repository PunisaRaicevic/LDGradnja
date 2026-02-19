import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useProjectStore } from '@/store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, FileDown, Trash2, Pencil, BookOpen, CloudSun } from 'lucide-react';
import { formatDate, getToday } from '@/lib/utils';
import { generateDiaryPDF } from '@/lib/pdf';
import type { DiaryEntry } from '@/types';

const emptyForm = {
  date: getToday(),
  weather: '',
  temperature: '',
  workerCount: 0,
  workDescription: '',
  materials: '',
  specialEvents: '',
};

export default function ConstructionDiary() {
  const { projectId } = useParams();
  const { diaryEntries, loadDiaryEntries, addDiaryEntry, updateDiaryEntry, deleteDiaryEntry } = useFinanceStore();
  const { projects } = useProjectStore();
  const project = projects.find((p) => p.id === projectId);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (projectId) loadDiaryEntries(projectId);
  }, [projectId, loadDiaryEntries]);

  const filtered = diaryEntries.filter((e) =>
    e.workDescription.toLowerCase().includes(search.toLowerCase()) ||
    e.date.includes(search) ||
    e.materials.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, date: getToday() });
    setDialogOpen(true);
  };

  const openEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      weather: entry.weather,
      temperature: entry.temperature || '',
      workerCount: entry.workerCount,
      workDescription: entry.workDescription,
      materials: entry.materials,
      specialEvents: entry.specialEvents || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!projectId || !form.workDescription) return;
    if (editingId) {
      await updateDiaryEntry(editingId, form);
    } else {
      await addDiaryEntry({ ...form, projectId });
    }
    setDialogOpen(false);
  };

  const handleExportPDF = () => {
    if (!project) return;
    const doc = generateDiaryPDF(filtered, project.name);
    doc.save(`gradjevinski-dnevnik-${project.name}.pdf`);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold">Gradjevinska knjiga</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportPDF} disabled={diaryEntries.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Novi zapis
          </Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretrazi po datumu ili kljucnim rijecima..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nema zapisa u dnevniku</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{formatDate(entry.date)}</CardTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <CloudSun className="h-4 w-4" />
                      <span>{entry.weather}</span>
                      {entry.temperature && <span>({entry.temperature})</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDiaryEntry(entry.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Broj radnika:</span> {entry.workerCount}
                  </div>
                  <div>
                    <span className="font-medium">Izvrseni radovi:</span>
                    <p className="text-muted-foreground mt-1">{entry.workDescription}</p>
                  </div>
                  <div>
                    <span className="font-medium">Materijal:</span>
                    <p className="text-muted-foreground mt-1">{entry.materials}</p>
                  </div>
                  {entry.specialEvents && (
                    <div>
                      <span className="font-medium">Posebni dogadjaji:</span>
                      <p className="text-muted-foreground mt-1">{entry.specialEvents}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent onClose={() => setDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Uredi zapis' : 'Novi zapis'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Datum *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Broj radnika</Label>
                <Input type="number" value={form.workerCount} onChange={(e) => setForm({ ...form, workerCount: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vremenske prilike</Label>
                <Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="Npr. Suncano, Oblacno..." />
              </div>
              <div>
                <Label>Temperatura</Label>
                <Input value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="Npr. 22°C" />
              </div>
            </div>
            <div>
              <Label>Izvrseni radovi *</Label>
              <Textarea value={form.workDescription} onChange={(e) => setForm({ ...form, workDescription: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Materijal</Label>
              <Textarea value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Posebni dogadjaji</Label>
              <Textarea value={form.specialEvents} onChange={(e) => setForm({ ...form, specialEvents: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkazi</Button>
            <Button onClick={handleSave}>{editingId ? 'Sacuvaj' : 'Dodaj'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
