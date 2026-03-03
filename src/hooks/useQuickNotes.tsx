import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface QuickNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  color: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const NOTE_COLORS = [
  '#fef3c7', // yellow
  '#dbeafe', // blue
  '#dcfce7', // green
  '#fce7f3', // pink
  '#e0e7ff', // indigo
  '#fed7aa', // orange
  '#f3e8ff', // purple
  '#ccfbf1', // teal
];

export { NOTE_COLORS };

export function useQuickNotes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['quick-notes', user?.id],
    queryFn: async (): Promise<QuickNote[]> => {
      const { data, error } = await supabase
        .from('quick_notes' as any)
        .select('*')
        .eq('user_id', user!.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as QuickNote[];
    },
    enabled: !!user,
  });

  const addNote = useMutation({
    mutationFn: async (note: { title?: string; content: string; color?: string }) => {
      const { data, error } = await (supabase
        .from('quick_notes' as any)
        .insert({
          user_id: user!.id,
          title: note.title || '',
          content: note.content,
          color: note.color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data as QuickNote;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quick-notes'] }),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuickNote> & { id: string }) => {
      const { error } = await (supabase
        .from('quick_notes' as any)
        .update(updates)
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quick-notes'] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from('quick_notes' as any)
        .delete()
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quick-notes'] }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, is_pinned }: { id: string; is_pinned: boolean }) => {
      const { error } = await (supabase
        .from('quick_notes' as any)
        .update({ is_pinned })
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quick-notes'] }),
  });

  return {
    notes,
    isLoading,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
