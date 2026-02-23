import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TicketNote {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export function useTicketNotes(ticketId: string | null) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TicketNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const fetchNotes = async () => {
    if (!ticketId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('ticket_notes')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching ticket notes:', error);
    } else {
      // Enrich with user names
      const userIds = [...new Set((data || []).map(n => n.user_id))];
      const enriched = await Promise.all(
        (data || []).map(async (note) => {
          const { data: emailData } = await supabase.rpc('get_user_email', { _user_id: note.user_id });
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', note.user_id)
            .maybeSingle();
          return {
            ...note,
            user_email: emailData || undefined,
            user_name: profile?.full_name || emailData?.split('@')[0] || 'Usuario',
          };
        })
      );
      setNotes(enriched);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotes();
  }, [ticketId]);

  // Realtime subscription
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`ticket-notes-${ticketId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ticket_notes',
        filter: `ticket_id=eq.${ticketId}`,
      }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId]);

  const addNote = async (content: string) => {
    if (!user || !ticketId || !content.trim()) return;
    setIsAdding(true);
    const { error } = await supabase
      .from('ticket_notes')
      .insert({ ticket_id: ticketId, user_id: user.id, content: content.trim() });
    if (error) {
      toast.error('Error al añadir nota');
    }
    setIsAdding(false);
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase
      .from('ticket_notes')
      .delete()
      .eq('id', noteId);
    if (error) {
      toast.error('Error al eliminar nota');
    }
  };

  return { notes, isLoading, isAdding, addNote, deleteNote };
}
