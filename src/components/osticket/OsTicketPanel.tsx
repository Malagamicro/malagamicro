import { useState, useRef } from 'react';
import { sanitizeBasicHtml } from '@/lib/sanitize';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ticket, Trash2, CheckCircle2, XCircle, RefreshCw, Search,
  AlertTriangle, Mail, User, Building2, Clock, Send, Loader2,
  MessageSquare, Phone, Copy, ExternalLink, ChevronRight,
  Filter, SortAsc, Eye, Smartphone, Image as ImageIcon,
  Bell, BellOff, MoreHorizontal, Download, Star, StarOff,
  CheckSquare, Hash, Calendar, ArrowLeft, Zap, Settings2,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOsTicketHistory, OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/* ────────────── helpers ────────────── */
const parseEmail = (raw: string | null): string => {
  if (!raw) return '';
  const str = raw.trim();
  if (str.startsWith('{') || str.startsWith('"')) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'string') {
        try { const inner = JSON.parse(parsed); if (inner.email) return inner.email; } catch { /* */ }
        const m = parsed.match(/<([^>]+)>/); if (m) return m[1]; return parsed;
      }
      if (parsed.email) return parsed.email;
      if (parsed.address) { const m = parsed.address.match(/<([^>]+)>/); return m ? m[1] : parsed.address; }
      return raw;
    } catch { /* */ }
    const m = str.match(/[\w.+-]+@[\w.-]+\.\w{2,}/); if (m) return m[0];
  }
  const m = str.match(/<([^>]+)>/); return m ? m[1] : raw;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: 'destructive' | 'default' | 'secondary' | 'outline'; dot: string }> = {
  alta: { label: 'Alta', color: 'destructive', dot: 'bg-red-500' },
  high: { label: 'Alta', color: 'destructive', dot: 'bg-red-500' },
  emergency: { label: 'Urgente', color: 'destructive', dot: 'bg-red-600' },
  media: { label: 'Media', color: 'default', dot: 'bg-amber-500' },
  normal: { label: 'Normal', color: 'default', dot: 'bg-amber-500' },
  baja: { label: 'Baja', color: 'secondary', dot: 'bg-green-500' },
  low: { label: 'Baja', color: 'secondary', dot: 'bg-green-500' },
};

const getPriorityCfg = (p: string | null) => PRIORITY_CONFIG[p?.toLowerCase() ?? ''] ?? { label: p || 'Normal', color: 'outline' as const, dot: 'bg-gray-400' };

const VARIABLES = [
  { key: '{{ticket_id}}', label: 'ID ticket' },
  { key: '{{number}}', label: 'Nº ticket' },
  { key: '{{subject}}', label: 'Asunto' },
  { key: '{{name}}', label: 'Cliente' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{department}}', label: 'Depto.' },
  { key: '{{priority}}', label: 'Prioridad' },
  { key: '{{ticket_url}}', label: 'URL ticket' },
];

const QUICK_PHRASES = [
  '✅ Hemos recibido tu ticket y lo estamos procesando.',
  '🔧 Un técnico se pondrá en contacto contigo en breve.',
  '📋 ¿Podrías proporcionarnos más información sobre el problema?',
  '🎉 Tu solicitud ha sido resuelta. ¡Que tengas un buen día!',
  '⏰ El tiempo estimado de resolución es de 24-48 horas.',
  '📞 Te llamaremos para coordinar la visita técnica.',
];

