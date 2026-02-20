import { useState } from 'react';
import { sanitizeBasicHtml } from '@/lib/sanitize';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ticket,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  AlertTriangle,
  Mail,
  User,
  Building2,
  Clock,
  Send,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOsTicketHistory, OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { Skeleton } from '@/components/ui/skeleton';

export function OsTicketHistory() {
  const {
    tickets,
    isLoading,
    refetch,
    deleteTicket,
    isDeleting,
    clearHistory,
    isClearing,
    stats,
  } = useOsTicketHistory();

  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<OsTicketRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Parse customer_email which may be stored as JSON, stringified JSON, or plain text
  const parseEmail = (raw: string | null): string => {
    if (!raw) return '';
    const str = raw.trim();
    // Try to extract email from JSON-like strings
    if (str.startsWith('{') || str.startsWith('"')) {
      // Try direct JSON parse
      try {
        const parsed = JSON.parse(str);
        if (typeof parsed === 'string') {
          // It was a double-encoded string, try parsing again
          try {
            const inner = JSON.parse(parsed);
            if (inner.email) return inner.email;
          } catch { /* use parsed string */ }
          // Extract email from "Name <email>" format
          const angleMatch = parsed.match(/<([^>]+)>/);
          if (angleMatch) return angleMatch[1];
          return parsed;
        }
        if (parsed.email) return parsed.email;
        if (parsed.address) {
          const angleMatch = parsed.address.match(/<([^>]+)>/);
          if (angleMatch) return angleMatch[1];
          return parsed.address;
        }
        return raw;
      } catch { /* fall through */ }
      // Regex fallback: extract any email from the raw string
      const emailMatch = str.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
      if (emailMatch) return emailMatch[0];
    }
    // "Name <email>" format
    const angleMatch = str.match(/<([^>]+)>/);
    if (angleMatch) return angleMatch[1];
    return raw;
  };

  const filteredTickets = tickets.filter(
    (t) =>
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      parseEmail(t.customer_email).toLowerCase().includes(search.toLowerCase()) ||
      t.ticket_number?.toLowerCase().includes(search.toLowerCase())
  );

  const handleResend = async (ticket: OsTicketRecord) => {
    setResendingId(ticket.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('resend-ticket-notification', {
        body: {
          ticket_id: ticket.ticket_id,
          number: ticket.ticket_number,
          subject: ticket.subject,
          name: ticket.customer_name,
          email: ticket.customer_email,
          department: ticket.department,
          priority: ticket.priority,
          message: ticket.message,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Notificación reenviada correctamente');
    } catch (err: any) {
      toast.error(`Error al reenviar: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority?.toLowerCase()) {
      case 'alta':
      case 'high':
      case 'emergency':
        return 'destructive';
      case 'media':
      case 'normal':
        return 'default';
      case 'baja':
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sentOk}</p>
                <p className="text-xs text-muted-foreground">Notificados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.today}</p>
                <p className="text-xs text-muted-foreground">Hoy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>

          {tickets.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isClearing}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar historial
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar todo el historial?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará todos los tickets del historial. Esta
                    acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearHistory()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Eliminar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Tickets list */}
      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg">No hay tickets</h3>
            <p className="text-sm text-muted-foreground">
              {search
                ? 'No se encontraron tickets con ese criterio'
                : 'Cuando recibas tickets de osTicket aparecerán aquí'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Historial de tickets ({filteredTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {ticket.notification_sent ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                          <span className="font-medium truncate">
                            {ticket.ticket_number || 'Sin número'} - {ticket.subject}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {ticket.customer_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {ticket.customer_name}
                            </span>
                          )}
                          {ticket.customer_email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 flex-shrink-0" />
                              {parseEmail(ticket.customer_email)}
                            </span>
                          )}
                          {ticket.department && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {ticket.department}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ticket.priority && (
                          <Badge variant={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(ticket.created_at), 'dd MMM HH:mm', {
                            locale: es,
                          })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          title="Reenviar notificación de WhatsApp"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResend(ticket);
                          }}
                          disabled={resendingId === ticket.id}
                        >
                          {resendingId === ticket.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTicket(ticket.id);
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Ticket detail dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              {selectedTicket?.ticket_number || 'Ticket'}
            </DialogTitle>
          </DialogHeader>

          {selectedTicket && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Asunto</h4>
                <p className="text-sm text-muted-foreground">{selectedTicket.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Cliente</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicket.customer_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Email</h4>
                  <p className="text-sm text-muted-foreground break-all">
                    {parseEmail(selectedTicket.customer_email) || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Departamento</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicket.department || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Prioridad</h4>
                  <Badge variant={getPriorityColor(selectedTicket.priority)}>
                    {selectedTicket.priority || 'Normal'}
                  </Badge>
                </div>
              </div>

              {selectedTicket.message && (
                <div>
                  <h4 className="font-medium mb-1">Mensaje</h4>
                  <div 
                    className="text-sm text-muted-foreground bg-muted p-3 rounded-lg max-h-40 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(selectedTicket.message) }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  {selectedTicket.notification_sent ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-green-600">
                        Notificado a {selectedTicket.notification_phone}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">
                        Error al enviar notificación
                      </span>
                    </>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(selectedTicket.created_at), 'dd/MM/yyyy HH:mm:ss', {
                    locale: es,
                  })}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
