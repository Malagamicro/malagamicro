import { useState } from 'react';
import { sanitizeBasicHtml } from '@/lib/sanitize';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Trash2, CheckCircle2, XCircle, Mail, User, Building2, Clock,
  MessageSquare, Phone, Copy, ExternalLink, MoreHorizontal,
  ArrowLeft, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import type { OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { cn } from '@/lib/utils';
import { parseEmail, getPriorityCfg, type AttachedFile } from './osticketHelpers';
import { WhatsAppEditor } from './WhatsAppEditor';
import { TicketNotesChat } from './TicketNotesChat';

export function TicketDetail({
  ticket,
  onClose,
  onDelete,
  isDeleting,
}: {
  ticket: OsTicketRecord;
  onClose: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [isSending, setIsSending] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const { config } = useOsTicketConfig();
  const priorityCfg = getPriorityCfg(ticket.priority);

  const handleSendWhatsApp = async (message: string, imageUrl?: string, sendImage?: boolean, attachments?: AttachedFile[]) => {
    setIsSending(true);
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
          custom_message: message,
          custom_image_url: sendImage ? imageUrl : null,
          attachments: attachments?.map(a => ({ url: a.url, name: a.name, type: a.type })) || [],
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('✅ Mensaje enviado correctamente por WhatsApp');
    } catch (err: any) {
      toast.error(`Error al enviar: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const openInOsTicket = () => {
    if (config?.osticket_url && ticket.ticket_id) {
      window.open(`${config.osticket_url}/scp/tickets.php?id=${ticket.ticket_id}`, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('Configura la URL de osTicket en Ajustes');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-card flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 flex-shrink-0 md:hidden">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm font-mono">
              #{ticket.ticket_number || ticket.ticket_id || '—'}
            </span>
            <Badge variant={priorityCfg.color} className="text-[10px]">
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 inline-block', priorityCfg.dot)} />
              {priorityCfg.label}
            </Badge>
            {ticket.notification_sent ? (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Notificado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 bg-red-50 dark:bg-red-950/20">
                <XCircle className="h-3 w-3 mr-1" /> Sin notificar
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{ticket.subject}</p>
        </div>
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 flex-shrink-0 hidden md:flex">
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cerrar panel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openInOsTicket}>
              <ExternalLink className="h-4 w-4 mr-2" /> Abrir en osTicket
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyToClipboard(ticket.ticket_number || '', 'Nº ticket')}>
              <Copy className="h-4 w-4 mr-2" /> Copiar nº ticket
            </DropdownMenuItem>
            {ticket.customer_email && (
              <DropdownMenuItem onClick={() => copyToClipboard(parseEmail(ticket.customer_email), 'Email')}>
                <Mail className="h-4 w-4 mr-2" /> Copiar email
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar del historial
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este ticket?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { onDelete(ticket.id); onClose(); }} className="bg-destructive text-destructive-foreground">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: User, label: 'Cliente', value: ticket.customer_name },
              { icon: Building2, label: 'Departamento', value: ticket.department },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="p-2.5 rounded-lg border bg-muted/20 space-y-0.5">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  <Icon className="h-3 w-3" /> {label}
                </div>
                <p className="text-sm font-medium">{value || '—'}</p>
              </div>
            ))}
            <div className="p-2.5 rounded-lg border bg-muted/20 space-y-0.5 col-span-2">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                <Mail className="h-3 w-3" /> Email
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{parseEmail(ticket.customer_email) || '—'}</p>
                {ticket.customer_email && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => copyToClipboard(parseEmail(ticket.customer_email), 'Email')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {ticket.message && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <MessageSquare className="h-3.5 w-3.5" /> Contenido del ticket
              </div>
              <div
                className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg max-h-36 overflow-y-auto prose prose-sm dark:prose-invert max-w-none border text-[13px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(ticket.message) }}
              />
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {format(new Date(ticket.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
            </div>
            {ticket.notification_phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {ticket.notification_phone}
              </div>
            )}
          </div>

          <Separator />
          <TicketNotesChat ticketId={ticket.ticket_id || ticket.id} />
          <Separator />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full gap-2">
                <XCircle className="h-4 w-4" />
                Cerrar y eliminar ticket
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar este ticket?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se cerrará y eliminará el ticket #{ticket.ticket_number || ticket.ticket_id} del historial. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(ticket.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Cerrar y eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Separator />

          <div className="space-y-2">
            <button
              className="flex items-center gap-2 w-full text-left group"
              onClick={() => setWhatsappOpen(!whatsappOpen)}
            >
              <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-green-600" />
              </div>
              <h3 className="font-semibold text-sm flex-1">Editor de mensaje WhatsApp</h3>
              {whatsappOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {whatsappOpen && (
              <WhatsAppEditor ticket={ticket} onSend={handleSendWhatsApp} isSending={isSending} />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
