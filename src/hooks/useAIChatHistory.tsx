import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AIChatSession {
  id: string;
  userId: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

function mapSessionRow(row: any): AIChatSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    model: row.model,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapMessageRow(row: any): AIChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}

export function useAIChatHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all sessions
  const sessionsQuery = useQuery({
    queryKey: ['ai-chat-sessions'],
    queryFn: async (): Promise<AIChatSession[]> => {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapSessionRow);
    },
    enabled: !!user,
  });

  // Fetch messages for a session
  const useSessionMessages = (sessionId: string | null) => {
    return useQuery({
      queryKey: ['ai-chat-messages', sessionId],
      queryFn: async (): Promise<AIChatMessage[]> => {
        if (!sessionId) return [];

        const { data, error } = await supabase
          .from('ai_chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []).map(mapMessageRow);
      },
      enabled: !!user && !!sessionId,
    });
  };

  // Create a new session
  const createSession = useMutation({
    mutationFn: async ({ title, model }: { title?: string; model?: string }): Promise<AIChatSession> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          title: title || 'Nueva conversación',
          model: model || 'sonar-pro',
        })
        .select()
        .single();

      if (error) throw error;
      return mapSessionRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
    },
    onError: (error) => {
      toast.error('Error al crear sesión: ' + error.message);
    },
  });

  // Update session title
  const updateSessionTitle = useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('ai_chat_sessions')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
    },
  });

  // Delete a session
  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
      toast.success('Conversación eliminada');
    },
    onError: (error) => {
      toast.error('Error al eliminar: ' + error.message);
    },
  });

  // Add a message to a session
  const addMessage = useMutation({
    mutationFn: async ({ 
      sessionId, 
      role, 
      content 
    }: { 
      sessionId: string; 
      role: 'user' | 'assistant'; 
      content: string;
    }): Promise<AIChatMessage> => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return mapMessageRow(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai-chat-messages', variables.sessionId] });
      queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] });
    },
  });

  // Generate title from first message
  const generateTitle = (content: string): string => {
    const words = content.split(' ').slice(0, 5).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
  };

  return {
    sessions: sessionsQuery.data || [],
    isLoadingSessions: sessionsQuery.isLoading,
    useSessionMessages,
    createSession,
    updateSessionTitle,
    deleteSession,
    addMessage,
    generateTitle,
  };
}
