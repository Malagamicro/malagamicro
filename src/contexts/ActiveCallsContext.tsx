import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface ActiveCallsContextType {
  incomingCall: ActiveCall | null;
  initiateCall: (conversationId: string, callerName: string, roomName: string, isVideo: boolean) => Promise<void>;
  acceptCall: () => Promise<ActiveCall | undefined>;
  rejectCall: () => Promise<void>;
  endCall: (conversationId: string) => Promise<void>;
}

const ActiveCallsContext = createContext<ActiveCallsContextType | null>(null);

export function ActiveCallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const incomingCallRef = useRef<ActiveCall | null>(null);
  const userIdRef = useRef<string | null>(null);
  const processedCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  const checkExistingCalls = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;

    const { data: calls } = await supabase
      .from('active_calls')
      .select('*')
      .eq('status', 'ringing')
      .neq('caller_id', uid)
      .gte('created_at', new Date(Date.now() - 30000).toISOString());

    if (!calls?.length) return;

    for (const call of calls) {
      if (processedCallsRef.current.has(call.id)) continue;
      if (incomingCallRef.current) continue;

      const { data } = await supabase
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', call.conversation_id)
        .eq('user_id', uid)
        .maybeSingle();

      if (data) {
        processedCallsRef.current.add(call.id);
        setIncomingCall(call);
        setTimeout(() => {
          setIncomingCall(prev => prev?.id === call.id ? null : prev);
        }, 30000);
        break;
      }
    }
  }, []);

  // Check on mount
  useEffect(() => {
    if (!user?.id) return;
    checkExistingCalls();
  }, [user?.id, checkExistingCalls]);

  // Re-check when app returns to foreground (mobile) - NO polling interval
  useEffect(() => {
    if (!user?.id) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkExistingCalls();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id, checkExistingCalls]);

  // Single Realtime subscription (singleton - only mounted once in App)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('active-calls-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'active_calls' },
        async (payload) => {
          const call = payload.new as ActiveCall;
          const uid = userIdRef.current;
          if (!uid) return;
          if (call.caller_id === uid) return;
          if (call.status !== 'ringing') return;
          if (processedCallsRef.current.has(call.id)) return;
          if (incomingCallRef.current) return;

          const { data } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', call.conversation_id)
            .eq('user_id', uid)
            .maybeSingle();

          if (data) {
            processedCallsRef.current.add(call.id);
            setIncomingCall(call);

            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }

            setTimeout(() => {
              setIncomingCall(prev => prev?.id === call.id ? null : prev);
            }, 30000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'active_calls' },
        (payload) => {
          const call = payload.new as ActiveCall;
          const current = incomingCallRef.current;
          if (call.status === 'ended' && current?.id === call.id) {
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const initiateCall = useCallback(async (conversationId: string, callerName: string, roomName: string, isVideo: boolean) => {
    if (!user?.id) return;

    await supabase
      .from('active_calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('status', 'ringing');

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
      .in('status', ['ringing', 'accepted']);
  }, []);

  return (
    <ActiveCallsContext.Provider value={{ incomingCall, initiateCall, acceptCall, rejectCall, endCall }}>
      {children}
    </ActiveCallsContext.Provider>
  );
}

export function useActiveCalls() {
  const ctx = useContext(ActiveCallsContext);
  if (!ctx) throw new Error('useActiveCalls must be used within ActiveCallsProvider');
  return ctx;
}
