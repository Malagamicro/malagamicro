import { useState, useEffect } from 'react';
import { useWorkspaceDetail } from '@/hooks/useWorkspaces';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Trash2, Users, X, Bot,
} from 'lucide-react';
import { WorkspaceAIChat } from './WorkspaceAIChat';
import { WorkspaceFiles } from './WorkspaceFiles';
import { PAGE_TYPES, ROLE_LABELS } from './WorkspaceDetailConstants';
import {
  EmptyState, NoteEditor, KanbanBoard, TaskList,
  CanvasView, AIChatPage, TeamChatPage, MemberInvite,
} from './WorkspaceDetailSubComponents';

interface WorkspaceDetailProps {
  workspaceId: string;
  onBack: () => void;
}

export function WorkspaceDetail({ workspaceId, onBack }: WorkspaceDetailProps) {
  const { user } = useAuth();
  const { pages, tasks, members, loading, createPage, updatePage, deletePage, createTask, updateTask, deleteTask, addMember, removeMember, updateMemberRole } = useWorkspaceDetail(workspaceId);
  const [activePage, setActivePage] = useState<string | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageType, setNewPageType] = useState('note');
  const [showMembers, setShowMembers] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [showAIChat, setShowAIChat] = useState(false);

  useEffect(() => {
    supabase.from('workspaces').select('*').eq('id', workspaceId).single()
      .then(({ data }) => { if (data) setWorkspace(data); });
  }, [workspaceId]);

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
  const currentMember = members.find(m => m.user_id === user?.id);
  const userRole: 'owner' | 'editor' | 'reader' = (currentMember?.role as any) || (workspace?.created_by === user?.id ? 'owner' : 'reader');
  const isOwner = userRole === 'owner';
  const canEdit = userRole === 'owner' || userRole === 'editor';

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
        <Badge variant="secondary" className="text-[10px] gap-1">
          {ROLE_LABELS[userRole]?.label || userRole}
        </Badge>
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
            {canEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNewPage(true)}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
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
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                      onClick={e => { e.stopPropagation(); deletePage(page.id); if (activePage === page.id) setActivePage(null); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
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
        <div className={cn("flex-1 min-w-0", currentPage?.page_type === 'canvas' ? 'overflow-hidden' : 'overflow-auto')}>
          {!activePage ? (
            <EmptyState onCreatePage={() => setShowNewPage(true)} canEdit={canEdit} />
          ) : currentPage?.page_type === 'note' ? (
            <NoteEditor page={currentPage} onUpdate={updatePage} canEdit={canEdit} />
          ) : currentPage?.page_type === 'kanban' ? (
            <KanbanBoard tasks={tasks.filter(t => t.page_id === currentPage.id || !t.page_id)} workspaceId={workspaceId} pageId={currentPage.id} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} profiles={profiles} members={members} canEdit={canEdit} />
          ) : currentPage?.page_type === 'tasks' ? (
            <TaskList tasks={tasks.filter(t => t.page_id === currentPage.id || !t.page_id)} workspaceId={workspaceId} pageId={currentPage.id} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} profiles={profiles} members={members} canEdit={canEdit} />
          ) : currentPage?.page_type === 'canvas' ? (
            <CanvasView page={currentPage} onUpdate={updatePage} canEdit={canEdit} />
          ) : currentPage?.page_type === 'files' ? (
            <WorkspaceFiles workspaceId={workspaceId} userRole={userRole} />
          ) : currentPage?.page_type === 'ai_chat' ? (
            <AIChatPage page={currentPage} onUpdate={updatePage} canEdit={canEdit} />
          ) : currentPage?.page_type === 'team_chat' ? (
            <TeamChatPage workspaceId={workspaceId} page={currentPage} profiles={profiles} members={members} />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Miembros del espacio</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {isOwner && (
              <MemberInvite workspaceId={workspaceId} existingMembers={members} onAdd={addMember} />
            )}
            <div className="space-y-1.5 max-h-60 overflow-auto">
              {members.map(m => {
                const roleInfo = ROLE_LABELS[m.role] || ROLE_LABELS.reader;
                const RoleIcon = roleInfo.icon;
                return (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2.5">
                      <RoleIcon className={cn('h-4 w-4', roleInfo.color)} />
                      <div>
                        <p className="text-sm font-medium">{profiles[m.user_id] || 'Usuario'}</p>
                        <p className="text-[10px] text-muted-foreground">{roleInfo.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isOwner && m.user_id !== user?.id && (
                        <Select value={m.role} onValueChange={val => updateMemberRole(m.id, val)}>
                          <SelectTrigger className="h-7 w-28 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Propietario</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="reader">Lector</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {m.user_id !== user?.id && isOwner && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(m.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
