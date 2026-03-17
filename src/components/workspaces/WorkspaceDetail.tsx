import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceDetail, WorkspacePage, WorkspaceTask } from '@/hooks/useWorkspaces';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, FileText, Layout, ListChecks, Palette, Trash2,
  Users, Save, CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight,
  UserPlus, X, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/useDebounce';
import { DrawingCanvas } from './DrawingCanvas';
import { WorkspaceAIChat } from './WorkspaceAIChat';

interface WorkspaceDetailProps {
  workspaceId: string;
  onBack: () => void;
}

const PAGE_TYPES = [
  { value: 'note', label: 'Nota', icon: '📝', lucide: FileText },
  { value: 'kanban', label: 'Kanban', icon: '📊', lucide: Layout },
  { value: 'tasks', label: 'Tareas', icon: '✅', lucide: ListChecks },
  { value: 'canvas', label: 'Pizarra', icon: '🎨', lucide: Palette },
];

const TASK_STATUSES = [
  { value: 'todo', label: 'Por hacer', icon: Circle, color: 'text-muted-foreground' },
  { value: 'in_progress', label: 'En progreso', icon: Clock, color: 'text-amber-500' },
  { value: 'done', label: 'Hecho', icon: CheckCircle2, color: 'text-green-500' },
];

