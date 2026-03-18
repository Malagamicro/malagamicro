import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ticket, Trash2, CheckCircle2, XCircle, RefreshCw, Search,
  Clock, Send, Loader2, User, Building2, ChevronRight, MessageSquare,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useOsTicketHistory, OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { parseEmail, getPriorityCfg } from './osticketHelpers';
import { TicketDetail } from './TicketDetail';

export function OsTicketPanel() {
  const { tickets, isLoading, refetch, deleteTicket, isDeleting, clearHistory, isClearing, stats } = useOsTicketHistory();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  const [selectedTicket, setSelectedTicket] = useState<OsTicketRecord | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendQuick = async (ticket: OsTicketRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setResendingId(ticket.id);
    try {
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
      toast.success('Notificación reenviada');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setResendingId(null);
    }
  };

  const filtered = tickets
    .filter((t) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        t.subject.toLowerCase().includes(q) ||
        t.customer_name?.toLowerCase().includes(q) ||
        parseEmail(t.customer_email).toLowerCase().includes(q) ||
        t.ticket_number?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' ? true : filterStatus === 'sent' ? t.notification_sent : !t.notification_sent;
      const matchPriority = filterPriority === 'all' ? true : t.priority?.toLowerCase() === filterPriority;
      return matchSearch && matchStatus && matchPriority;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<string, number> = { emergency: 0, alta: 1, high: 1, media: 2, normal: 2, baja: 3, low: 3 };
        return (order[a.priority?.toLowerCase() ?? ''] ?? 4) - (order[b.priority?.toLowerCase() ?? ''] ?? 4);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: list ── */}
      <div className={cn(
        "flex flex-col border-r bg-background transition-all",
        selectedTicket ? "hidden md:flex md:w-[380px] lg:w-[420px] xl:w-[460px] flex-shrink-0" : "flex-1"
      )}>
        {/* Stats bar */}
        <div className="p-3 border-b">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Ticket, label: 'Total', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
              { icon: CheckCircle2, label: 'Enviados', value: stats.sentOk, color: 'text-green-500', bg: 'bg-green-500/10' },
              { icon: XCircle, label: 'Fallidos', value: stats.failed, color: 'text-red-500', bg: 'bg-red-500/10' },
              { icon: Clock, label: 'Hoy', value: stats.today, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="flex flex-col items-center p-2 rounded-xl border bg-card gap-1 cursor-default">
                <div className={cn('p-1.5 rounded-lg', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </div>
                <span className="text-base font-bold leading-none">{value}</span>
                <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="p-2.5 space-y-2 border-b bg-muted/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm bg-background"
            />
          </div>
          <div className="flex gap-1.5">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">✅ Enviados</SelectItem>
                <SelectItem value="failed">❌ Fallidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Prioridad</SelectItem>
                <SelectItem value="high">🔴 Alta</SelectItem>
                <SelectItem value="normal">🟡 Normal</SelectItem>
                <SelectItem value="low">🟢 Baja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">📅 Fecha</SelectItem>
                <SelectItem value="priority">🔥 Prior.</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 px-2.5 py-1.5 border-b">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Actualizar
          </Button>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {filtered.length}/{tickets.length} tickets
          </span>
          {tickets.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled={isClearing}>
                  <Trash2 className="h-3 w-3 mr-1" /> Limpiar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar historial?</AlertDialogTitle>
                  <AlertDialogDescription>Se eliminarán todos los tickets del historial permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearHistory()} className="bg-destructive text-destructive-foreground">Eliminar todo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Ticket list */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 rounded-full bg-muted mb-3">
                <Ticket className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-sm">No hay tickets</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || filterStatus !== 'all' || filterPriority !== 'all'
                  ? 'Prueba con otros filtros'
                  : 'Los tickets de osTicket aparecerán aquí'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((ticket) => {
                const pc = getPriorityCfg(ticket.priority);
                const isSelected = selectedTicket?.id === ticket.id;
                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      "px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/60 group relative",
                      isSelected && "bg-primary/5 border-l-[3px] border-l-primary pl-[9px]"
                    )}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {ticket.notification_sent
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          : <XCircle className="h-3.5 w-3.5 text-red-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-mono text-muted-foreground">#{ticket.ticket_number || '—'}</span>
                          <Badge variant={pc.color} className="text-[9px] h-3.5 px-1">
                            {pc.label}
                          </Badge>
                        </div>
                        <p className="text-xs font-medium leading-snug truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {ticket.customer_name && (
                            <span className="flex items-center gap-0.5 truncate">
                              <User className="h-2.5 w-2.5 flex-shrink-0" /> {ticket.customer_name}
                            </span>
                          )}
                          {ticket.department && (
                            <span className="flex items-center gap-0.5 truncate">
                              <Building2 className="h-2.5 w-2.5 flex-shrink-0" /> {ticket.department}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(ticket.created_at), "d MMM HH:mm", { locale: es })}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-6 w-6 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
                                onClick={(e) => handleResendQuick(ticket, e)}
                                disabled={resendingId === ticket.id}
                              >
                                {resendingId === ticket.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Reenviar notificación</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform", isSelected && "text-primary")} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: detail ── */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TicketDetail
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onDelete={(id) => { deleteTicket(id); setSelectedTicket(null); }}
            isDeleting={isDeleting}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center bg-muted/10">
          <div className="p-8 rounded-2xl bg-background border shadow-sm max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Selecciona un ticket</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Haz clic en cualquier ticket para ver sus detalles y editar el mensaje de WhatsApp
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
