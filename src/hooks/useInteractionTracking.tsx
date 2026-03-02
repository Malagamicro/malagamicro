import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const BATCH_INTERVAL = 5000; // Send batch every 5s
const MAX_BATCH_SIZE = 20;

interface InteractionEvent {
  action: string;
  page: string;
  element?: string;
  metadata?: Record<string, unknown>;
}

export function useInteractionTracking() {
  const { user } = useAuth();
  const batchRef = useRef<InteractionEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushBatch = useCallback(async () => {
    if (!user || batchRef.current.length === 0) return;
    const events = [...batchRef.current];
    batchRef.current = [];

    try {
      const rows = events.map(e => ({
        user_id: user.id,
        action: e.action,
        page: e.page,
        element: e.element || null,
        metadata: (e.metadata || {}) as Record<string, string | number | boolean | null>,
      }));
      await supabase.from('user_interaction_logs').insert(rows);
    } catch (err) {
      console.error('Failed to flush interaction logs:', err);
    }
  }, [user]);

  const trackEvent = useCallback((action: string, element?: string, metadata?: Record<string, unknown>) => {
    if (!user) return;
    const page = window.location.pathname + window.location.hash;
    batchRef.current.push({ action, page, element, metadata });
    if (batchRef.current.length >= MAX_BATCH_SIZE) {
      flushBatch();
    }
  }, [user, flushBatch]);

  // Track page navigation
  const trackNavigation = useCallback((tab: string) => {
    trackEvent('navigation', tab, { tab });
  }, [trackEvent]);

  // Track login - returns block info if user is blocked
  const trackLogin = useCallback(async (): Promise<{ blocked?: boolean; reason?: string } | null> => {
    if (!user) return null;
    try {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const { data, error } = await supabase.functions.invoke('track-login', {
        body: {
          user_agent: navigator.userAgent,
          device_type: isMobile ? 'mobile' : 'desktop',
        },
      });
      if (error) {
        console.error('Login tracking failed:', error);
        return null;
      }
      if (data?.blocked) {
        return { blocked: true, reason: data.reason };
      }
      return null;
    } catch (err) {
      console.error('Login tracking failed:', err);
      return null;
    }
  }, [user]);

  // Set up batch flush interval
  useEffect(() => {
    timerRef.current = setInterval(flushBatch, BATCH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      flushBatch(); // Flush remaining on unmount
    };
  }, [flushBatch]);

  // Track click events globally
  useEffect(() => {
    if (!user) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button, a, [role="button"], [data-track]');
      if (button) {
        const label = button.getAttribute('aria-label')
          || button.getAttribute('data-track')
          || button.textContent?.trim().slice(0, 50)
          || 'unknown';
        trackEvent('click', label);
      }
    };
    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [user, trackEvent]);

  return { trackEvent, trackNavigation, trackLogin };
}