/* ────────────── WhatsApp Message Editor ────────────── */
function WhatsAppEditor({
  ticket,
  onSend,
  isSending,
}: {
  ticket: OsTicketRecord;
  onSend: (msg: string, imageUrl?: string, sendImage?: boolean) => void;
  isSending: boolean;
}) {
  const { config } = useOsTicketConfig();
  const [message, setMessage] = useState(() => {
    const tmpl = config?.message_template || '';
    return tmpl
      .replace(/\{\{ticket_id\}\}/g, ticket.ticket_id || '')
      .replace(/\{\{number\}\}/g, ticket.ticket_number || '')
      .replace(/\{\{subject\}\}/g, ticket.subject || '')
      .replace(/\{\{name\}\}/g, ticket.customer_name || '')
      .replace(/\{\{email\}\}/g, parseEmail(ticket.customer_email))
      .replace(/\{\{department\}\}/g, ticket.department || '')
      .replace(/\{\{priority\}\}/g, ticket.priority || '')
      .replace(/\{\{ticket_url\}\}/g, `${config?.osticket_url || ''}/scp/tickets.php?id=${ticket.ticket_id}`);
  });
  const [imageUrl, setImageUrl] = useState(config?.image_url || '');
  const [sendImage, setSendImage] = useState(config?.send_image !== false);
  const [showVars, setShowVars] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(p => p + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = message.slice(0, start) + text + message.slice(end);
    setMessage(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + text.length, start + text.length); }, 0);
  };

  const formatBold = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const sel = message.slice(ta.selectionStart, ta.selectionEnd);
    if (sel) insertAtCursor(`*${sel}*`);
  };

  const formatItalic = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const sel = message.slice(ta.selectionStart, ta.selectionEnd);
    if (sel) insertAtCursor(`_${sel}_`);
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded-lg border flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-bold" onClick={formatBold}>B</Button>
            </TooltipTrigger>
            <TooltipContent>Negrita (*texto*)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs italic" onClick={formatItalic}>I</Button>
            </TooltipTrigger>
            <TooltipContent>Cursiva (_texto_)</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator orientation="vertical" className="h-5" />
        {/* Quick phrases */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Zap className="h-3 w-3 mr-1" /> Frases rápidas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {QUICK_PHRASES.map((p, i) => (
              <DropdownMenuItem key={i} onClick={() => insertAtCursor(p)} className="text-xs whitespace-normal">
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost" size="sm" className="h-7 px-2 text-xs"
          onClick={() => setShowVars(!showVars)}
        >
          <Hash className="h-3 w-3 mr-1" /> Variables
          {showVars ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
        <div className="ml-auto">
          <Button
            variant="ghost" size="sm" className="h-7 px-2 text-xs"
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? <Eye className="h-3 w-3 mr-1" /> : <Smartphone className="h-3 w-3 mr-1" />}
            {previewMode ? 'Editar' : 'Vista previa'}
          </Button>
        </div>
      </div>

      {/* Variables chips */}
      {showVars && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => insertAtCursor(v.key)}
              className="px-2 py-0.5 bg-background hover:bg-primary hover:text-primary-foreground rounded text-xs font-mono transition-colors border border-border cursor-pointer"
            >
              {v.key}
            </button>
          ))}
        </div>
      )}

      {/* Editor / Preview */}
      {previewMode ? (
        <div className="bg-muted rounded-xl p-4 min-h-[200px]">
          <div className="max-w-xs ml-auto">
            <div className="bg-green-100 dark:bg-green-900/40 rounded-2xl rounded-tr-sm p-3 shadow-sm space-y-2 border border-green-200 dark:border-green-800">
              {sendImage && imageUrl && (
                <div className="rounded-xl overflow-hidden -mx-3 -mt-3 mb-2">
                  <img src={imageUrl} alt="Cabecera" className="w-full h-28 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <pre className="text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed break-words">{message}</pre>
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">ahora ✓✓</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          className="font-mono text-sm resize-none"
          placeholder="Escribe el mensaje de WhatsApp..."
        />
      )}

      {/* Image config */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
        <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="URL de imagen (opcional)"
            className="h-8 text-xs"
            disabled={!sendImage}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Label className="text-xs text-muted-foreground">Imagen</Label>
          <Switch checked={sendImage} onCheckedChange={setSendImage} />
        </div>
      </div>

      {/* Send button */}
      <Button
        className="w-full"
        onClick={() => onSend(message, imageUrl, sendImage)}
        disabled={isSending || !message.trim()}
      >
        {isSending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
        ) : (
          <><Send className="h-4 w-4 mr-2" /> Enviar por WhatsApp</>
        )}
      </Button>
    </div>
  );
}

