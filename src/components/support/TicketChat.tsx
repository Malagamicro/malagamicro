import { useState, useRef, useEffect } from 'react';
import { SupportTicket } from '@/types/support';
import { useSupportMessages } from '@/hooks/useSupportMessages';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, CheckCircle2, UserCircle2, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TicketChatProps {
  ticket: SupportTicket;
  onBack: () => void;
}

export function TicketChat({ ticket, onBack }: TicketChatProps) {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, isSending } = useSupportMessages(ticket.id);
  const { updateStatus, isUpdating } = useSupportTickets();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isClosed = ticket.status === 'cerrado';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isClosed) return;
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background animate-fade-in">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="font-semibold text-lg line-clamp-1">{ticket.title}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Ticket #{ticket.id.slice(0, 8)}
              <span className="capitalize px-1.5 py-0.5 rounded-full text-[10px] border">
                {ticket.status.replace('_', ' ')}
              </span>
            </p>
          </div>
        </div>
        {!isClosed && (
          <Button 
            variant="outline" 
            className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => updateStatus({ id: ticket.id, status: 'cerrado' })}
            disabled={isUpdating}
          >
            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            <span className="hidden sm:inline">Cerrar Incidencia</span>
            <span className="sm:hidden">Cerrar</span>
          </Button>
        )}
      </div>

      {/* Ticket Description as first message */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
        <div className="flex flex-col gap-1 w-full max-w-[85%] mr-auto">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">Descripción Original</span>
            <span className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "d MMM, HH:mm", { locale: es })}</span>
          </div>
          <div className="p-3 rounded-2xl rounded-tl-sm bg-card border text-sm text-foreground whitespace-pre-wrap">
            {ticket.description}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === user?.id;
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col gap-1 w-full max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!isMe && <UserCircle2 className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.created_at), "d MMM, HH:mm", { locale: es })}
                  </span>
                </div>
                <div 
                  className={`p-3 rounded-2xl text-sm whitespace-pre-wrap shadow-sm ${
                    isMe 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card border text-foreground rounded-tl-sm'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t bg-card">
        {isClosed ? (
          <div className="text-center p-2 text-sm text-muted-foreground bg-muted/50 rounded-lg">
            Este ticket está cerrado. Si necesitas más ayuda, abre uno nuevo.
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <Input 
              placeholder="Escribe un mensaje..." 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              disabled={isSending}
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim() || isSending}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
