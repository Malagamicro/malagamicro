import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

export function useThemeSync() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isInitialized = useRef(false);
  const isSyncing = useRef(false);

  // Load theme from profile on mount
  useEffect(() => {
    if (!user?.id || isInitialized.current) return;

    const loadThemeFromProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('theme_preference')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data?.theme_preference) {
          isInitialized.current = true;
          isSyncing.current = true;
          setTheme(data.theme_preference);
          // Reset syncing flag after a short delay
          setTimeout(() => {
            isSyncing.current = false;
          }, 100);
        } else {
          isInitialized.current = true;
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
        isInitialized.current = true;
      }
    };

    loadThemeFromProfile();
  }, [user?.id, setTheme]);

  // Save theme to profile when it changes
  useEffect(() => {
    if (!user?.id || !isInitialized.current || isSyncing.current || !theme) return;

    const saveThemeToProfile = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ theme_preference: theme })
          .eq('user_id', user.id);
        
        // Invalidate profile query to keep it in sync
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      } catch (err) {
        console.error('Failed to save theme preference:', err);
      }
    };

    saveThemeToProfile();
  }, [theme, user?.id, queryClient]);

  return { theme, setTheme };
}

