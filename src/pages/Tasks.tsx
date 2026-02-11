import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTaskStore } from '@/store/useTaskStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Trash2, CheckSquare, Clock, AlertTriangle, Camera } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { Task, MaterialRequest } from '@/types';

const priorityConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'warning' | 'destructive' }> = {
  low: { label: 'Nizak', variant: 'secondary' },
  medium: { label: 'Srednji', variant: 'default' },
  high: { label: 'Visok', variant: 'warning' },
  urgent: { label: 'Hitan', variant: 'destructive' },
};

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  pending: { label: 'Na čekanju', variant: 'secondary' },
  in_progress: { label: 'U toku', variant: 'warning' },
  completed: { label: 'Završen', variant: 'success' },
};

const emptyTaskForm = {
  title: '',
  description: '',
  priority: 'medium' as Task['priority'],
  deadline: '',
  assignedTo: '',
  status: 'pending' as Task['status'],
};

const emptyRequestForm = {
  description: '',
  createdBy: '',
  status: 'pending' as MaterialRequest['status'],
};

export default function Tasks() {
  const { projectId } = useParams();
  const {
    tasks, loadTasks, addTask, updateTask, deleteTask,
    materialRequests, loadMaterialRequests, addMaterialRequest, updateMaterialRequestStatus,
  } = useTaskStore();
  const [activeTab, setActiveTab] = useState('tasks');
  const [search, setSearch] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [requestPhotos, setRequestPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (projectId) {
      loadTasks(projectId);
      loadMaterialRequests(projectId);
    }
  }, [projectId, loadTasks, loadMaterialRequests]);

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.assignedTo.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveTask = async () => {
    if (!projectId || !taskForm.title) return;
    await addTask({ ...taskForm, projectId });
    setTaskDialogOpen(false);
    setTaskForm(emptyTaskForm);
  };

  const handleSaveRequest = async () => {
    if (!projectId || !requestForm.description) return;
    await addMaterialRequest({ ...requestForm, projectId }, requestPhotos);
    setRequestDialogOpen(false);
    setRequestForm(emptyRequestForm);
    setRequestPhotos([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Zadaci i komunikacija</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="tasks">Zadaci ({tasks.length})</TabsTrigger>
            <TabsTrigger value="requests">Trebovanja ({materialRequests.length})</TabsTrigger>
          </TabsList>
          {activeTab === 'tasks' ? (
            <Button onClick={() => { setTaskForm(emptyTaskForm); setTaskDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novi zadatak
            </Button>
          ) : (
            <Button onClick={() => { setRequestForm(emptyRequestForm); setRequestDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo trebovanje
            </Button>
          )}
        </div>

        <TabsContent value="tasks">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nema zadataka</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{task.title}</CardTitle>
                        <Badge variant={priorityConfig[task.priority].variant}>
                          {priorityConfig[task.priority].label}
                        </Badge>
                        <Badge variant={statusConfig[task.status].variant}>
                          {statusConfig[task.status].label}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Select
                          value={task.status}
                          onChange={(e) => updateTask(task.id, { status: e.target.value as Task['status'] })}
                          className="w-32 h-8 text-xs"
                        >
                          <option value="pending">Na čekanju</option>
                          <option value="in_progress">U toku</option>
                          <option value="completed">Završen</option>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      {task.assignedTo && <span>Dodijeljeno: {task.assignedTo}</span>}
                      {task.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Rok: {formatDate(task.deadline)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {materialRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nema trebovanja</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {materialRequests.map((req) => (
                <Card key={req.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Trebovanje - {req.createdBy}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusConfig[req.status]?.variant || 'secondary'}>
                          {req.status === 'pending' ? 'Na čekanju' : req.status === 'approved' ? 'Odobreno' : 'Naručeno'}
                        </Badge>
                        <Select
                          value={req.status}
                          onChange={(e) => updateMaterialRequestStatus(req.id, e.target.value as MaterialRequest['status'])}
                          className="w-32 h-8 text-xs"
                        >
                          <option value="pending">Na čekanju</option>
                          <option value="approved">Odobreno</option>
                          <option value="ordered">Naručeno</option>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">{req.description}</p>
                    {req.photos.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{req.photos.length} fotografija</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(req.createdAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* New Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent onClose={() => setTaskDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novi zadatak</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Naslov *</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prioritet</Label>
                <Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Task['priority'] })}>
                  <option value="low">Nizak</option>
                  <option value="medium">Srednji</option>
                  <option value="high">Visok</option>
                  <option value="urgent">Hitan</option>
                </Select>
              </div>
              <div>
                <Label>Rok</Label>
                <Input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Dodijeljeno</Label>
              <Input value={taskForm.assignedTo} onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} placeholder="Ime saradnika" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveTask}>Kreiraj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Material Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent onClose={() => setRequestDialogOpen(false)} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo trebovanje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kreirao</Label>
              <Input value={requestForm.createdBy} onChange={(e) => setRequestForm({ ...requestForm, createdBy: e.target.value })} placeholder="Ime saradnika" />
            </div>
            <div>
              <Label>Opis potreba *</Label>
              <Textarea value={requestForm.description} onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })} rows={4} />
            </div>
            <div>
              <Label>Fotografije stanja</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setRequestPhotos(Array.from(e.target.files || []))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveRequest}>Kreiraj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