/* ────────────── Ticket Detail Panel ────────────── */
function TicketDetail({
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
  const { config } = useOsTicketConfig();
  const priorityCfg = getPriorityCfg(ticket.priority);

  const handleSendWhatsApp = async (message: string, imageUrl?: string, sendImage?: boolean) => {
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
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast.success('Mensaje de WhatsApp enviado correctamente');
    } catch (err: any) {
      toast.error(`Error al enviar: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const openInOsTicket = () => {
    if (config?.osticket_url && ticket.ticket_id) {
      window.open(`${config.osticket_url}/scp/tickets.php?id=${ticket.ticket_id}`, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('Configura la URL de osTicket en Ajustes');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              #{ticket.ticket_number || ticket.ticket_id || 'Sin número'}
            </span>
            <Badge variant={priorityCfg.color} className="text-xs">
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1', priorityCfg.dot)} />
              {priorityCfg.label}
            </Badge>
            {ticket.notification_sent ? (
              <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Notificado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30">
                <XCircle className="h-3 w-3 mr-1" /> Sin notificar
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{ticket.subject}</p>
        </div>

        {/* Actions dropdown */}
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
            <DropdownMenuItem onClick={() => copyToClipboard(ticket.ticket_number || '', 'Número de ticket')}>
              <Copy className="h-4 w-4 mr-2" /> Copiar nº ticket
            </DropdownMenuItem>
            {ticket.customer_email && (
              <DropdownMenuItem onClick={() => copyToClipboard(parseEmail(ticket.customer_email), 'Email')}>
                <Mail className="h-4 w-4 mr-2" /> Copiar email
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(ticket.id)}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Eliminar del historial
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3" /> Cliente
              </div>
              <p className="text-sm font-medium">{ticket.customer_name || '—'}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> Departamento
              </div>
              <p className="text-sm font-medium">{ticket.department || '—'}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card space-y-1 col-span-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> Email
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{parseEmail(ticket.customer_email) || '—'}</p>
                {ticket.customer_email && (
                  <Button
                    variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
                    onClick={() => copyToClipboard(parseEmail(ticket.customer_email), 'Email')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Message body */}
          {ticket.message && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-muted-foreground" /> Contenido del ticket
              </div>
              <div
                className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg max-h-48 overflow-y-auto prose prose-sm dark:prose-invert max-w-none border"
                dangerouslySetInnerHTML={{ __html: sanitizeBasicHtml(ticket.message) }}
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {format(new Date(ticket.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
            </div>
            {ticket.notification_phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                {ticket.notification_phone}
              </div>
            )}
          </div>

          <Separator />

          {/* WhatsApp Editor */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <MessageSquare className="h-4 w-4 text-green-600" />
              </div>
              <h3 className="font-semibold text-sm">Enviar mensaje WhatsApp</h3>
            </div>
            <WhatsAppEditor ticket={ticket} onSend={handleSendWhatsApp} isSending={isSending} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* ────────────── Main Panel ────────────── */
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
      const matchSearch =
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        parseEmail(t.customer_email).toLowerCase().includes(search.toLowerCase()) ||
        t.ticket_number?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        filterStatus === 'all' ? true :
        filterStatus === 'sent' ? t.notification_sent :
        !t.notification_sent;
      const matchPriority =
        filterPriority === 'all' ? true :
        t.priority?.toLowerCase() === filterPriority.toLowerCase();
      return matchSearch && matchStatus && matchPriority;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { emergency: 0, alta: 1, high: 1, media: 2, normal: 2, baja: 3, low: 3 };
        const oa = order[a.priority?.toLowerCase() as keyof typeof order] ?? 4;
        const ob = order[b.priority?.toLowerCase() as keyof typeof order] ?? 4;
        return oa - ob;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: list */}
      <div className={cn("flex flex-col border-r bg-background transition-all duration-300", selectedTicket ? "hidden md:flex md:w-2/5 lg:w-1/3" : "flex-1")}>

        {/* Stats */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Ticket, label: 'Total', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
              { icon: CheckCircle2, label: 'Enviados', value: stats.sentOk, color: 'text-green-500', bg: 'bg-green-500/10' },
              { icon: XCircle, label: 'Fallidos', value: stats.failed, color: 'text-red-500', bg: 'bg-red-500/10' },
              { icon: Clock, label: 'Hoy', value: stats.today, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="flex flex-col items-center p-2 rounded-xl border bg-card gap-1">
                <div className={cn('p-1.5 rounded-lg', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <span className="text-lg font-bold leading-none">{value}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 space-y-2 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="sent">✅ Notificados</SelectItem>
                <SelectItem value="failed">❌ Fallidos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">🔴 Alta</SelectItem>
                <SelectItem value="normal">🟡 Normal</SelectItem>
                <SelectItem value="low">🟢 Baja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">📅 Fecha</SelectItem>
                <SelectItem value="priority">🔥 Prioridad</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Actualizar
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} de {tickets.length} tickets
          </span>
          {tickets.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled={isClearing}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpiar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar todo el historial?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará todos los tickets del historial de forma permanente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearHistory()} className="bg-destructive text-destructive-foreground">
                    Eliminar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Ticket list */}
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Ticket className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium">No hay tickets</h3>
              <p className="text-sm text-muted-foreground mt-1">
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
                      "p-3 cursor-pointer transition-colors hover:bg-muted/60 group",
                      isSelected && "bg-primary/5 border-l-2 border-l-primary"
                    )}
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Status dot */}
                      <div className="mt-1 flex-shrink-0">
                        {ticket.notification_sent
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-red-400" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted-foreground">
                            #{ticket.ticket_number || ticket.ticket_id || '—'}
                          </span>
                          <Badge variant={pc.color} className="text-[10px] h-4 px-1.5">
                            {pc.label}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium leading-snug truncate">{ticket.subject}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {ticket.customer_name && (
                            <span className="flex items-center gap-0.5">
                              <User className="h-3 w-3" /> {ticket.customer_name}
                            </span>
                          )}
                          {ticket.department && (
                            <span className="flex items-center gap-0.5">
                              <Building2 className="h-3 w-3" /> {ticket.department}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(ticket.created_at), "d MMM HH:mm", { locale: es })}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                                onClick={(e) => handleResendQuick(ticket, e)}
                                disabled={resendingId === ticket.id}
                              >
                                {resendingId === ticket.id
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Send className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reenviar notificación rápida</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); setSelectedTicket(ticket); }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar y enviar mensaje</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform", isSelected && "text-primary rotate-0")} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: detail */}
      {selectedTicket && (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <TicketDetail
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onDelete={(id) => { deleteTicket(id); setSelectedTicket(null); }}
            isDeleting={isDeleting}
          />
        </div>
      )}

      {/* Empty state when no ticket selected on desktop */}
      {!selectedTicket && (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col text-center gap-4 text-muted-foreground bg-muted/20">
          <div className="p-6 rounded-2xl bg-background border shadow-sm">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium text-foreground">Selecciona un ticket</p>
            <p className="text-sm mt-1">Haz clic en un ticket para ver los detalles<br/>y editar el mensaje de WhatsApp</p>
          </div>
        </div>
      )}
    </div>
  );
}