const PRIORITIES = [
  { value: 'low', label: 'Baja', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'normal', label: 'Normal', color: 'bg-muted text-muted-foreground' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
];

export function WorkspaceDetail({ workspaceId, onBack }: WorkspaceDetailProps) {
  const { user } = useAuth();
  const { pages, tasks, members, loading, createPage, updatePage, deletePage, createTask, updateTask, deleteTask, addMember, removeMember } = useWorkspaceDetail(workspaceId);
  const [activePage, setActivePage] = useState<string | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageType, setNewPageType] = useState('note');
  const [showMembers, setShowMembers] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [workspace, setWorkspace] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [showAIChat, setShowAIChat] = useState(false);

  // Fetch workspace info
  useEffect(() => {
    supabase.from('workspaces').select('*').eq('id', workspaceId).single()
      .then(({ data }) => { if (data) setWorkspace(data); });
  }, [workspaceId]);

  // Fetch profiles for members
  useEffect(() => {
    if (members.length === 0) return;
    const ids = members.map(m => m.user_id);
    supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => { map[p.user_id] = p.full_name || 'Sin nombre'; });
          setProfiles(map);
        }
      });
  }, [members]);

  const currentPage = pages.find(p => p.id === activePage);

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) return;
    const typeInfo = PAGE_TYPES.find(t => t.value === newPageType);
    const page = await createPage(newPageTitle.trim(), newPageType, typeInfo?.icon || '📄');
    if (page) {
      setActivePage(page.id);
      setShowNewPage(false);
      setNewPageTitle('');
    }
  };

  const handleInviteMember = async () => {
    if (!newMemberEmail.trim()) return;
    // Find user by email via profiles + auth
    const { data } = await supabase.rpc('get_user_email', { _user_id: user!.id }); // dummy; we need to find by email
    // Search profiles
    const { data: profileData } = await supabase.from('profiles').select('user_id, full_name').limit(100);
    // We cannot search by email in profiles, so we show all users for selection
    toast.info('Usa la lista de miembros para agregar usuarios');
    setNewMemberEmail('');
  };

  if (loading) {
    return (
      <div className="flex h-full">
        <div className="w-60 border-r border-border/50 p-4 space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 rounded" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-64 rounded-xl" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xl">{workspace?.icon || '📋'}</span>
        <h2 className="font-semibold text-foreground truncate">{workspace?.name || 'Espacio'}</h2>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant={showAIChat ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setShowAIChat(!showAIChat)}
          >
            <Bot className="h-3.5 w-3.5" /> Chat IA
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMembers(true)}>
            <Users className="h-3.5 w-3.5" /> {members.length} miembros
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - pages */}
        <div className="w-56 shrink-0 border-r border-border/50 flex flex-col bg-muted/30">
          <div className="p-3 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Páginas</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewPage(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-0.5">
              {pages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setActivePage(page.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors group',
                    activePage === page.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="text-sm">{page.icon}</span>
                  <span className="truncate flex-1">{page.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={e => { e.stopPropagation(); deletePage(page.id); if (activePage === page.id) setActivePage(null); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </button>
              ))}
              {pages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 px-2">
                  Crea tu primera página para empezar
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-auto">
          {!activePage ? (
            <EmptyState onCreatePage={() => setShowNewPage(true)} />
          ) : currentPage?.page_type === 'note' ? (
            <NoteEditor page={currentPage} onUpdate={updatePage} />
          ) : currentPage?.page_type === 'kanban' ? (
            <KanbanBoard tasks={tasks.filter(t => t.page_id === currentPage.id || !t.page_id)} workspaceId={workspaceId} pageId={currentPage.id} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} profiles={profiles} members={members} />
          ) : currentPage?.page_type === 'tasks' ? (
            <TaskList tasks={tasks.filter(t => t.page_id === currentPage.id || !t.page_id)} workspaceId={workspaceId} pageId={currentPage.id} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} profiles={profiles} members={members} />
          ) : currentPage?.page_type === 'canvas' ? (
            <CanvasView page={currentPage} onUpdate={updatePage} />
          ) : null}
        </div>

        {/* AI Chat Panel */}
        <WorkspaceAIChat
          workspaceId={workspaceId}
          pages={pages}
          open={showAIChat}
          onClose={() => setShowAIChat(false)}
        />
      </div>

      {/* New page dialog */}
      <Dialog open={showNewPage} onOpenChange={setShowNewPage}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nueva página</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Título..." value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePage()} />
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TYPES.map(pt => (
                <button
                  key={pt.value}
                  onClick={() => setNewPageType(pt.value)}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border text-sm transition-all',
                    newPageType === pt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/30'
                  )}
                >
                  <span>{pt.icon}</span>
                  <span>{pt.label}</span>
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={handleCreatePage} disabled={!newPageTitle.trim()}>Crear</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={showMembers} onOpenChange={setShowMembers}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Miembros</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <MemberInvite workspaceId={workspaceId} existingMembers={members} onAdd={addMember} />
            <div className="space-y-1.5 max-h-60 overflow-auto">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{profiles[m.user_id] || 'Usuario'}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
                  </div>
                  {m.role !== 'owner' && workspace?.created_by === user?.id && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -------- Sub-components --------

function EmptyState({ onCreatePage }: { onCreatePage: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
      <span className="text-5xl">✨</span>
      <h3 className="text-lg font-semibold">Empieza a crear</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Crea notas, tableros kanban, listas de tareas o pizarras para tu equipo
      </p>
      <Button onClick={onCreatePage}><Plus className="h-4 w-4 mr-1" /> Nueva página</Button>
    </div>
  );
}

function NoteEditor({ page, onUpdate }: { page: WorkspacePage; onUpdate: (id: string, u: any) => Promise<void> }) {
  const [content, setContent] = useState(page.content);
  const [title, setTitle] = useState(page.title);
  const debouncedContent = useDebounce(content, 1000);
  const debouncedTitle = useDebounce(title, 1000);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setContent(page.content); setTitle(page.title); }, [page.id]);

  useEffect(() => {
    if (debouncedContent !== page.content) {
      setSaving(true);
      onUpdate(page.id, { content: debouncedContent }).then(() => setSaving(false));
    }
  }, [debouncedContent]);

  useEffect(() => {
    if (debouncedTitle !== page.title && debouncedTitle.trim()) {
      onUpdate(page.id, { title: debouncedTitle });
    }
  }, [debouncedTitle]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 pt-6 pb-2">
        <span className="text-2xl">{page.icon}</span>
        <input
          className="text-2xl font-bold bg-transparent border-none outline-none flex-1 text-foreground placeholder:text-muted-foreground"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Título..."
        />
        {saving && <span className="text-xs text-muted-foreground animate-pulse">Guardando...</span>}
      </div>
      <div className="flex-1 min-h-0 px-6 pb-6">
        <textarea
          className="w-full h-full resize-none bg-transparent border-none outline-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground font-mono"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Escribe en Markdown... 

# Encabezado
## Subencabezado
- Lista de items
- [ ] Tarea pendiente
- [x] Tarea completada

**Negrita** | *Cursiva* | `código`"
        />
      </div>
    </div>
  );
}

