import { useState } from 'react';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, LifeBuoy, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { TicketChat } from './TicketChat';
import { NewTicketModal } from './NewTicketModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function SupportModule() {
  const { tickets, isLoading } = useSupportTickets();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedTicket = tickets.find(t => t.id === selectedTicketId) || null;

  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cerrado': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'en_progreso': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'alta': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'baja': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="flex h-full bg-background">
      {/* Left Sidebar - Tickets List */}
      <div className={`w-full md:w-[350px] border-r flex flex-col ${selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Soporte CRM
            </h2>
            <Button size="icon" variant="ghost" onClick={() => setIsNewTicketModalOpen(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar tickets..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground animate-pulse">
              Cargando tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No se encontraron tickets.
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors border ${
                  selectedTicketId === ticket.id 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-card border-transparent hover:border-border'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-sm truncate pr-2">{ticket.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(ticket.status)}
                    <span className="capitalize">{ticket.status.replace('_', ' ')}</span>
                  </div>
                  <span>{format(new Date(ticket.created_at), "d MMM, HH:mm", { locale: es })}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content - Chat/Detail */}
      <div className={`flex-1 flex flex-col ${!selectedTicketId ? 'hidden md:flex' : 'flex'}`}>
        {selectedTicket ? (
          <TicketChat 
            ticket={selectedTicket} 
            onBack={() => setSelectedTicketId(null)} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
            <LifeBuoy className="w-16 h-16 opacity-20" />
            <p>Selecciona un ticket o crea uno nuevo para empezar.</p>
            <Button onClick={() => setIsNewTicketModalOpen(true)}>Crear Ticket</Button>
          </div>
        )}
      </div>

      <NewTicketModal 
        open={isNewTicketModalOpen} 
        onOpenChange={setIsNewTicketModalOpen}
        onSuccess={(newId) => {
          setSelectedTicketId(newId);
          setIsNewTicketModalOpen(false);
        }}
      />
    </div>
  );
}
