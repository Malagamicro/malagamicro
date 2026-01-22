import { useState, useEffect, useRef } from 'react';
import { useWahaMessages, ChatSummary, WahaMessage } from '@/hooks/useWahaMessages';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';
import { sendText, formatPhoneNumber } from '@/services/wahaService';
import { TemplatesModal } from '@/components/whatsapp/TemplatesModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ArrowLeft, 
  FileText,
  User,
  Building2,
  Phone,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Inbox() {
  const { chats, isLoadingChats, useMessagesForChat, refetchChats } = useWahaMessages();
  const { templates } = useMessageTemplates();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: isLoadingMessages, refetch: refetchMessages } = useMessagesForChat(selectedChatId);

  const selectedChat = chats.find(c => c.chatId === selectedChatId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    
    setIsSending(true);
    try {
      // Send via WAHA - it will automatically log to DB
      await sendText({ 
        phone, 
        message: messageInput.trim(),
        leadId: selectedChat?.leadId || null,
      });

      setMessageInput('');
      toast.success('Mensaje enviado');
      
      // Refresh to show the new message
      await refetchChats();
      if (selectedChatId) {
        await refetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar mensaje');
    } finally {
      setIsSending(false);
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Chat List */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 border-r border-border flex flex-col",
        selectedChatId && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Inbox WhatsApp
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
        
        <ScrollArea className="flex-1">
          {isLoadingChats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay conversaciones</p>
              <p className="text-sm text-muted-foreground mt-1">
                Los mensajes aparecerán aquí cuando envíes o recibas mensajes
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {chats.map((chat) => (
                <button
                  key={chat.chatId}
                  onClick={() => setSelectedChatId(chat.chatId)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    selectedChatId === chat.chatId && "bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {chat.leadCompany?.[0] || chat.leadName?.[0] || <User className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">
                          {chat.leadCompany || chat.leadName || getPhoneDisplay(chat.chatId)}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(chat.lastTimestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {chat.lastMessage}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat View */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedChatId && "hidden md:flex"
      )}>
        {selectedChatId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSelectedChatId(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {selectedChat?.leadCompany?.[0] || selectedChat?.leadName?.[0] || <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">
                  {selectedChat?.leadCompany || selectedChat?.leadName || getPhoneDisplay(selectedChatId)}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  {getPhoneDisplay(selectedChatId)}
                  {selectedChat?.leadCompany && selectedChat?.leadName && (
                    <>
                      <span>•</span>
                      <Building2 className="w-3 h-3" />
                      {selectedChat.leadName}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  No hay mensajes en esta conversación
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.fromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-lg px-3 py-2",
                          message.fromMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          message.fromMe ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {format(message.timestamp, 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  title="Plantillas"
                  onClick={() => setShowTemplatesModal(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || isSending}
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Selecciona una conversación</p>
              <p className="text-sm mt-1">
                O envía un mensaje a un lead desde la sección de Leads
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
