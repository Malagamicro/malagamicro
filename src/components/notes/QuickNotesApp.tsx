import { useState, useEffect, useCallback } from 'react';
import { useQuickNotes, QuickNote, NOTE_COLORS } from '@/hooks/useQuickNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Search, Trash2, Pin, PinOff, Loader2, StickyNote, Edit2, Save, X, ExternalLink, Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { openNoteWidget } from './noteWidgetHelper';

export function QuickNotesApp() {
  const { notes, isLoading, addNote, updateNote, deleteNote, togglePin } = useQuickNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [widgetWindows, setWidgetWindows] = useState<Record<string, Window | null>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<QuickNote | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState(NOTE_COLORS[0]);

  const filtered = notes.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!formContent.trim()) {
      toast.error('El contenido es obligatorio');
      return;
    }
    try {
      if (editingNote) {
        await updateNote.mutateAsync({
          id: editingNote.id,
          title: formTitle,
          content: formContent,
          color: formColor,
        });
        toast.success('Nota actualizada');
      } else {
        await addNote.mutateAsync({
          title: formTitle,
          content: formContent,
          color: formColor,
        });
        toast.success('Nota creada');
      }
      resetForm();
    } catch {
      toast.error('Error al guardar');
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormColor(NOTE_COLORS[0]);
    setIsAddOpen(false);
    setEditingNote(null);
  };

  const openEdit = (note: QuickNote) => {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormColor(note.color);
    setIsAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote.mutateAsync(id);
      toast.success('Nota eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openAsWidget = (note: QuickNote) => {
    if (widgetWindows[note.id] && !widgetWindows[note.id]!.closed) {
      widgetWindows[note.id]!.close();
      setWidgetWindows(prev => ({ ...prev, [note.id]: null }));
      toast.info('Widget cerrado');
      return;
    }

    const popup = openNoteWidget(note, handleWidgetSave);
    if (!popup) {
      toast.error('Permite las ventanas emergentes para usar widgets');
      return;
    }

    setWidgetWindows(prev => ({ ...prev, [note.id]: popup }));
    toast.success('Nota abierta como widget');

    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        setWidgetWindows(prev => ({ ...prev, [note.id]: null }));
      }
    }, 1000);
  };

  const handleWidgetSave = useCallback((id: string, title: string, content: string) => {
    updateNote.mutate({ id, title, content });
  }, [updateNote]);

  // Listen for save messages from widget windows
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'NOTE_WIDGET_SAVE') {
        handleWidgetSave(e.data.noteId, e.data.title, e.data.content);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleWidgetSave]);

  const isWidgetOpen = (noteId: string) => {
    return widgetWindows[noteId] && !widgetWindows[noteId]!.closed;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva nota
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-sm text-muted-foreground">
        <span>{notes.length} nota{notes.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{notes.filter(n => n.is_pinned).length} fijada{notes.filter(n => n.is_pinned).length !== 1 ? 's' : ''}</span>
      </div>

      {/* Notes grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <StickyNote className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {searchQuery ? 'No se encontraron notas' : 'Sin notas todavía'}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {searchQuery ? 'Prueba con otra búsqueda' : 'Crea tu primera nota rápida'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(note => (
            <Card
              key={note.id}
              className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer border-0"
              style={{ backgroundColor: note.color + '60' }}
              onClick={() => openEdit(note)}
            >
              <div className="p-4 min-h-[120px] flex flex-col">
                {note.is_pinned && (
                  <Pin className="absolute top-2 right-2 h-3.5 w-3.5 text-foreground/40" />
                )}
                {note.title && (
                  <h3 className="font-semibold text-sm mb-1.5 line-clamp-1">{note.title}</h3>
                )}
                <p className="text-sm whitespace-pre-wrap line-clamp-6 flex-1">{note.content}</p>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-foreground/10">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(note.updated_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <button
                           onClick={e => { e.stopPropagation(); openAsWidget(note); }}
                           className={cn(
                             "p-1.5 rounded-md hover:bg-background/60",
                             isWidgetOpen(note.id) && "text-primary bg-primary/10"
                           )}
                         >
                           {isWidgetOpen(note.id) ? <Minimize2 className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
                         </button>
                       </TooltipTrigger>
                       <TooltipContent side="top" className="text-xs">
                         {isWidgetOpen(note.id) ? 'Cerrar widget' : 'Abrir como widget'}
                       </TooltipContent>
                     </Tooltip>
                     <button
                       onClick={e => { e.stopPropagation(); togglePin.mutate({ id: note.id, is_pinned: !note.is_pinned }); }}
                       className="p-1.5 rounded-md hover:bg-background/60"
                     >
                       {note.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                     </button>
                     <button
                       onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                       className="p-1.5 rounded-md hover:bg-destructive/20 text-destructive"
                     >
                       <Trash2 className="h-3.5 w-3.5" />
                     </button>
                   </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={open => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg bg-background border shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              {editingNote ? 'Editar nota' : 'Nueva nota'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título (opcional)"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
            />
            <Textarea
              placeholder="Escribe tu nota aquí..."
              value={formContent}
              onChange={e => setFormContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex gap-2">
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      formColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2" disabled={addNote.isPending || updateNote.isPending}>
              {(addNote.isPending || updateNote.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingNote ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
