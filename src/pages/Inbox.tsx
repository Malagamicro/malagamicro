import { useState, useEffect, useRef, useCallback } from 'react';
import { useWahaMessages, ChatSummary, WahaMessage } from '@/hooks/useWahaMessages';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { sendText } from '@/services/wahaService';
import { TemplatesModal } from '@/components/whatsapp/TemplatesModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ArrowLeft, 
  User,
  Phone,
  Plus,
  RefreshCw,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Mensaje optimista pendiente
interface PendingMessage {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
}

// Función para detectar y convertir URLs en links
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
  const { chats, isLoadingChats, useMessagesForChat, refetchChats } = useWahaMessages();
  const { templates } = useMessageTemplates();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useMessagesForChat(selectedChatId);

  const selectedChat = chats.find(c => c.chatId === selectedChatId);

  // Auto-scroll al final cuando cambian los mensajes o hay mensajes pendientes
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessages, scrollToBottom]);

  // Auto-resize del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`; // max 4 líneas aprox
    }
  }, [messageInput]);

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

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChatId || isSending) return;

    const phone = selectedChatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
    const content = messageInput.trim();
    const pendingId = `pending-${Date.now()}`;
    
    // Optimistic UI: añadir mensaje pendiente
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
      await sendText({ 
        phone, 
        message: content,
        leadId: selectedChat?.leadId || null,
      });

      // Marcar como enviado
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingId ? { ...m, status: 'sent' as const } : m)
      );
      
      // Refrescar para obtener el mensaje real de la BD
      await refetchChats();
      await refetchMessages();
      
      // Limpiar mensaje pendiente después de refrescar
      setPendingMessages(prev => prev.filter(m => m.id !== pendingId));
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Marcar como error
      setPendingMessages(prev => 
        prev.map(m => m.id === pendingId ? { ...m, status: 'error' as const } : m)
      );
      toast.error('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryMessage = async (pendingMsg: PendingMessage) => {
    if (!selectedChatId) return;
    
    const phone = selectedChatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
    
    // Marcar como enviando
    setPendingMessages(prev => 
      prev.map(m => m.id === pendingMsg.id ? { ...m, status: 'sending' as const } : m)
    );

    try {
      await sendText({ 
        phone, 
        message: pendingMsg.content,
        leadId: selectedChat?.leadId || null,
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

  const getPhoneDisplay = (chatId: string) => {
    const phone = chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
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

  // Combinar mensajes reales con pendientes
  const allMessages = [
    ...messages,
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
      createdAt: p.timestamp,
      _pending: p.status,
    })),
  ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
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
            </div>
          ) : (
            <div>
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  onClick={() => setSelectedChatId(chat.chatId)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors flex items-center gap-3",
                    "hover:bg-accent/50 border-b border-border/50",
                    selectedChatId === chat.chatId && "bg-accent"
                  )}
                >
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {chat.leadCompany?.[0]?.toUpperCase() || chat.leadName?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate text-foreground">
                        {chat.leadCompany || chat.leadName || getPhoneDisplay(chat.chatId)}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {formatTime(chat.lastTimestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {chat.lastMessage}
                    </p>
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
        {selectedChatId ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-4 border-b border-border flex items-center gap-3 bg-card shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0"
                onClick={() => setSelectedChatId(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-10 h-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedChat?.leadCompany?.[0]?.toUpperCase() || selectedChat?.leadName?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {selectedChat?.leadCompany || selectedChat?.leadName || getPhoneDisplay(selectedChatId)}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span className="truncate">{getPhoneDisplay(selectedChatId)}</span>
                </div>
              </div>
            </div>

            {/* Messages Area - WhatsApp style background */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 bg-[#efeae2] dark:bg-[#0b141a]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
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
                    const isPending = '_pending' in message;
                    const pendingStatus = isPending ? (message as any)._pending : null;
                    
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
                              ? "bg-[#d9fdd3] dark:bg-emerald-900 rounded-tr-none"
                              : "bg-card dark:bg-slate-800 rounded-tl-none",
                            pendingStatus === 'sending' && "opacity-70",
                            pendingStatus === 'error' && "opacity-90"
                          )}
                        >
                          <p className={cn(
                            "whitespace-pre-wrap break-words text-sm",
                            message.fromMe ? "text-foreground" : "text-foreground"
                          )}>
                            {linkifyText(message.content)}
                          </p>
                          <div className={cn(
                            "flex items-center justify-end gap-1 mt-1",
                            message.fromMe ? "text-muted-foreground/70" : "text-muted-foreground/70"
                          )}>
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
                                {!isPending && (
                                  <CheckCheck className="w-3 h-3 text-primary" />
                                )}
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
                    disabled={isSending}
                    rows={1}
                    className="resize-none min-h-[42px] max-h-[120px] py-2.5 pr-4 bg-background"
                  />
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
                  size="icon"
                  className="shrink-0 mb-0.5 bg-primary hover:bg-primary/90"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5] dark:bg-[#222e35]">
            <div className="text-center max-w-md px-8">
              <div className="w-64 h-64 mx-auto mb-6 opacity-30">
                <MessageSquare className="w-full h-full text-muted-foreground" strokeWidth={0.5} />
              </div>
              <h2 className="text-2xl font-light text-muted-foreground mb-2">
                Inbox WhatsApp
              </h2>
              <p className="text-muted-foreground/70">
                Selecciona una conversación para ver los mensajes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Templates Modal */}
      <TemplatesModal
        open={showTemplatesModal}
        onOpenChange={setShowTemplatesModal}
        onSelectTemplate={insertTemplate}
      />
    </div>
  );
}