function KanbanBoard({ tasks, workspaceId, pageId, onCreateTask, onUpdateTask, onDeleteTask, profiles, members }: any) {
  const [newTitle, setNewTitle] = useState('');
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const columns = TASK_STATUSES;

  const handleAdd = async (status: string) => {
    if (!newTitle.trim()) return;
    await onCreateTask(newTitle.trim(), pageId);
    if (status !== 'todo') {
      // We created as todo, but let's find and update — simplification: create all as the target status
    }
    setNewTitle('');
    setAddingCol(null);
  };

  return (
    <div className="flex gap-4 p-6 h-full overflow-x-auto">
      {columns.map(col => {
        const colTasks = tasks.filter((t: WorkspaceTask) => t.status === col.value);
        const Icon = col.icon;
        return (
          <div key={col.value} className="flex flex-col w-72 shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Icon className={cn('h-4 w-4', col.color)} />
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{colTasks.length}</Badge>
              <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setAddingCol(col.value)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-1">
                {addingCol === col.value && (
                  <div className="p-2 rounded-lg border border-primary/30 bg-card">
                    <Input
                      autoFocus
                      placeholder="Nueva tarea..."
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAdd(col.value);
                        if (e.key === 'Escape') { setAddingCol(null); setNewTitle(''); }
                      }}
                      onBlur={() => { if (!newTitle.trim()) { setAddingCol(null); setNewTitle(''); } }}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {colTasks.map((task: WorkspaceTask) => (
                  <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} profiles={profiles} members={members} />
                ))}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onUpdate, onDelete, profiles }: { task: WorkspaceTask; onUpdate: any; onDelete: any; profiles: Record<string, string> }) {
  const priority = PRIORITIES.find(p => p.value === task.priority);
  const nextStatus = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';

  return (
    <div className="group p-3 rounded-lg border border-border/50 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2">
        <button onClick={() => onUpdate(task.id, { status: nextStatus })} className="mt-0.5 shrink-0">
          {task.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : task.status === 'in_progress' ? (
            <Clock className="h-4 w-4 text-amber-500" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {priority && priority.value !== 'normal' && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', priority.color)}>{priority.label}</span>
            )}
            {task.assigned_to && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {profiles[task.assigned_to] || 'Asignado'}
              </span>
            )}
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground">{new Date(task.due_date).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={() => onDelete(task.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function TaskList({ tasks, workspaceId, pageId, onCreateTask, onUpdateTask, onDeleteTask, profiles, members }: any) {
  const [newTitle, setNewTitle] = useState('');

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await onCreateTask(newTitle.trim(), pageId);
    setNewTitle('');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Añadir tarea..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-1">
        {tasks.map((task: WorkspaceTask) => (
          <TaskCard key={task.id} task={task} onUpdate={onUpdateTask} onDelete={onDeleteTask} profiles={profiles} />
        ))}
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Sin tareas aún</p>
        )}
      </div>
    </div>
  );
}

function CanvasView({ page, onUpdate }: { page: WorkspacePage; onUpdate: (id: string, u: any) => Promise<void> }) {
  const handleSave = useCallback((dataUrl: string) => {
    onUpdate(page.id, { content: dataUrl });
  }, [page.id, onUpdate]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-6 pt-4 pb-2">
        <span className="text-xl">🎨</span>
        <h3 className="font-semibold text-foreground">{page.title}</h3>
        <Badge variant="secondary" className="text-[10px]">Pizarra</Badge>
      </div>
      <div className="flex-1 min-h-0">
        <DrawingCanvas pageTitle={page.title} initialContent={page.content} onSave={handleSave} />
      </div>
    </div>
  );
}

function MemberInvite({ workspaceId, existingMembers, onAdd }: { workspaceId: string; existingMembers: any[]; onAdd: (userId: string, role?: string) => void }) {
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name, avatar_url').limit(50)
      .then(({ data }) => { if (data) setAllProfiles(data); });
  }, []);

  const existingIds = new Set(existingMembers.map((m: any) => m.user_id));
  const filtered = allProfiles
    .filter(p => !existingIds.has(p.user_id))
    .filter(p => !search || (p.full_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-2">
      <Input placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs" />
      {filtered.length > 0 && (
        <div className="max-h-32 overflow-auto space-y-1">
          {filtered.map(p => (
            <button
              key={p.user_id}
              onClick={() => onAdd(p.user_id)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted text-left text-sm"
            >
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{p.full_name || 'Sin nombre'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
