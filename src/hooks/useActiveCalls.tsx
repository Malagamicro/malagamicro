import { useState, useEffect, useCallback, useRef } from 'react';
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
  const incomingCallRef = useRef<ActiveCall | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  // Single stable realtime subscription — NO dependency on incomingCall
  useEffect(() => {
    if (!user?.id) return;

    console.log('[useActiveCalls] Subscribing to active_calls realtime');

    const channel = supabase
      .channel('active-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
        },
        async (payload) => {
          const call = payload.new as ActiveCall;
          const uid = userIdRef.current;
          if (!uid) return;

          console.log('[useActiveCalls] INSERT received:', call.id, 'caller:', call.caller_id, 'me:', uid);

          // Don't notify the caller themselves
          if (call.caller_id === uid) return;
          if (call.status !== 'ringing') return;

          // Check if user is a participant of this conversation
          const { data } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', call.conversation_id)
            .eq('user_id', uid)
            .maybeSingle();

          if (data) {
            console.log('[useActiveCalls] I am a participant, showing incoming call');
            setIncomingCall(call);

            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }

            // Auto-dismiss after 30 seconds
            setTimeout(() => {
              setIncomingCall(prev => prev?.id === call.id ? null : prev);
            }, 30000);
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
          const current = incomingCallRef.current;
          if (call.status === 'ended' && current?.id === call.id) {
            setIncomingCall(null);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useActiveCalls] Channel status:', status);
      });

    return () => {
      console.log('[useActiveCalls] Unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [user?.id]); // Only depends on user.id — stable subscription

  const initiateCall = useCallback(async (conversationId: string, callerName: string, roomName: string, isVideo: boolean) => {
    if (!user?.id) return;

    console.log('[useActiveCalls] Initiating call for conversation:', conversationId);

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
