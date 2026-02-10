import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ActiveCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  caller_name: string;
  room_name: string;
  is_video: boolean;
  status: string;
  created_at: string;
}

export function useActiveCalls() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);

  // Listen for incoming calls via realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('active-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          const call = payload.new as ActiveCall;
          // Don't notify the caller themselves
          if (call.caller_id !== user.id && call.status === 'ringing') {
            // Check if user is a participant of this conversation
            checkParticipation(call);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          const call = payload.new as ActiveCall;
          // If the call was ended or accepted, dismiss the dialog
          if (call.status === 'ended' && incomingCall?.id === call.id) {
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, incomingCall?.id]);

  const checkParticipation = async (call: ActiveCall) => {
    if (!user?.id) return;
    
    const { data } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', call.conversation_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setIncomingCall(call);
      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        setIncomingCall(prev => prev?.id === call.id ? null : prev);
      }, 30000);
    }
  };

  const initiateCall = useCallback(async (conversationId: string, callerName: string, roomName: string, isVideo: boolean) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('active_calls')
      .insert({
        conversation_id: conversationId,
        caller_id: user.id,
        caller_name: callerName,
        room_name: roomName,
        is_video: isVideo,
        status: 'ringing',
      });

    if (error) console.error('Error creating call:', error);
  }, [user?.id]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    
    await supabase
      .from('active_calls')
      .update({ status: 'accepted' })
      .eq('id', incomingCall.id);

    const call = { ...incomingCall };
    setIncomingCall(null);
    return call;
  }, [incomingCall]);

  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;

    await supabase
      .from('active_calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', incomingCall.id);

    setIncomingCall(null);
  }, [incomingCall]);

  const endCall = useCallback(async (conversationId: string) => {
    await supabase
      .from('active_calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('status', 'ringing');
  }, []);

  return {
    incomingCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}