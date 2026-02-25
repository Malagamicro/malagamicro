import { useState, useRef, useCallback, useEffect } from 'react';
import { sanitizeBasicHtml } from '@/lib/sanitize';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Ticket, Trash2, CheckCircle2, XCircle, RefreshCw, Search,
  AlertTriangle, Mail, User, Building2, Clock, Send, Loader2,
  MessageSquare, Phone, Copy, ExternalLink, ChevronRight,
  MoreHorizontal, Hash, Calendar, ArrowLeft, Zap,
  ChevronDown, ChevronUp, Smartphone, Image as ImageIcon,
  Paperclip, Upload, X, File, Eye, Bold, Italic, FileImage,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useOsTicketHistory, OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import { useTicketNotes } from '@/hooks/useTicketNotes';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/* ─── helpers ─── */
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
const getPriorityCfg = (p: string | null) => PRIORITY_CONFIG[p?.toLowerCase() ?? ''] ?? { label: p || 'Normal', color: 'outline' as const, dot: 'bg-muted-foreground' };

const VARIABLES = [
  { key: '{{ticket_id}}', label: 'ID' },
  { key: '{{number}}', label: 'Nº' },
  { key: '{{subject}}', label: 'Asunto' },
  { key: '{{name}}', label: 'Cliente' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{department}}', label: 'Depto.' },
  { key: '{{priority}}', label: 'Prioridad' },
  { key: '{{ticket_url}}', label: 'URL' },
];

const QUICK_PHRASES = [
  '✅ Hemos recibido tu ticket y lo estamos procesando.',
  '🔧 Un técnico se pondrá en contacto contigo en breve.',
  '📋 ¿Podrías darnos más información sobre el problema?',
  '🎉 Tu solicitud ha sido resuelta. ¡Que tengas un buen día!',
  '⏰ El tiempo estimado de resolución es de 24-48 horas.',
  '📞 Te llamaremos para coordinar la visita técnica.',
  '🔄 Estamos investigando el problema, te mantendremos informado.',
  '📧 Hemos escalado tu ticket al equipo correspondiente.',
];

interface AttachedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  isImage: boolean;
}

