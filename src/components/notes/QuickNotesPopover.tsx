import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StickyNote, Plus, Trash2, Pin, PinOff, ArrowRight, Loader2 } from 'lucide-react';
import { useQuickNotes, NOTE_COLORS } from '@/hooks/useQuickNotes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuickNotesPopoverProps {
  onOpenFullApp?: () => void;
}

export function QuickNotesPopover({ onOpenFullApp }: QuickNotesPopoverProps) {
  const { notes, addNote, deleteNote, togglePin } = useQuickNotes();
  const [open, setOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setAdding(true);
    try {
      await addNote.mutateAsync({ content: newNote.trim() });
      setNewNote('');
      toast.success('Nota guardada');
    } catch {
      toast.error('Error al guardar nota');
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAdd();
    }
  };

  const recentNotes = notes.slice(0, 6);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all min-h-[32px]",
            "hover:bg-sidebar-accent border-l-2 border-transparent"
          )}
        >
          <StickyNote className="w-4 h-4 flex-shrink-0 text-amber-500" />
          <span className="text-xs font-medium">Notas rápidas</span>
          {notes.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
              {notes.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        align="end" 
        className="w-80 p-0 bg-background border shadow-xl"
        sideOffset={8}
      >
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Notas rápidas</span>
          </div>
          {onOpenFullApp && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => { onOpenFullApp(); setOpen(false); }}
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Quick input */}
        <div className="p-3 border-b">
          <Textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una nota rápida... (Ctrl+Enter para guardar)"
            className="min-h-[60px] text-sm resize-none"
            rows={2}
          />
          <Button 
            size="sm" 
            className="w-full mt-2 gap-1.5 h-8" 
            onClick={handleAdd}
            disabled={!newNote.trim() || adding}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Guardar nota
          </Button>
        </div>

        {/* Recent notes */}
        <ScrollArea className="max-h-[300px]">
          {recentNotes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Sin notas todavía
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {recentNotes.map(note => (
                <div
                  key={note.id}
                  className="group rounded-lg p-2.5 text-sm transition-all hover:shadow-sm border border-transparent hover:border-border"
                  style={{ backgroundColor: note.color + '40' }}
                >
                  {note.title && (
                    <p className="font-medium text-xs mb-1 truncate">{note.title}</p>
                  )}
                  <p className="text-xs line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(note.updated_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => togglePin.mutate({ id: note.id, is_pinned: !note.is_pinned })}
                        className="p-1 rounded hover:bg-background/80"
                      >
                        {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => deleteNote.mutate(note.id)}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
