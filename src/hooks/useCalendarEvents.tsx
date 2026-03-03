import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  color: string;
  reminder_minutes: number;
  creator_id: string;
  created_at: string;
  updated_at: string;
  participants?: EventParticipant[];
}

export interface EventParticipant {
  id: string;
  event_id: string;
  user_id: string;
  permission: 'view' | 'edit';
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  event_date: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  color?: string;
  reminder_minutes?: number;
  participants?: { user_id: string; permission: 'view' | 'edit' }[];
}

export function useCalendarEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw error;
      setEvents((data || []) as CalendarEvent[]);
    } catch (err: any) {
      console.error('Error fetching events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      if (error) throw error;

      const usersWithEmail = await Promise.all(
        (data || []).map(async (p) => {
          const { data: emailData } = await supabase.rpc('get_user_email', { _user_id: p.user_id });
          return {
            id: p.user_id,
            email: emailData || '',
            full_name: p.full_name,
          };
        })
      );
      setUsers(usersWithEmail.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
    fetchUsers();
  }, [fetchEvents, fetchUsers]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('calendar-events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        fetchEvents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchEvents]);

  const createEvent = async (data: CreateEventData) => {
    if (!user) return;
    try {
      const { data: newEvent, error } = await supabase
        .from('calendar_events')
        .insert({
          title: data.title,
          description: data.description || null,
          event_date: data.event_date,
          start_time: data.start_time,
          end_time: data.end_time || null,
          all_day: data.all_day || false,
          color: data.color || '#3b82f6',
          reminder_minutes: data.reminder_minutes ?? 15,
          creator_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add participants
      if (data.participants && data.participants.length > 0 && newEvent) {
        const { error: partError } = await supabase
          .from('event_participants')
          .insert(
            data.participants.map(p => ({
              event_id: (newEvent as any).id,
              user_id: p.user_id,
              permission: p.permission,
            }))
          );
        if (partError) console.error('Error adding participants:', partError);
      }

      toast.success('Evento creado');
      fetchEvents();
    } catch (err: any) {
      toast.error('Error al crear evento: ' + err.message);
    }
  };

  const updateEvent = async (id: string, data: Partial<CreateEventData>) => {
    if (!user) return;
    try {
      const updateData: any = { ...data };
      delete updateData.participants;

      const { error } = await supabase
        .from('calendar_events')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      // Update participants if provided
      if (data.participants) {
        await supabase.from('event_participants').delete().eq('event_id', id);
        if (data.participants.length > 0) {
          await supabase.from('event_participants').insert(
            data.participants.map(p => ({
              event_id: id,
              user_id: p.user_id,
              permission: p.permission,
            }))
          );
        }
      }

      toast.success('Evento actualizado');
      fetchEvents();
    } catch (err: any) {
      toast.error('Error al actualizar: ' + err.message);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
      toast.success('Evento eliminado');
      fetchEvents();
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  const fetchEventParticipants = async (eventId: string): Promise<{ user_id: string; permission: 'view' | 'edit' }[]> => {
    try {
      const { data, error } = await supabase
        .from('event_participants')
        .select('user_id, permission')
        .eq('event_id', eventId);
      if (error) throw error;
      return (data || []).map(p => ({ user_id: p.user_id, permission: p.permission as 'view' | 'edit' }));
    } catch (err) {
      console.error('Error fetching participants:', err);
      return [];
    }
  };

  return { events, isLoading, users, createEvent, updateEvent, deleteEvent, fetchEvents, fetchEventParticipants };
}
