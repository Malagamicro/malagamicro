import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageSquare, Users, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Conversation } from '@/hooks/useInternalChat';
import { useAuth } from '@/hooks/useAuth';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  isLoading: boolean;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  isLoading,
}: ConversationListProps) {
  const { user } = useAuth();

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.is_group) return 'Grupo';
    
    // For 1:1 chats, show the other person's name
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.full_name || 'Usuario';
  };

  const getAvatarUrl = (conv: Conversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants?.find(p => p.user_id !== user?.id);
    return otherParticipant?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg">Mensajes</h2>
        <Button size="icon" variant="ghost" onClick={onNewConversation}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No hay conversaciones</p>
            <Button 
              variant="link" 
              size="sm" 
              onClick={onNewConversation}
              className="mt-2"
            >
              Iniciar una nueva
            </Button>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conv) => {
              const name = getConversationName(conv);
              const avatarUrl = getAvatarUrl(conv);
              const isActive = conv.id === activeConversationId;
              const hasUnread = (conv.unread_count || 0) > 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                    isActive 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-muted/50'
                  )}
                >
                  <Avatar className="h-10 w-10">
                    {avatarUrl && <AvatarImage src={avatarUrl} />}
                    <AvatarFallback className={conv.is_group ? 'bg-primary/20' : 'bg-muted'}>
                      {conv.is_group ? (
                        <Users className="h-4 w-4 text-primary" />
                      ) : (
                        getInitials(name)
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'font-medium truncate',
                        hasUnread && 'text-foreground'
                      )}>
                        {name}
                      </span>
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message.created_at), {
                            addSuffix: false,
                            locale: es,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        'text-sm truncate',
                        hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}>
                        {conv.last_message?.is_deleted 
                          ? 'Mensaje eliminado'
                          : conv.last_message?.message_type !== 'text'
                          ? `📎 ${conv.last_message?.file_name || 'Archivo'}`
                          : conv.last_message?.content || 'Sin mensajes'}
                      </p>
                      {hasUnread && (
                        <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                          {(conv.unread_count || 0) > 99 ? '99+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
