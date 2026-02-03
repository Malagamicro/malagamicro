import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Ticket, CheckCircle2, XCircle } from 'lucide-react';
import { useOsTicketHistory } from '@/hooks/useOsTicketHistory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export function RecentTickets() {
  const { tickets, isLoading } = useOsTicketHistory();
  const navigate = useNavigate();

  // Get last 5 tickets
  const recentTickets = tickets.slice(0, 5);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-warning" />
            Últimos Tickets
          </div>
          <button 
            onClick={() => navigate('/tickets')}
            className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos →
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Cargando...</div>
        ) : recentTickets.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No hay tickets recientes
          </div>
        ) : (
          <div className="space-y-3">
            {recentTickets.map((ticket) => (
              <div 
                key={ticket.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate('/tickets')}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{ticket.subject}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {ticket.customer_name || 'Sin nombre'}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ticket.created_at), "d MMM, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>
                {ticket.notification_sent ? (
                  <Badge variant="outline" className="border-primary/50 text-primary">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enviado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-destructive/50 text-destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    Fallido
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
