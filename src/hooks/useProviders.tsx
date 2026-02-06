import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface Provider {
  id: string;
  created_at: string;
  updated_at: string;
  nombre: string;
  email: string;
  telefono?: string;
  especialidad: string[];
  notas?: string;
  activo: boolean;
  user_id: string;
}

export const useProviders = () => {
  const { user } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProviders = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const createProvider = async (data: Omit<Provider, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return null;

    try {
      const { data: newProvider, error } = await supabase
        .from('providers')
        .insert({
          ...data,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      setProviders(prev => [...prev, newProvider]);
      toast({
        title: "Proveedor añadido",
        description: `${data.nombre} ha sido añadido correctamente`
      });

      return newProvider;
    } catch (error: any) {
      console.error('Error creating provider:', error);
      toast({
        title: "Error",
        description: error.message?.includes('duplicate') 
          ? "Ya existe un proveedor con ese nombre" 
          : "Error al añadir proveedor",
        variant: "destructive"
      });
      return null;
    }
  };

  const updateProvider = async (id: string, data: Partial<Provider>) => {
    try {
      const { data: updated, error } = await supabase
        .from('providers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setProviders(prev => prev.map(p => p.id === id ? updated : p));
      toast({
        title: "Proveedor actualizado",
        description: "Los cambios se han guardado correctamente"
      });

      return updated;
    } catch (error) {
      console.error('Error updating provider:', error);
      toast({
        title: "Error",
        description: "Error al actualizar proveedor",
        variant: "destructive"
      });
      return null;
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from('providers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProviders(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Proveedor eliminado",
        description: "El proveedor ha sido eliminado correctamente"
      });

      return true;
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast({
        title: "Error",
        description: "Error al eliminar proveedor",
        variant: "destructive"
      });
      return false;
    }
  };

  const searchProviders = (query: string) => {
    const lowerQuery = query.toLowerCase();
    return providers.filter(p => 
      p.nombre.toLowerCase().includes(lowerQuery) ||
      p.email.toLowerCase().includes(lowerQuery) ||
      p.especialidad.some(e => e.toLowerCase().includes(lowerQuery))
    );
  };

  useEffect(() => {
    if (user) {
      fetchProviders();
    }
  }, [user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('providers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'providers',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchProviders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    providers,
    loading,
    createProvider,
    updateProvider,
    deleteProvider,
    searchProviders,
    fetchProviders,
    activeProviders: providers.filter(p => p.activo)
  };
};