/* ─── File Upload Button ─── */
function FileUploadZone({
  onFileUploaded,
  accept,
  children,
  className,
}: {
  onFileUploaded: (file: AttachedFile) => void;
  accept?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split('.').pop();
      const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      setProgress(40);
      const { data, error } = await supabase.storage
        .from('ticket-files')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      setProgress(80);
      const { data: urlData } = supabase.storage.from('ticket-files').getPublicUrl(data.path);
      setProgress(100);
      onFileUploaded({
        id: Date.now().toString(),
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
        isImage: file.type.startsWith('image/'),
      });
      toast.success(`Archivo subido: ${file.name}`);
    } catch (err: any) {
      toast.error(`Error al subir: ${err.message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*,application/pdf,.txt'}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      <div onClick={() => !uploading && inputRef.current?.click()} className="cursor-pointer">
        {uploading ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Subiendo... {progress}%
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        ) : children}
      </div>
    </div>
  );
}

/* ─── WhatsApp Editor ─── */
function WhatsAppEditor({
  ticket,
  onSend,
  isSending,
}: {
  ticket: OsTicketRecord;
  onSend: (msg: string, imageUrl?: string, sendImage?: boolean, attachments?: AttachedFile[]) => void;
  isSending: boolean;
}) {
  const { config } = useOsTicketConfig();
  const ticketUrl = `${config?.osticket_url || ''}/scp/tickets.php?id=${ticket.ticket_id}`;
  const ticketHeader = `📋 *Ticket #${ticket.ticket_number || ticket.ticket_id || '—'}*\n📌 Asunto: ${ticket.subject}\n👤 Cliente: ${ticket.customer_name || '—'}\n📧 Email: ${parseEmail(ticket.customer_email) || '—'}\n🏢 Depto: ${ticket.department || '—'}\n⚡ Prioridad: ${ticket.priority || 'Normal'}\n🔗 Ver ticket: ${ticketUrl}\n───────────────\n`;

  const [message, setMessage] = useState(() => {
    const tmpl = config?.message_template || '';
    const body = tmpl
      .replace(/\{\{ticket_id\}\}/g, ticket.ticket_id || '')
      .replace(/\{\{number\}\}/g, ticket.ticket_number || '')
      .replace(/\{\{subject\}\}/g, ticket.subject || '')
      .replace(/\{\{name\}\}/g, ticket.customer_name || '')
      .replace(/\{\{email\}\}/g, parseEmail(ticket.customer_email))
      .replace(/\{\{department\}\}/g, ticket.department || '')
      .replace(/\{\{priority\}\}/g, ticket.priority || '')
      .replace(/\{\{ticket_url\}\}/g, `${config?.osticket_url || ''}/scp/tickets.php?id=${ticket.ticket_id}`);
    return ticketHeader + body;
  });
  const [headerImageUrl, setHeaderImageUrl] = useState(config?.image_url || '');
  const [sendImage, setSendImage] = useState(config?.send_image !== false);
  const [showVars, setShowVars] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) { setMessage(p => p + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setMessage(message.slice(0, start) + text + message.slice(end));
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + text.length, start + text.length); }, 0);
  }, [message]);

  const wrapSelection = useCallback((before: string, after: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = message.slice(start, end);
    const next = message.slice(0, start) + before + (sel || 'texto') + after + message.slice(end);
    setMessage(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(start + before.length, start + before.length + (sel || 'texto').length); }, 0);
  }, [message]);

  const handleHeaderImageUpload = async (file: File) => {
    setUploadingHeader(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `ticket-headers/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('ticket-files').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('ticket-files').getPublicUrl(data.path);
      setHeaderImageUrl(urlData.publicUrl);
      toast.success('Imagen de cabecera subida');
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setUploadingHeader(false);
    }
  };

  const removeAttachment = (id: string) => setAttachments(p => p.filter(a => a.id !== id));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 p-1.5 bg-muted/40 rounded-lg border flex-wrap">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 font-bold text-sm" onClick={() => wrapSelection('*', '*')}>
                <Bold className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Negrita (*texto*)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 italic text-sm" onClick={() => wrapSelection('_', '_')}>
                <Italic className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cursiva (_texto_)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-mono" onClick={() => wrapSelection('```', '```')}>
                &lt;/&gt;
              </Button>
            </TooltipTrigger>
            <TooltipContent>Código (```texto```)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-px h-5 bg-border mx-0.5" />

        {/* Frases rápidas */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              <Zap className="h-3 w-3" /> Frases
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {QUICK_PHRASES.map((p, i) => (
              <DropdownMenuItem key={i} onClick={() => insertAtCursor(p)} className="text-xs whitespace-normal leading-relaxed py-2">
                {p}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Variables */}
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setShowVars(!showVars)}>
          <Hash className="h-3 w-3" /> Variables
          {showVars ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        <div className="ml-auto flex items-center gap-0.5">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={previewMode ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => setPreviewMode(!previewMode)}>
                  {previewMode ? <Eye className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{previewMode ? 'Volver al editor' : 'Vista previa WhatsApp'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Variables chips */}
      {showVars && (
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/30 rounded-lg border">
          {VARIABLES.map((v) => (
            <button
              key={v.key}
              onClick={() => insertAtCursor(v.key)}
              title={v.key}
              className="px-2 py-0.5 bg-background hover:bg-primary hover:text-primary-foreground rounded text-xs font-mono transition-colors border border-border cursor-pointer"
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor / Preview */}
      {previewMode ? (
        <div className="bg-muted rounded-xl p-4 min-h-[200px] flex items-start justify-end">
          <div className="w-full max-w-[280px]">
            <div className="bg-green-100 dark:bg-green-900/40 rounded-2xl rounded-tr-sm p-3 shadow-sm space-y-2 border border-green-200 dark:border-green-800">
              {sendImage && headerImageUrl && (
                <div className="rounded-xl overflow-hidden -mx-3 -mt-3 mb-2">
                  <img src={headerImageUrl} alt="Cabecera" className="w-full h-28 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <pre className="text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed break-words">{message}</pre>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 rounded p-1.5">
                      <File className="h-3 w-3" /> {a.name}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">ahora ✓✓</span>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2">Vista previa con datos reales</p>
          </div>
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          className="font-mono text-sm resize-none"
          placeholder="Escribe el mensaje de WhatsApp..."
        />
      )}

      {/* ── Imagen de cabecera ── */}
      <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <FileImage className="h-4 w-4 text-muted-foreground" />
            Imagen de cabecera
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">{sendImage ? 'Con imagen' : 'Sin imagen'}</Label>
            <Switch checked={sendImage} onCheckedChange={setSendImage} />
          </div>
        </div>

        {sendImage && (
          <div className="space-y-2">
            <div className="flex gap-2 items-start">
              <Input
                value={headerImageUrl}
                onChange={(e) => setHeaderImageUrl(e.target.value)}
                placeholder="Pega una URL de imagen..."
                className="h-8 text-xs flex-1"
              />
              <input
                ref={headerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeaderImageUpload(f); e.target.value = ''; }}
              />
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline" size="sm" className="h-8 px-2.5 flex-shrink-0"
                      onClick={() => headerInputRef.current?.click()}
                      disabled={uploadingHeader}
                    >
                      {uploadingHeader ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Subir imagen desde tu ordenador</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {headerImageUrl && (
              <div className="relative w-full h-24 rounded-lg overflow-hidden border bg-muted">
                <img src={headerImageUrl} alt="Cabecera" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <button
                  className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-0.5 border"
                  onClick={() => setHeaderImageUrl('')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Adjuntos ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileUploadZone
            onFileUploaded={(f) => setAttachments(p => [...p, f])}
            accept="image/*,application/pdf,.txt"
            className="flex-1"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-muted/40 transition-colors text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4" />
              <span className="text-xs">Adjuntar archivo (imagen, PDF...)</span>
            </div>
          </FileUploadZone>
        </div>

        {/* Attached files list */}
        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border">
                {a.isImage ? (
                  <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded flex-shrink-0 bg-primary/10 flex items-center justify-center">
                    <File className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatSize(a.size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(a.url, '_blank')}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAttachment(a.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Send button ── */}
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={() => onSend(message, headerImageUrl, sendImage, attachments)}
        disabled={isSending || !message.trim()}
      >
        {isSending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
          : <><Send className="h-4 w-4" /> Enviar por WhatsApp</>
        }
      </Button>
    </div>
  );
}

/* ─── Ticket Notes Chat with @mentions ─── */
function TicketNotesChat({ ticketId }: { ticketId: string }) {
  const { notes, isLoading, isAdding, addNote, deleteNote } = useTicketNotes(ticketId);
  const { user } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [teamUsers, setTeamUsers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load team users for mentions
  useEffect(() => {
    supabase.from('profiles').select('user_id, full_name').then(({ data }) => {
      if (data) setTeamUsers(data);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes.length]);

  const handleNoteChange = (value: string) => {
    setNewNote(value);
    // Detect @ trigger
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const insertMention = (userName: string) => {
    const cursorPos = textareaRef.current?.selectionStart || newNote.length;
    const textBefore = newNote.slice(0, cursorPos);
    const textAfter = newNote.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const newText = textBefore.slice(0, atIndex) + `@${userName} ` + textAfter;
    setNewNote(newText);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const filteredMentions = teamUsers.filter(u =>
    (u.full_name || '').toLowerCase().includes(mentionQuery)
  );

  const handleSubmit = async () => {
    if (!newNote.trim()) return;
    await addNote(newNote);
    setNewNote('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (userId: string) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
      'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // Render note content with highlighted @mentions
  const renderNoteContent = (content: string) => {
    const parts = content.split(/(@\w+(?:\s\w+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return <span key={i} className="bg-primary/20 text-primary font-medium rounded px-0.5">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <h3 className="font-semibold text-sm">Notas internas del equipo</h3>
        <Badge variant="outline" className="text-[10px] ml-auto">{notes.length}</Badge>
      </div>

      {/* Notes thread */}
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto space-y-2 rounded-lg border bg-muted/20 p-2"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Sin notas. Usa @nombre para mencionar a alguien.
          </p>
        ) : (
          notes.map((note) => {
            const isOwn = note.user_id === user?.id;
            return (
              <div key={note.id} className={cn("flex gap-2 group", isOwn && "flex-row-reverse")}>
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarFallback className={cn("text-[10px] text-white", getAvatarColor(note.user_id))}>
                    {getInitials(note.user_name || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("max-w-[80%] space-y-0.5", isOwn && "items-end")}>
                  <div className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                    isOwn ? "bg-primary text-primary-foreground" : "bg-background border"
                  )}>
                    {!isOwn && <p className="font-semibold text-[10px] mb-0.5 opacity-70">{note.user_name}</p>}
                    <p className="whitespace-pre-wrap">{renderNoteContent(note.content)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(note.created_at), 'd MMM HH:mm', { locale: es })}
                    </span>
                    {isOwn && (
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="text-[9px] text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mentions dropdown */}
      {showMentions && filteredMentions.length > 0 && (
        <div className="rounded-lg border bg-popover shadow-md p-1 max-h-28 overflow-y-auto">
          {filteredMentions.map(u => (
            <button
              key={u.user_id}
              onClick={() => insertMention(u.full_name || 'usuario')}
              className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent flex items-center gap-2"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className={cn("text-[8px] text-white", getAvatarColor(u.user_id))}>
                  {getInitials(u.full_name || 'U')}
                </AvatarFallback>
              </Avatar>
              {u.full_name || 'Sin nombre'}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe una nota... usa @nombre para mencionar"
          className="text-xs min-h-[36px] max-h-20 resize-none flex-1"
          rows={1}
        />
        <Button
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={handleSubmit}
          disabled={isAdding || !newNote.trim()}
        >
          {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/* ─── Ticket Detail Panel ─── */
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
          {/* Info grid */}
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

          {/* Message body */}
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

          {/* Timestamp */}
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

          {/* Internal Team Notes */}
          <TicketNotesChat ticketId={ticket.ticket_id || ticket.id} />

          <Separator />

          {/* Close ticket button */}
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

          {/* Collapsible WhatsApp Editor */}
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

/* ─── Main Panel ─── */
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
                      {/* Quick actions shown on hover */}
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
