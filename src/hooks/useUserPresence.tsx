import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface UserPresence {
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
  device_type: string;
  user_agent: string | null;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

function detectDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function useUserPresence() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Update own presence
  useEffect(() => {
    if (!user?.id) return;

    const deviceType = detectDeviceType();
    const userAgent = navigator.userAgent;

    const updatePresence = async (isOnline: boolean) => {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
          device_type: deviceType,
          user_agent: userAgent,
        }, { onConflict: 'user_id' });
    };

    // Go online
    updatePresence(true);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => updatePresence(true), 30000);

    // Go offline on leave
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability
      const body = JSON.stringify({
        user_id: user.id,
        is_online: false,
        last_seen_at: new Date().toISOString(),
        device_type: deviceType,
        user_agent: userAgent,
      });
      // Fallback: just set offline
      updatePresence(false);
    };

    const handleVisibilityChange = () => {
      updatePresence(!document.hidden);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updatePresence(false);
    };
  }, [user?.id]);

  // Fetch all online users
  const { data: onlineUsers = [] } = useQuery({
    queryKey: ['user-presence'],
    queryFn: async (): Promise<UserPresence[]> => {
      const { data, error } = await supabase
        .from('user_presence')
        .select('*')
        .eq('is_online', true);

      if (error) throw error;

      const userIds = (data || []).map(p => p.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return (data || []).map(p => ({
        ...p,
        profile: profileMap.get(p.user_id),
      }));
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-presence-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['user-presence'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return { onlineUsers };
}
