import { useState, useRef, useCallback } from 'react';
import {
  Ticket, Send, Loader2, Hash, Zap,
  ChevronDown, ChevronUp, Smartphone, Upload, X, File, Eye,
  Bold, Italic, FileImage, Paperclip, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import type { OsTicketRecord } from '@/hooks/useOsTicketHistory';
import { FileUploadZone } from './FileUploadZone';
import { parseEmail, VARIABLES, QUICK_PHRASES, formatSize, type AttachedFile } from './osticketHelpers';

export function WhatsAppEditor({
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
      .replace(/\{\{ticket_url\}\}/g, ticketUrl);
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

        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setMessage(ticketHeader + (config?.message_template || ''))}>
                <Ticket className="h-3 w-3" /> Plantilla
              </Button>
            </TooltipTrigger>
            <TooltipContent>Insertar plantilla con datos del ticket</TooltipContent>
          </Tooltip>
        </TooltipProvider>

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
