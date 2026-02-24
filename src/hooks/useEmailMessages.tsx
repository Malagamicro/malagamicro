import { useState, useEffect, useCallback, useRef } from 'react';
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

const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function useEmailMessages(profileId?: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

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
      const newMessages = (data as any[]) || [];
      
      // Detect new emails for notifications
      if (!isFirstLoadRef.current && newMessages.length > 0) {
        const currentIds = new Set(newMessages.map(m => m.id));
        const newEmailIds = newMessages.filter(m => !prevMessageIdsRef.current.has(m.id) && !m.is_read);
        
        if (newEmailIds.length > 0) {
          const latestNew = newEmailIds[0];
          toast.info(`📧 ${newEmailIds.length} correo(s) nuevo(s)`, {
            description: latestNew.subject || latestNew.from_address,
            duration: 5000,
          });
        }
      }

      prevMessageIdsRef.current = new Set(newMessages.map(m => m.id));
      isFirstLoadRef.current = false;
      setMessages(newMessages);
    } catch (err) {
      console.error('Error fetching emails:', err);
    } finally {
      setLoading(false);
    }
  }, [user, profileId]);

  useEffect(() => { if (user) fetchMessages(); }, [user, fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('email_messages_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_messages', filter: `user_id=eq.${user.id}` }, () => fetchMessages())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMessages]);

  // Auto-sync every 2 minutes
  useEffect(() => {
    if (!user) return;

    const doAutoSync = async () => {
      try {
        const { data: allProfiles } = await supabase
          .from('email_profiles')
          .select('id, imap_host, imap_user, imap_password')
          .not('imap_host', 'is', null)
          .not('imap_user', 'is', null)
          .not('imap_password', 'is', null);
        
        const validProfiles = (allProfiles || []).filter(
          p => p.imap_host?.trim() && p.imap_user?.trim() && p.imap_password?.trim()
        );

        if (validProfiles.length === 0) return;

        for (const p of validProfiles) {
          try {
            await supabase.functions.invoke('imap-check', {
              body: { profile_id: p.id, action: 'sync' }
            });
          } catch { /* silent */ }
        }
        await fetchMessages();
      } catch { /* silent */ }
    };

    const interval = setInterval(doAutoSync, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchMessages]);

  const syncProfilePaginated = async (pId: string): Promise<number> => {
    let totalInserted = 0;
    let offset = 0;
    const batchSize = 20;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.functions.invoke('imap-check', {
        body: { profile_id: pId, action: 'sync', batch_size: batchSize, page_offset: offset }
      });
      if (error) throw error;
      totalInserted += data?.count || 0;
      hasMore = data?.has_more === true && (data?.count > 0 || data?.skipped > 0);
      offset = data?.next_offset || offset + batchSize;
      if (offset > 200) break;
    }
    return totalInserted;
  };

  const syncInbox = async (pId?: string) => {
    setSyncing(true);
    try {
      const targetProfileId = pId || profileId;
      if (!targetProfileId) {
        const { data: allProfiles } = await supabase
          .from('email_profiles')
          .select('id, profile_name, imap_host, imap_user, imap_password')
          .not('imap_host', 'is', null)
          .not('imap_user', 'is', null)
          .not('imap_password', 'is', null);
        
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
            totalCount += await syncProfilePaginated(p.id);
          } catch { errors++; }
        }
        toast.success(`${totalCount} correos sincronizados de ${validProfiles.length - errors} perfil(es)`);
      } else {
        const count = await syncProfilePaginated(targetProfileId);
        toast.success(`${count} correos sincronizados`);
      }
      await fetchMessages();
    } catch (err: any) {
      toast.error('Error al sincronizar: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Fetch body on-demand when user opens a message
  const fetchBodyOnDemand = async (msg: EmailMessage): Promise<EmailMessage> => {
    if (msg.body_html || msg.body_text) return msg; // Already has body
    if (!msg.message_uid) return msg; // No UID to fetch

    try {
      const { data, error } = await supabase.functions.invoke('imap-check', {
        body: {
          profile_id: msg.profile_id,
          action: 'fetch-body',
          message_uid: msg.message_uid,
          message_id: msg.id,
        }
      });

      if (error || !data?.success) {
        console.error('Error fetching body:', error || data?.error);
        return msg;
      }

      const updated = {
        ...msg,
        body_text: data.body_text || msg.body_text,
        body_html: data.body_html || msg.body_html,
      };

      // Update local state
      setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));

      // If attachments were saved, load them
      if (data.attachments?.length > 0) {
        setAttachments(data.attachments);
      }

      return updated;
    } catch (err) {
      console.error('Body fetch error:', err);
      return msg;
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
    if (!error && data) {
      // Generate signed URLs for attachments from private bucket
      const withUrls = await Promise.all((data as any[]).map(async (att) => {
        if (att.storage_path) {
          const { data: signedData } = await supabase.storage
            .from('email-attachments')
            .createSignedUrl(att.storage_path, 60 * 60); // 1 hour
          return { ...att, file_path: signedData?.signedUrl || att.file_path };
        }
        return att;
      }));
      setAttachments(withUrls);
    } else {
      setAttachments([]);
    }
  };

  const selectMessage = async (msg: EmailMessage) => {
    setSelectedMessage(msg);
    if (!msg.is_read) await markAsRead(msg.id);
    // Fetch body on-demand if not yet loaded
    const updated = await fetchBodyOnDemand(msg);
    setSelectedMessage(updated);
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
