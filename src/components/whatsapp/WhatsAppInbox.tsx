import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, MessageSquare, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWhatsAppChats, WhatsAppChat } from '@/hooks/useWhatsAppChats';
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';
import { NewChatModal } from './NewChatModal';
import { ConnectionIndicator } from './ConnectionIndicator';

interface WhatsAppInboxProps {
  onSelectChat: (chatId: string, chatName: string, phone: string) => void;
  selectedChatId: string | null;
}

export function WhatsAppInbox({ onSelectChat, selectedChatId }: WhatsAppInboxProps) {
  const { 
    chats, 
    isLoadingChats, 
    refetchChats, 
    getOrCreateChat,
    updateChatLastMessage,
  } = useWhatsAppChats();
  
  // Centralized realtime connection
  const { status: connectionStatus, reconnect } = useRealtimeConnection();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const handleCreateChat = async (phone: string, name?: string) => {
    const chatId = `${phone}@c.us`;
    await getOrCreateChat({ chatId, phone, customName: name });
    onSelectChat(chatId, name || phone, phone);
  };

  const handleSelectChat = async (chat: WhatsAppChat) => {
    if (chat.unreadCount > 0) {
      await updateChatLastMessage({ chatId: chat.chatId, resetUnread: true });
    }
    onSelectChat(chat.chatId, chat.customName || chat.phone, chat.phone);
  };

  const filteredChats = chats.filter(chat =>
    (chat.customName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     chat.phone.includes(searchTerm) ||
     chat.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return format(date, 'EEEE', { locale: es });
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Inbox
              <ConnectionIndicator 
                status={connectionStatus} 
                onReconnect={reconnect}
              />
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewChatOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchChats()}
                disabled={isLoadingChats}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingChats ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-300px)]">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {isLoadingChats ? (
                  'Cargando conversaciones...'
                ) : (
                  <div className="space-y-2">
                    <p>No hay conversaciones</p>
                    <Button
                      variant="link"
                      onClick={() => setIsNewChatOpen(true)}
                      className="text-primary"
                    >
                      Iniciar una nueva conversación
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                      selectedChatId === chat.chatId ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        {chat.avatarUrl ? (
                          <AvatarImage src={chat.avatarUrl} alt={chat.customName || chat.phone} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(chat.customName || chat.phone).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {chat.customName || chat.phone}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(chat.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                            {chat.lastMessage || 'Sin mensajes'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge 
                              variant="default" 
                              className="ml-2 h-5 min-w-[20px] flex items-center justify-center bg-primary hover:bg-primary/90"
                            >
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          +{chat.phone}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onCreateChat={handleCreateChat}
      />
    </>
  );
}