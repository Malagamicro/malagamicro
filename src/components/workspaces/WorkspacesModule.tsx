import { useState } from 'react';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { WorkspaceDetail } from './WorkspaceDetail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Globe, Lock, Trash2, ArrowLeft, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const WORKSPACE_ICONS = ['📋', '🚀', '💡', '🎯', '📊', '🏗️', '🎨', '📚', '⚡', '🔬', '🌍', '🛠️', '📝', '🧠', '🎮'];

interface WorkspacesModuleProps {
  onBack?: () => void;
}

export function WorkspacesModule({ onBack }: WorkspacesModuleProps) {
  const { user } = useAuth();
  const { workspaces, loading, createWorkspace, deleteWorkspace } = useWorkspaces();
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('📋');
  const [newPublic, setNewPublic] = useState(false);

  if (activeWorkspace) {
    return (
      <WorkspaceDetail
        workspaceId={activeWorkspace}
        onBack={() => setActiveWorkspace(null)}
      />
    );
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ws = await createWorkspace(newName.trim(), newDesc.trim(), newPublic, newIcon);
    if (ws) {
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewIcon('📋');
      setNewPublic(false);
      setActiveWorkspace(ws.id);
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground">Espacios de Trabajo</h1>
            <p className="text-xs text-muted-foreground">Planifica, colabora y organiza en tiempo real</p>
          </div>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo espacio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Crear espacio de trabajo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {WORKSPACE_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewIcon(icon)}
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                        newIcon === icon
                          ? 'bg-primary/20 ring-2 ring-primary'
                          : 'hover:bg-muted'
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                placeholder="Nombre del espacio..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <Textarea
                placeholder="Descripción (opcional)..."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={2}
              />
              <div className="flex items-center gap-2">
                <Switch id="public" checked={newPublic} onCheckedChange={setNewPublic} />
                <Label htmlFor="public" className="flex items-center gap-1.5 text-sm">
                  {newPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {newPublic ? 'Público para todo el equipo' : 'Solo por invitación'}
                </Label>
              </div>
              <Button className="w-full" onClick={handleCreate} disabled={!newName.trim()}>
                Crear espacio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Workspace grid */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
            <span className="text-5xl">📋</span>
            <h3 className="text-lg font-semibold text-foreground">Sin espacios de trabajo</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Crea tu primer espacio para empezar a planificar con tu equipo
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> Crear espacio
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className="group relative text-left rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-lg transition-all p-5 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{ws.icon}</span>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {ws.created_by === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={e => { e.stopPropagation(); deleteWorkspace(ws.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground truncate">{ws.name}</h3>
                  {ws.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ws.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {ws.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {ws.is_public ? 'Público' : 'Privado'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    <Users className="h-3 w-3" />
                    Equipo
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
