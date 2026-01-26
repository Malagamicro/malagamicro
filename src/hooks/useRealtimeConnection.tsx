import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface RealtimeConnectionState {
  status: ConnectionStatus;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second

export function useRealtimeConnection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<RealtimeConnectionState>({
    status: 'connecting',
    lastConnected: null,
    reconnectAttempts: 0,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  const updateStatus = useCallback((status: ConnectionStatus) => {
    if (isUnmountedRef.current) return;
    setState(prev => ({
      ...prev,
      status,
      lastConnected: status === 'connected' ? new Date() : prev.lastConnected,
      reconnectAttempts: status === 'connected' ? 0 : prev.reconnectAttempts,
    }));
  }, []);

  const handleReconnect = useCallback(() => {
    if (isUnmountedRef.current) return;
    
    setState(prev => {
      if (prev.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('❌ Max reconnection attempts reached');
        return { ...prev, status: 'disconnected' };
      }

      const delay = RECONNECT_BASE_DELAY * Math.pow(2, prev.reconnectAttempts);
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${prev.reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          setupChannel();
        }
      }, delay);

      return {
        ...prev,
        status: 'reconnecting',
        reconnectAttempts: prev.reconnectAttempts + 1,
      };
    });
  }, []);

  const setupChannel = useCallback(() => {
    if (!user?.id || isUnmountedRef.current) return;

    // Clean up existing channel
    if (channelRef.current) {
      console.log('🧹 Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    updateStatus('connecting');
    console.log('📡 Setting up unified realtime channel');

    const channel = supabase
      .channel(`inbox-realtime-${user.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: user.id },
        },
      })
      // Listen to whatsapp_chats changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_chats',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📥 Chat update received:', payload.eventType);
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
        }
      )
      // Listen to waha_messages changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waha_messages',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('📩 Message update received:', payload.eventType, payload.new);
          // Invalidate chats to update last message preview
          queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
          
          // Invalidate specific chat messages
          const msg = payload.new as { chat_id?: string };
          if (msg?.chat_id) {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', msg.chat_id] });
          }
        }
      );

    // Handle channel status
    channel.subscribe((status, err) => {
      if (isUnmountedRef.current) return;

      console.log(`📶 Channel status: ${status}`, err || '');

      switch (status) {
        case 'SUBSCRIBED':
          updateStatus('connected');
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          console.error('❌ Channel error:', err);
          updateStatus('disconnected');
          handleReconnect();
          break;
        case 'CLOSED':
          if (!isUnmountedRef.current) {
            updateStatus('disconnected');
            handleReconnect();
          }
          break;
      }
    });

    channelRef.current = channel;
  }, [user?.id, queryClient, updateStatus, handleReconnect]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    setupChannel();
  }, [setupChannel]);

  // Setup on mount
  useEffect(() => {
    isUnmountedRef.current = false;
    setupChannel();

    return () => {
      isUnmountedRef.current = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (channelRef.current) {
        console.log('🧹 Cleaning up channel on unmount');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupChannel]);

  // Handle visibility change (reconnect when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.status === 'disconnected') {
        console.log('👁️ Tab became visible, attempting reconnect');
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.status, reconnect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Browser came online, attempting reconnect');
      reconnect();
    };

    const handleOffline = () => {
      console.log('📴 Browser went offline');
      updateStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reconnect, updateStatus]);

  return {
    status: state.status,
    isConnected: state.status === 'connected',
    lastConnected: state.lastConnected,
    reconnectAttempts: state.reconnectAttempts,
    reconnect,
  };
}
