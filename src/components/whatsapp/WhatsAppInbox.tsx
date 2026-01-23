import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Search, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSessionStatus } from '@/services/wahaService';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  phone: string;
  ackStatus?: string;
  reaction?: string;
}

interface WhatsAppInboxProps {
  onSelectChat: (chatId: string, chatName: string, phone: string) => void;
  selectedChatId: string | null;
}

const WAHA_API_URL = import.meta.env.VITE_WAHA_API_URL || 'http://localhost:3000';
const WAHA_API_KEY = import.meta.env.VITE_WAHA_API_KEY || '12345678';

export function WhatsAppInbox({ onSelectChat, selectedChatId }: WhatsAppInboxProps) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');

  // Check WAHA connection status
  const checkConnection = async () => {
    try {
      const sessionInfo = await getSessionStatus();
      setConnectionStatus(sessionInfo?.status === 'WORKING' ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const fetchChats = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${WAHA_API_URL}/api/default/chats`, {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener los chats');
      }
      
      const data = await response.json();
      console.log('Chats recibidos:', data);
      
      // Handle different WAHA response formats
      const chatsArray = Array.isArray(data) ? data : (data.chats || data.data || []);
      
      // Transform WAHA response to our format
      const transformedChats: Chat[] = chatsArray
        .filter((chat: any) => {
          // Get chat id - could be string or object with _serialized
          const chatId = typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
          return chatId.includes('@c.us'); // Only individual chats, not groups
        })
        .map((chat: any) => {
          const chatId = typeof chat.id === 'string' ? chat.id : chat.id?._serialized || '';
          const phone = chatId.replace('@c.us', '');
          return {
            id: chatId,
            name: chat.name || chat.contact?.name || chat.contact?.pushname || phone || 'Desconocido',
            lastMessage: chat.lastMessage?.body || chat.lastMessage?.text || 'Sin mensajes',
            timestamp: chat.lastMessage?.timestamp || chat.timestamp || Date.now() / 1000,
            unreadCount: chat.unreadCount || 0,
            phone,
          };
        })
        .sort((a: Chat, b: Chat) => b.timestamp - a.timestamp);
      
      setChats(transformedChats);
      setConnectionStatus('connected');
    } catch (err) {
      console.error('Error fetching chats:', err);
      setError('No se pudo conectar con WAHA');
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    
    // Poll for new messages every 10 seconds
    const interval = setInterval(fetchChats, 10000);
    
    // Subscribe to realtime updates from waha_messages table
    if (user) {
      const channel = supabase
        .channel('waha-inbox-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'waha_messages',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('📩 New message received via realtime:', payload);
            // Refresh chats when a new message arrives
            fetchChats();
          }
        )
        .subscribe();
      
      return () => {
        clearInterval(interval);
        supabase.removeChannel(channel);
      };
    }
    
    return () => clearInterval(interval);
  }, [user]);

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Bandeja de Entrada
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchChats}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
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
        {error ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">{error}</p>
            <Button variant="link" onClick={fetchChats} className="mt-2">
              Reintentar
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-300px)]">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {isLoading ? 'Cargando chats...' : 'No hay conversaciones'}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id, chat.name, chat.phone)}
                    className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                      selectedChatId === chat.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {chat.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{chat.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(chat.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                            {chat.lastMessage}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="ml-2 h-5 min-w-[20px] flex items-center justify-center">
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
        )}
      </CardContent>
    </Card>
  );
}
