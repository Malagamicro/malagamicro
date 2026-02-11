import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface EmailMessage {
  id: string;
  user_id: string;
  profile_id: string;
  message_uid: string | null;
  message_id_header: string | null;
  folder: string;
  from_address: string;
  from_name: string | null;
  to_addresses: any;
  cc_addresses: any;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  date: string;
  is_read: boolean;
  is_starred: boolean;
  is_deleted: boolean;
  has_attachments: boolean;
  provider_id: string | null;
  budget_request_id: string | null;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  id: string;
  message_id: string;
  user_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number;
  file_path: string | null;
  storage_path: string | null;
  content_id: string | null;
  is_inline: boolean;
  created_at: string;
}

export function useEmailMessages(profileId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('email_messages')
        .select('*')
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .limit(100);

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages((data as any[]) || []);
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profileId]);

  useEffect(() => { if (user) fetchMessages(); }, [user, fetchMessages]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('email_messages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_messages', filter: `user_id=eq.${user.id}` }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  const syncInbox = async (pId?: string) => {
    setSyncing(true);
    try {
      const targetProfileId = pId || profileId;
      if (!targetProfileId) {
        // Sync all profiles one by one
        const { data: allProfiles } = await supabase
          .from('email_profiles')
          .select('id, profile_name, imap_host, imap_user, imap_password')
          .not('imap_host', 'is', null)
          .not('imap_user', 'is', null)
          .not('imap_password', 'is', null);
        
        // Filter out profiles with empty strings
        const validProfiles = (allProfiles || []).filter(
          p => p.imap_host?.trim() && p.imap_user?.trim() && p.imap_password?.trim()
        );

        if (validProfiles.length === 0) {
          toast.error('No hay perfiles con IMAP configurado');
          return;
        }

        let totalCount = 0;
        let errors = 0;
        for (const p of validProfiles) {
          try {
            const { data, error } = await supabase.functions.invoke('imap-check', {
              body: { profile_id: p.id, action: 'sync' }
            });
            if (error) { errors++; continue; }
            totalCount += data?.count || 0;
          } catch { errors++; }
        }
        toast.success(`${totalCount} correos sincronizados de ${validProfiles.length - errors} perfil(es)`);
      } else {
        const { data, error } = await supabase.functions.invoke('imap-check', {
          body: { profile_id: targetProfileId, action: 'sync' }
        });
        if (error) throw error;
        toast.success(`${data?.count || 0} correos sincronizados`);
      }
      await fetchMessages();
    } catch (err: any) {
      toast.error('Error al sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('email_messages').update({ is_read: true } as any).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  };

  const markAsUnread = async (id: string) => {
    await supabase.from('email_messages').update({ is_read: false } as any).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: false } : m));
  };

  const toggleStar = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    await supabase.from('email_messages').update({ is_starred: !msg.is_starred } as any).eq('id', id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_starred: !m.is_starred } : m));
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('email_messages').update({ is_deleted: true } as any).eq('id', id);
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedMessage?.id === id) setSelectedMessage(null);
  };

  const linkToProvider = async (messageId: string, providerId: string) => {
    await supabase.from('email_messages').update({ provider_id: providerId } as any).eq('id', messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, provider_id: providerId } : m));
    toast.success('Correo vinculado al proveedor');
  };

  const linkToBudget = async (messageId: string, budgetId: string) => {
    await supabase.from('email_messages').update({ budget_request_id: budgetId } as any).eq('id', messageId);
    toast.success('Correo vinculado al presupuesto');
  };

  const fetchAttachments = async (messageId: string) => {
    const { data, error } = await supabase
      .from('email_attachments')
      .select('*')
      .eq('message_id', messageId);
    if (!error) setAttachments((data as any[]) || []);
  };

  const selectMessage = async (msg: EmailMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) await markAsRead(msg.id);
    if (msg.has_attachments) await fetchAttachments(msg.id);
  };

  const filteredMessages = messages.filter(m => {
    if (filter === 'unread' && m.is_read) return false;
    if (filter === 'starred' && !m.is_starred) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (m.subject?.toLowerCase().includes(q) || m.from_address.toLowerCase().includes(q) || m.from_name?.toLowerCase().includes(q));
    }
    return true;
  });

  return {
    messages: filteredMessages,
    allMessages: messages,
    loading,
    syncing,
    selectedMessage,
    attachments,
    filter,
    searchQuery,
    setFilter,
    setSearchQuery,
    selectMessage,
    setSelectedMessage,
    syncInbox,
    markAsRead,
    markAsUnread,
    toggleStar,
    deleteMessage,
    linkToProvider,
    linkToBudget,
    fetchMessages,
    unreadCount: messages.filter(m => !m.is_read).length,
  };
}
