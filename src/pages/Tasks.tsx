import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTaskStore } from '@/store/useTaskStore';
import { useUserStore } from '@/store/useUserStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Trash2, CheckSquare, Clock, AlertTriangle, Camera, Send, Paperclip, MessageCircle, X, Image as ImageIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getStorageUrl } from '@/lib/supabase';
import type { Task, MaterialRequest, Message } from '@/types';

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

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Danas';
  if (isSameDay(date, yesterday)) return 'Jučer';
  return formatDate(dateStr);
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, onDelete, onImageClick }: { message: Message; onDelete: (id: string) => void; onImageClick: (url: string) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const isSystem = message.messageType === 'task_update' || message.messageType === 'request_update';

  useEffect(() => {
    if (message.imagePath) {
      getStorageUrl('photos', message.imagePath).then(setImageUrl);
    }
  }, [message.imagePath]);

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full max-w-[80%] text-center">
          {message.content}
          <span className="ml-2 opacity-60">{formatTime(message.createdAt)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 group px-2">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-1">
        {getInitials(message.senderName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{message.senderName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
        {message.content && (
          <p className="text-sm mt-0.5 break-words">{message.content}</p>
        )}
        {imageUrl && (
          <div
            className="mt-2 cursor-pointer inline-block"
            onClick={() => onImageClick(imageUrl)}
          >
            <img
              src={imageUrl}
              alt={message.imageName || 'Slika'}
              className="max-w-[200px] max-h-[200px] rounded-lg border object-cover hover:opacity-90 transition-opacity"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ImagePreviewDialog({ url, open, onClose }: { url: string | null; open: boolean; onClose: () => void }) {
  if (!url) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose} className="max-w-3xl p-2">
        <img src={url} alt="Pregled" className="w-full h-auto rounded" />
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({ task, open, onClose, onUpdate, onDelete }: {
  task: Task | null; open: boolean; onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void; onDelete: (id: string) => void;
}) {
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose} className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task.title}
            <Badge variant={priorityConfig[task.priority].variant}>
              {priorityConfig[task.priority].label}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Select
              value={task.status}
              onChange={(e) => onUpdate(task.id, { status: e.target.value as Task['status'] })}
            >
              <option value="pending">Na čekanju</option>
              <option value="in_progress">U toku</option>
              <option value="completed">Završen</option>
            </Select>
          </div>
          {task.description && (
            <div>
              <Label className="text-muted-foreground text-xs">Opis</Label>
              <p className="text-sm mt-1">{task.description}</p>
            </div>
          )}
          {task.assignedTo && (
            <div>
              <Label className="text-muted-foreground text-xs">Dodijeljeno</Label>
              <p className="text-sm mt-1">{task.assignedTo}</p>
            </div>
          )}
          {task.deadline && (
            <div>
              <Label className="text-muted-foreground text-xs">Rok</Label>
              <p className="text-sm mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(task.deadline)}</p>
            </div>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Kreirano: {formatDate(task.createdAt)}</span>
            <span>Ažurirano: {formatDate(task.updatedAt)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={() => { onDelete(task.id); onClose(); }}>
            <Trash2 className="h-4 w-4 mr-2" />Obriši
          </Button>
          <Button variant="outline" onClick={onClose}>Zatvori</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetailDialog({ request, open, onClose }: {
  request: MaterialRequest | null; open: boolean; onClose: () => void;
}) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!request) return;
    request.photos.forEach(async (p) => {
      if (p.filePath) {
        const url = await getStorageUrl('photos', p.filePath);
        if (url) setPhotoUrls((prev) => ({ ...prev, [p.id]: url }));
      }
    });
  }, [request]);

  if (!request) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent onClose={onClose} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Trebovanje - {request.createdBy}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-xs">Status</Label>
            <Badge variant={statusConfig[request.status]?.variant || 'secondary'} className="ml-2">
              {request.status === 'pending' ? 'Na čekanju' : request.status === 'approved' ? 'Odobreno' : 'Naručeno'}
            </Badge>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Opis</Label>
            <p className="text-sm mt-1">{request.description}</p>
          </div>
          {request.photos.length > 0 && (
            <div>
              <Label className="text-muted-foreground text-xs">Fotografije ({request.photos.length})</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {request.photos.map((p) => (
                  <div key={p.id} className="aspect-square rounded-lg border overflow-hidden bg-muted">
                    {photoUrls[p.id] ? (
                      <img src={photoUrls[p.id]} alt={p.fileName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Kreirano: {formatDate(request.createdAt)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zatvori</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Tasks() {
  const { projectId } = useParams();
  const {
    tasks, loadTasks, addTask, updateTask, deleteTask,
    materialRequests, loadMaterialRequests, addMaterialRequest, updateMaterialRequestStatus,
    messages, loadMessages, sendMessage, deleteMessage,
  } = useTaskStore();
  const { projectMembers, loadProjectMembers } = useUserStore();

  const [activeTab, setActiveTab] = useState('messages');
  const [search, setSearch] = useState('');
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [requestPhotos, setRequestPhotos] = useState<File[]>([]);

  // Chat state
  const [msgText, setMsgText] = useState('');
  const [msgSender, setMsgSender] = useState('');
  const [msgImage, setMsgImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Detail dialogs
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadTasks(projectId);
      loadMaterialRequests(projectId);
      loadMessages(projectId);
      loadProjectMembers(projectId);
    }
  }, [projectId, loadTasks, loadMaterialRequests, loadMessages, loadProjectMembers]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.assignedTo.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRequests = materialRequests.filter((r) =>
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.createdBy.toLowerCase().includes(search.toLowerCase())
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

  const handleSendMessage = async () => {
    if (!projectId || !msgSender.trim() || (!msgText.trim() && !msgImage)) return;
    setSending(true);
    await sendMessage({
      projectId,
      senderName: msgSender.trim(),
      content: msgText.trim(),
    }, msgImage || undefined);
    setMsgText('');
    setMsgImage(null);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setMsgImage(file);
    }
  }, []);

  // Group messages by date
  const groupedMessages: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (label !== currentLabel) {
      currentLabel = label;
      groupedMessages.push({ label, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl lg:text-2xl font-bold">Zadaci i komunikacija</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <TabsList>
            <TabsTrigger value="messages">
              <MessageCircle className="h-4 w-4 mr-1" />
              Poruke
            </TabsTrigger>
            <TabsTrigger value="tasks">Zadaci ({tasks.length})</TabsTrigger>
            <TabsTrigger value="requests">Trebovanja ({materialRequests.length})</TabsTrigger>
          </TabsList>
          {activeTab === 'tasks' && (
            <Button onClick={() => { setTaskForm(emptyTaskForm); setTaskDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novi zadatak
            </Button>
          )}
          {activeTab === 'requests' && (
            <Button onClick={() => { setRequestForm(emptyRequestForm); setRequestDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo trebovanje
            </Button>
          )}
        </div>

        {/* Search bar - only for tasks and requests */}
        {activeTab !== 'messages' && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        )}

        {/* PORUKE TAB */}
        <TabsContent value="messages" className="flex-1 flex flex-col min-h-0 mt-0">
          <Card className="flex-1 flex flex-col min-h-0">
            {/* Chat messages area */}
            <CardContent
              className={`flex-1 overflow-y-auto p-4 space-y-1 min-h-[300px] max-h-[60vh] ${dragOver ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mb-4" />
                  <p>Nema poruka</p>
                  <p className="text-xs mt-1">Započnite komunikaciju sa timom</p>
                </div>
              ) : (
                groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 border-t" />
                      <span className="text-xs text-muted-foreground px-2">{group.label}</span>
                      <div className="flex-1 border-t" />
                    </div>
                    <div className="space-y-3">
                      {group.messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          onDelete={deleteMessage}
                          onImageClick={(url) => setPreviewImage(url)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </CardContent>

            {/* Input bar */}
            <div className="border-t p-3 space-y-2">
              {/* Sender name */}
              {projectMembers.length > 0 ? (
                <Select
                  value={msgSender}
                  onChange={(e) => setMsgSender(e.target.value)}
                  className="text-sm h-8"
                >
                  <option value="">Izaberite ime...</option>
                  {projectMembers.map((pm) => (
                    <option key={pm.id} value={pm.userName || ''}>
                      {pm.userName}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  placeholder="Vaše ime..."
                  value={msgSender}
                  onChange={(e) => setMsgSender(e.target.value)}
                  className="text-sm h-8"
                />
              )}

              {/* Image preview */}
              {msgImage && (
                <div className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                  <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{msgImage.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setMsgImage(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Message input + buttons */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setMsgImage(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  placeholder="Napišite poruku..."
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="resize-none min-h-[36px]"
                />
                <Button
                  className="shrink-0"
                  disabled={sending || !msgSender.trim() || (!msgText.trim() && !msgImage)}
                  onClick={handleSendMessage}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ZADACI TAB */}
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
                <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTask(task)}>
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
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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

        {/* TREBOVANJA TAB */}
        <TabsContent value="requests">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nema trebovanja</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req) => (
                <Card key={req.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedRequest(req)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Trebovanje - {req.createdBy}</CardTitle>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={updateTask}
        onDelete={deleteTask}
      />

      {/* Request Detail Dialog */}
      <RequestDetailDialog
        request={selectedRequest}
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        url={previewImage}
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
      />

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
              {projectMembers.length > 0 ? (
                <Select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                >
                  <option value="">Izaberite osobu...</option>
                  {projectMembers.map((pm) => (
                    <option key={pm.id} value={pm.userName || ''}>
                      {pm.userName}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input value={taskForm.assignedTo} onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} placeholder="Ime saradnika" />
              )}
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
              {projectMembers.length > 0 ? (
                <Select
                  value={requestForm.createdBy}
                  onChange={(e) => setRequestForm({ ...requestForm, createdBy: e.target.value })}
                >
                  <option value="">Izaberite osobu...</option>
                  {projectMembers.map((pm) => (
                    <option key={pm.id} value={pm.userName || ''}>
                      {pm.userName}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input value={requestForm.createdBy} onChange={(e) => setRequestForm({ ...requestForm, createdBy: e.target.value })} placeholder="Ime saradnika" />
              )}
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
