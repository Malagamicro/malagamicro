import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface BudgetProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

export interface BudgetRequest {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  prompt: string;
  emails: string[];
  products: BudgetProduct[];
  email_empresa: string;
  request_id: string;
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'error';
  emails_preview?: any;
  response_data?: any;
}

export interface BudgetNotification {
  id: string;
  created_at: string;
  user_id: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
  read: boolean;
  request_id?: string;
  metadata?: any;
  invoice_url?: string;
}

export interface BudgetReceived {
  id: string;
  created_at: string;
  request_id: string;
  proveedor: string;
  email_proveedor: string;
  productos: BudgetProduct[];
  total: number;
  observaciones?: string;
  fecha_recepcion: string;
  selected: boolean;
  invoice_id?: string;
  user_responsible: string;
}

export const useBudgetRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [notifications, setNotifications] = useState<BudgetNotification[]>([]);
  const [budgetsReceived, setBudgetsReceived] = useState<BudgetReceived[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('budget_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse JSON fields
      const parsed = (data || []).map(r => ({
        ...r,
        emails: Array.isArray(r.emails) ? r.emails : JSON.parse(r.emails as string || '[]'),
        products: Array.isArray(r.products) ? r.products : JSON.parse(r.products as string || '[]')
      }));
      
      setRequests(parsed as BudgetRequest[]);
    } catch (error) {
      console.error('Error fetching budget requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('budget_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications((data || []) as BudgetNotification[]);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchBudgetsReceived = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('budgets_received')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const parsed = (data || []).map(b => ({
        ...b,
        productos: Array.isArray(b.productos) ? b.productos : JSON.parse(b.productos as string || '[]')
      }));
      
      setBudgetsReceived(parsed as BudgetReceived[]);
    } catch (error) {
      console.error('Error fetching budgets received:', error);
    }
  };

  const createRequest = async (data: {
    prompt: string;
    emails: string[];
    products: BudgetProduct[];
    email_empresa?: string;
  }) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para crear solicitudes",
        variant: "destructive"
      });
      return null;
    }

    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('budget-request', {
        body: {
          prompt: data.prompt,
          emails: data.emails,
          products: data.products,
          email_empresa: data.email_empresa || 'presupuestos@malagamicro.com'
        },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "Solicitud enviada",
        description: response.data.message || "Tu solicitud ha sido procesada correctamente"
      });

      await fetchRequests();
      return response.data;

    } catch (error) {
      console.error('Error creating request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al enviar la solicitud",
        variant: "destructive"
      });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const approveRequest = async (request_id: string, approved: boolean) => {
    if (!user) return false;

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('budget-request', {
        body: { request_id, approved },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`
        }
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: approved ? "Aprobado" : "Rechazado",
        description: `La solicitud ha sido ${approved ? 'aprobada' : 'rechazada'}`
      });

      await fetchRequests();
      return true;

    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Error al procesar la aprobación",
        variant: "destructive"
      });
      return false;
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await supabase
        .from('budget_notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const markAllNotificationsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('budget_notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (user) {
      fetchRequests();
      fetchNotifications();
      fetchBudgetsReceived();
    }
  }, [user]);

  // Real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const notificationsChannel = supabase
      .channel('budget_notifications_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'budget_notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as BudgetNotification;
          setNotifications(prev => [newNotification, ...prev]);
          
          // Show toast for new notification
          toast({
            title: newNotification.type === 'error' ? 'Error' : 'Nueva notificación',
            description: newNotification.message,
            variant: newNotification.type === 'error' ? 'destructive' : 'default'
          });
        }
      )
      .subscribe();

    const requestsChannel = supabase
      .channel('budget_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budget_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [user]);

  return {
    requests,
    notifications,
    budgetsReceived,
    loading,
    submitting,
    unreadCount,
    createRequest,
    approveRequest,
    markNotificationRead,
    markAllNotificationsRead,
    fetchRequests,
    fetchNotifications,
    fetchBudgetsReceived
  };
};
