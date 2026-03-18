import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTicketNotes } from '@/hooks/useTicketNotes';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const getInitials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const getAvatarColor = (userId: string) => {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const renderNoteContent = (content: string) => {
  const parts = content.split(/(@\w+(?:\s\w+)?)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="bg-primary/20 text-primary font-medium rounded px-0.5">{part}</span>;
    }
    return part;
  });
};

export function TicketNotesChat({ ticketId }: { ticketId: string }) {
  const { notes, isLoading, isAdding, addNote, deleteNote } = useTicketNotes(ticketId);
  const { user } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [teamUsers, setTeamUsers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').then(({ data }) => {
      if (data) setTeamUsers(data);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [notes.length]);

  const handleNoteChange = (value: string) => {
    setNewNote(value);
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) { setShowMentions(true); setMentionQuery(atMatch[1].toLowerCase()); }
    else { setShowMentions(false); setMentionQuery(''); }
  };

  const insertMention = (userName: string) => {
    const cursorPos = textareaRef.current?.selectionStart || newNote.length;
    const textBefore = newNote.slice(0, cursorPos);
    const textAfter = newNote.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const newText = textBefore.slice(0, atIndex) + `@${userName} ` + textAfter;
    setNewNote(newText);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMentions = teamUsers.filter(u =>
    (u.full_name || '').toLowerCase().includes(mentionQuery)
  );

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    await addNote(newNote);
    setNewNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <h3 className="font-semibold text-sm">Notas internas del equipo</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">{notes.length}</Badge>
      </div>

      <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-2 rounded-lg border bg-muted/20 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sin notas. Usa @nombre para mencionar a alguien.
          </p>
        ) : (
          notes.map((note) => {
            const isOwn = note.user_id === user?.id;
            return (
              <div key={note.id} className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className={cn("text-[10px] text-white", getAvatarColor(note.user_id))}>
                    {getInitials(note.user_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("max-w-[80%] space-y-0.5", isOwn && "items-end")}>
                  <div className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                    isOwn ? "bg-primary text-primary-foreground" : "bg-background border"
                  )}>
                    {!isOwn && <p className="font-semibold text-[10px] mb-0.5 opacity-70">{note.user_name}</p>}
                    <p className="whitespace-pre-wrap">{renderNoteContent(note.content)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(note.created_at), 'd MMM HH:mm', { locale: es })}
                    </span>
                    {isOwn && (
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-[9px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showMentions && filteredMentions.length > 0 && (
        <div className="rounded-lg border bg-popover shadow-md p-1 max-h-28 overflow-y-auto">
          {filteredMentions.map(u => (
            <button
              key={u.user_id}
              onClick={() => insertMention(u.full_name || 'usuario')}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(u.user_id))}>
                  {getInitials(u.full_name || 'U')}
                </AvatarFallback>
              </Avatar>
              {u.full_name || 'Sin nombre'}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe una nota... usa @nombre para mencionar"
          className="text-xs min-h-[36px] max-h-20 resize-none flex-1"
          rows={1}
        />
        <Button
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handleSubmit}
          disabled={isAdding || !newNote.trim()}
        >
          {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
