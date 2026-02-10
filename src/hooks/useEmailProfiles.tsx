import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface EmailProfile {
  id: string;
  user_id: string;
  profile_name: string;
  is_default: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: string;
  from_email: string;
  from_name: string | null;
  imap_host: string | null;
  imap_port: number | null;
  imap_user: string | null;
  imap_password: string | null;
  imap_secure: boolean | null;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
  last_sync_at: string | null;
  connection_status: string;
  created_at: string;
  updated_at: string;
}

export type EmailProfileInsert = Omit<EmailProfile, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'last_sync_at' | 'connection_status'>;

export function useEmailProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<EmailProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('email_profiles')
        .select('*')
        .order('is_default', { ascending: false });
      if (error) throw error;
      setProfiles((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching email profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchProfiles(); }, [user, fetchProfiles]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('email_profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_profiles', filter: `user_id=eq.${user.id}` }, () => fetchProfiles())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchProfiles]);

  const createProfile = async (data: Partial<EmailProfileInsert>) => {
    if (!user) return null;
    try {
      // If marking as default, unset others
      if (data.is_default) {
        await supabase.from('email_profiles').update({ is_default: false } as any).eq('user_id', user.id);
      }
      const { data: newProfile, error } = await supabase
        .from('email_profiles')
        .insert({ ...data, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      toast.success('Perfil de correo creado');
      return newProfile;
    } catch (err: any) {
      toast.error('Error al crear perfil: ' + err.message);
      return null;
    }
  };

  const updateProfile = async (id: string, data: Partial<EmailProfile>) => {
    try {
      if (data.is_default && user) {
        await supabase.from('email_profiles').update({ is_default: false } as any).eq('user_id', user.id);
      }
      const { error } = await supabase.from('email_profiles').update(data as any).eq('id', id);
      if (error) throw error;
      toast.success('Perfil actualizado');
    } catch (err: any) {
      toast.error('Error al actualizar perfil: ' + err.message);
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const { error } = await supabase.from('email_profiles').delete().eq('id', id);
      if (error) throw error;
      toast.success('Perfil eliminado');
    } catch (err: any) {
      toast.error('Error al eliminar perfil: ' + err.message);
    }
  };

  const testConnection = async (profileId: string) => {
    try {
      const profile = profiles.find(p => p.id === profileId);
      if (!profile) throw new Error('Perfil no encontrado');
      
      const { data, error } = await supabase.functions.invoke('imap-check', {
        body: { profile_id: profileId }
      });
      if (error) throw error;
      
      await supabase.from('email_profiles').update({ 
        connection_status: data?.success ? 'connected' : 'error' 
      } as any).eq('id', profileId);
      
      if (data?.success) {
        toast.success('Conexión exitosa');
      } else {
        toast.error('Error de conexión: ' + (data?.error || 'Desconocido'));
      }
      return data;
    } catch (err: any) {
      toast.error('Error al probar conexión: ' + err.message);
      return null;
    }
  };

  return {
    profiles,
    loading,
    createProfile,
    updateProfile,
    deleteProfile,
    testConnection,
    fetchProfiles,
    defaultProfile: profiles.find(p => p.is_default) || profiles[0],
  };
}
