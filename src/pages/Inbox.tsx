import { useState, useEffect, useRef, useCallback } from 'react';
import { useWhatsAppChats } from '@/hooks/useWhatsAppChats';
import { useNotificationContext } from '@/contexts/NotificationContext';

import { sendTextMessage } from '@/services/evolutionService';
import { TemplatesModal } from '@/components/whatsapp/TemplatesModal';
import { EditContactModal } from '@/components/whatsapp/EditContactModal';
import { NewChatModal } from '@/components/whatsapp/NewChatModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ArrowLeft, 
  Phone,
  Plus,
  RefreshCw,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  MoreVertical,
  Pencil,
  Clock,
  Bell,
  BellOff,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Pending message for optimistic UI
interface PendingMessage {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
}

// Function to detect and convert URLs to links
function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export default function Inbox() {
  const { user } = useAuth();
  const { permission, requestPermission } = useNotificationContext();
  const { 
    chats, 
    isLoadingChats, 
    refetchChats, 
    useMessagesForChat, 
    getOrCreateChat,
    updateChat,
    uploadAvatar,
    updateChatLastMessage,
    syncFromEvolution,
    isSyncing,
  } = useWhatsAppChats();
  
  
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useMessagesForChat(selectedChatId);

  const selectedChat = chats.find(c => c.chatId === selectedChatId);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
    }
  }, [messageInput]);

  // Reset unread when selecting a chat
  useEffect(() => {
    if (selectedChatId && selectedChat?.unreadCount && selectedChat.unreadCount > 0) {
      updateChatLastMessage({ chatId: selectedChatId, resetUnread: true });
    }
  }, [selectedChatId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchChats();
      if (selectedChatId) {
        await refetchMessages();
      }
      toast.success('Conversaciones actualizadas');
    } catch (error) {
      toast.error('Error al actualizar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateChat = async (phone: string, name?: string) => {
    const chatId = `${phone}@s.whatsapp.net`;
    await getOrCreateChat({ chatId, phone, customName: name });
    setSelectedChatId(chatId);
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId || isSending || !user?.id) return;

    const content = messageInput.trim();
    const pendingId = `pending-${Date.now()}`;
    
    // Optimistic UI: add pending message
    const pendingMsg: PendingMessage = {
      id: pendingId,
      content,
      timestamp: new Date(),
      status: 'sending',
    };
    setPendingMessages(prev => [...prev, pendingMsg]);
    setMessageInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsSending(true);
    try {
      // Send via Evolution API
      const evoResponse = await sendTextMessage(selectedChatId, content);

      // Save to database
      await supabase.from('waha_messages').insert({
        chat_id: selectedChatId,
        content,
        from_me: true,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        message_id: evoResponse?.id || null,
        message_type: 'text',
        ack_status: 'sent',
      });

      // Update chat last message
      await updateChatLastMessage({ chatId: selectedChatId });

      // Mark as sent
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingId ? { ...m, status: 'sent' as const } : m)
      );
      
      // Refresh to get real message from DB
      await refetchChats();
      await refetchMessages();
      
      // Clean pending message after refresh
      setPendingMessages(prev => prev.filter(m => m.id !== pendingId));
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Mark as error
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingId ? { ...m, status: 'error' as const } : m)
      );
      toast.error('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryMessage = async (pendingMsg: PendingMessage) => {
    if (!selectedChatId || !user?.id) return;
    
    // Mark as sending
    setPendingMessages(prev => 
      prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'sending' as const } : m)
    );

    try {
      const evoResponse = await sendTextMessage(selectedChatId, pendingMsg.content);

      await supabase.from('waha_messages').insert({
        chat_id: selectedChatId,
        content: pendingMsg.content,
        from_me: true,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        message_id: evoResponse?.id || null,
        message_type: 'text',
        ack_status: 'sent',
      });

      setPendingMessages(prev => 
        prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'sent' as const } : m)
      );
      
      await refetchChats();
      await refetchMessages();
      
      setPendingMessages(prev => prev.filter(m => m.id !== pendingMsg.id));
      
    } catch (error) {
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'error' as const } : m)
      );
      toast.error('Error al reintentar');
    }
  };

  const handleSaveContact = async (name: string, avatarFile?: File) => {
    if (!selectedChatId) return;
    
    try {
      let newAvatarUrl: string | undefined;
      
      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(selectedChatId, avatarFile);
      }
      
      await updateChat({ 
        chatId: selectedChatId, 
        customName: name, 
        avatarUrl: newAvatarUrl,
      });
      
      await refetchChats();
    } catch (err) {
      throw err;
    }
  };

  const insertTemplate = (content: string) => {
    setMessageInput(prev => prev + content);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return format(date, 'EEEE', { locale: es });
    } else {
      return format(date, 'dd/MM/yy');
    }
  };

  const getPhoneDisplay = (phone: string) => {
    if (phone.startsWith('34')) {
      return `+34 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
    }
    return `+${phone}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getAckIcon = (ackStatus: string | null | undefined) => {
    switch (ackStatus) {
      case 'pending':
        return <Clock className="w-3 h-3 opacity-70" />;
      case 'sent':
        return <Check className="w-3 h-3" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3" />;
      case 'read':
      case 'played':
        return <CheckCheck className="w-3 h-3 text-sky-400" />;
      default:
        return <CheckCheck className="w-3 h-3" />;
    }
  };

  // Combine real messages with pending ones
  const allMessages = [
    ...messages.map(m => ({ ...m, _pending: null as string | null })),
    ...pendingMessages.map(p => ({
      id: p.id,
      chatId: selectedChatId || '',
      content: p.content,
      fromMe: true,
      timestamp: p.timestamp,
      leadId: null,
      userId: '',
      messageId: null,
      mediaUrl: null,
      messageType: 'text',
      ackStatus: null,
      reaction: null,
      isRevoked: false,
      isEdited: false,
      replyToId: null,
      createdAt: p.timestamp,
      _pending: p.status,
    })),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Chat List - Sidebar */}
      <div className={cn(
        "w-full md:w-80 lg:w-[30%] min-w-[320px] max-w-[400px] border-r border-border flex flex-col bg-card",
        selectedChatId && "hidden md:flex"
      )}>
        {/* Header */}
        <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card shrink-0">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Inbox
          </h1>
          <div className="flex items-center gap-1">
            {/* Notification Permission Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (permission !== 'granted') {
                        requestPermission().then((result) => {
                          if (result === 'granted') {
                            toast.success('Notificaciones activadas');
                          } else if (result === 'denied') {
                            toast.error('Permiso de notificaciones denegado');
                          }
                        });
                      } else {
                        toast.info('Las notificaciones ya están activadas');
                      }
                    }}
                    className={cn(
                      permission === 'granted' && "text-primary"
                    )}
                  >
                    {permission === 'granted' ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {permission === 'granted' 
                    ? 'Notificaciones activadas' 
                    : 'Activar notificaciones'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => syncFromEvolution()}
                    disabled={isSyncing}
                    title="Sincronizar desde Evolution API"
                  >
                    <Download className={cn("w-4 h-4", isSyncing && "animate-bounce")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sincronizar chats desde WhatsApp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewChatModal(true)}
              title="Nueva conversación"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refrescar conversaciones"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingChats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground font-medium">No hay conversaciones</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Los mensajes aparecerán aquí
              </p>
              <Button
                variant="link"
                onClick={() => setShowNewChatModal(true)}
                className="mt-2"
              >
                Iniciar conversación
              </Button>
            </div>
          ) : (
            <div>
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.chatId)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors flex items-center gap-3",
                    "hover:bg-accent/50 border-b border-border/50",
                    selectedChatId === chat.chatId && "bg-accent"
                  )}
                >
                  <Avatar className="w-12 h-12 shrink-0">
                    {chat.avatarUrl && <AvatarImage src={chat.avatarUrl} alt={chat.customName || chat.phone} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {chat.customName?.[0]?.toUpperCase() || chat.phone.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate text-foreground">
                        {chat.customName || getPhoneDisplay(chat.phone)}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage || 'Sin mensajes'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat View - Main Panel */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0",
        !selectedChatId && "hidden md:flex"
      )}>
        {selectedChatId && selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-border flex items-center gap-3 bg-card shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0 h-11 w-11"
                onClick={() => setSelectedChatId(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-10 h-10 shrink-0">
                {selectedChat.avatarUrl && <AvatarImage src={selectedChat.avatarUrl} alt={selectedChat.customName || selectedChat.phone} />}
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedChat.customName?.[0]?.toUpperCase() || selectedChat.phone.slice(-2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {selectedChat.customName || getPhoneDisplay(selectedChat.phone)}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span className="truncate">{getPhoneDisplay(selectedChat.phone)}</span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar contacto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages Area - WhatsApp style background */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-muted/30"
            >
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : allMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-card/80 backdrop-blur-sm rounded-lg px-6 py-4">
                    <p className="text-muted-foreground">No hay mensajes</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Envía el primer mensaje
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 max-w-3xl mx-auto">
                  {allMessages.map((message) => {
                    const isPending = message._pending !== null;
                    const pendingStatus = message._pending;
                    
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          message.fromMe ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-2 shadow-sm relative",
                            message.fromMe
                              ? "bg-primary/10 rounded-tr-none"
                              : "bg-card rounded-tl-none",
                            pendingStatus === 'sending' && "opacity-70",
                            pendingStatus === 'error' && "opacity-90",
                            message.isRevoked && "opacity-60 italic"
                          )}
                        >
                          {message.mediaUrl && !message.isRevoked && (
                            <img
                              src={message.mediaUrl}
                              alt="Media"
                              className="max-w-full rounded mb-2"
                            />
                          )}
                          <p className="whitespace-pre-wrap break-words text-sm">
                            {linkifyText(message.content)}
                            {message.isEdited && (
                              <span className="text-xs opacity-70 ml-1">(editado)</span>
                            )}
                          </p>
                          {message.reaction && (
                            <span className="text-lg">{message.reaction}</span>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1 text-muted-foreground/70">
                            <span className="text-[10px]">
                              {format(message.timestamp, 'HH:mm')}
                            </span>
                            {message.fromMe && (
                              <>
                                {pendingStatus === 'sending' && (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                )}
                                {pendingStatus === 'sent' && (
                                  <Check className="w-3 h-3" />
                                )}
                                {pendingStatus === 'error' && (
                                  <button 
                                    onClick={() => handleRetryMessage(pendingMessages.find(p => p.id === message.id)!)}
                                    className="text-destructive hover:text-destructive/80"
                                    title="Reintentar"
                                  >
                                    <AlertCircle className="w-3 h-3" />
                                  </button>
                                )}
                                {!isPending && getAckIcon(message.ackStatus)}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input Area */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Plantillas"
                  onClick={() => setShowTemplatesModal(true)}
                  className="shrink-0 mb-0.5"
                >
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </Button>
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe un mensaje..."
                    className="min-h-[40px] max-h-[120px] resize-none pr-12"
                    rows={1}
                  />
                </div>
                <Button 
                  onClick={handleSendMessage} 
                  disabled={!messageInput.trim() || isSending}
                  className="shrink-0 mb-0.5"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h2 className="text-xl font-medium text-muted-foreground">
                Selecciona una conversación
              </h2>
              <p className="text-sm text-muted-foreground/70 mt-1">
                O inicia una nueva
              </p>
              <Button
                variant="outline"
                onClick={() => setShowNewChatModal(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva conversación
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <TemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
        onSelectTemplate={insertTemplate}
      />

      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onCreateChat={handleCreateChat}
      />

      {selectedChat && (
        <EditContactModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          chatId={selectedChatId || ''}
          phone={selectedChat.phone}
          currentName={selectedChat.customName}
          currentAvatar={selectedChat.avatarUrl}
          onSave={handleSaveContact}
        />
      )}
    </div>
  );
}