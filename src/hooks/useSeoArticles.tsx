import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SeoArticle {
  id: string;
  user_id: string;
  topic: string;
  image_count: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  workflow_id?: string;
  title?: string;
  slug?: string;
  meta_description?: string;
  keywords?: string[];
  html_content?: string;
  structured_data?: Record<string, unknown>;
  meta_tags?: Record<string, string>;
  research_summary?: string;
  seo_score?: number;
  word_count?: number;
  security_score?: number;
  images?: Array<{ url: string; altText?: string; position?: number }>;
  images_success_count?: number;
  images_failed_count?: number;
  optimizations?: string[];
  suggested_links?: Array<{ anchor: string; targetUrl: string; relevance: string }>;
  error_message?: string;
  error_details?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  video_url?: string;
  video_prompt?: string;
  video_status?: 'none' | 'pending' | 'processing' | 'completed' | 'error';
  video_duration?: number;
}

export const useSeoArticles = () => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<SeoArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);

  // Cargar artículos
  const fetchArticles = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('seo_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setArticles((data || []) as unknown as SeoArticle[]);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Generar nuevo artículo — con protección contra clicks múltiples
  const generateArticle = useCallback(async (
    topic: string, 
    imageCount: number = 1, 
    generateVideo: boolean = false, 
    videoDuration: number = 6,
    webhookUrl?: string
  ) => {
    if (!user) {
      toast.error('Debes iniciar sesión');
      return null;
    }

    // Double-check with ref to prevent race conditions
    if (generatingRef.current) {
      toast.warning('Ya hay un artículo generándose, espera a que termine');
      return null;
    }

    generatingRef.current = true;
    setGenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-seo-article`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ topic, imageCount, generateVideo, videoDuration, webhookUrl }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al generar artículo');
      }

      toast.success('Artículo en proceso de generación');
      // Don't call fetchArticles here — realtime subscription handles it
      return result;
    } catch (error) {
      console.error('Error generating article:', error);
      toast.error(error instanceof Error ? error.message : 'Error al generar artículo');
      return null;
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }, [user]);

  // Eliminar artículo
  const deleteArticle = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('seo_articles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setArticles(prev => prev.filter(a => a.id !== id));
      toast.success('Artículo eliminado');
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Error al eliminar artículo');
    }
  }, []);

  // Suscripción a cambios en tiempo real
  useEffect(() => {
    if (!user) return;

    fetchArticles();

    const channel = supabase
      .channel('seo_articles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seo_articles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Realtime update:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            setArticles(prev => {
              // Deduplicate: don't add if already present
              if (prev.some(a => a.id === (payload.new as any).id)) return prev;
              return [payload.new as unknown as SeoArticle, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setArticles(prev => 
              prev.map(a => a.id === (payload.new as any).id ? payload.new as unknown as SeoArticle : a)
            );
          } else if (payload.eventType === 'DELETE') {
            setArticles(prev => prev.filter(a => a.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchArticles]);

  return {
    articles,
    loading,
    generating,
    generateArticle,
    deleteArticle,
    refetch: fetchArticles,
  };
};
