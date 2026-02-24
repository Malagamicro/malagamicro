import { useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  RefreshCw, Search, Star, StarOff, Trash2, Mail, MailOpen, Paperclip,
  ChevronLeft, ExternalLink, Building2, Calculator, Loader2, FileText,
  Image, File, Download, Reply, Forward, MoreHorizontal, UserPlus,
  MessageSquare, Clock, AtSign, Users
} from 'lucide-react';
import { useEmailMessages, EmailMessage, EmailAttachment } from '@/hooks/useEmailMessages';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { useProviders } from '@/hooks/useProviders';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ComposeData } from './EmailModule';

function getAttachmentIcon(fileType: string | null) {
  if (!fileType) return <File className="h-5 w-5" />;
  if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
  if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileText className="h-5 w-5 text-green-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function AttachmentPreview({ attachment }: { attachment: EmailAttachment }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
      {getAttachmentIcon(attachment.file_type)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.file_size)}</p>
      </div>
      <Button variant="ghost" size="icon" asChild>
        <a href={attachment.file_path || '#'} download={attachment.file_name} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}

interface EmailInboxProps {
  onCompose?: (data: ComposeData) => void;
}

export function EmailInbox({ onCompose }: EmailInboxProps) {
  const { user } = useAuth();
  const { profiles } = useEmailProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const {
    messages, loading, syncing, selectedMessage, attachments,
    filter, searchQuery, setFilter, setSearchQuery,
    selectMessage, setSelectedMessage, syncInbox,
    markAsUnread, toggleStar, deleteMessage, linkToProvider, linkToBudget,
    unreadCount, allMessages,
  } = useEmailMessages(selectedProfileId === 'all' ? undefined : selectedProfileId);
  const { providers, createProvider } = useProviders();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState('');
  const [addingProvider, setAddingProvider] = useState(false);

  const matchedProvider = selectedMessage
    ? providers.find(p => p.email.toLowerCase() === selectedMessage.from_address.toLowerCase())
    : null;

  // Detect conversation thread - messages with same subject (Re:/Fwd: stripped)
  const getThreadMessages = (msg: EmailMessage) => {
    if (!msg.subject) return [];
    const baseSubject = msg.subject.replace(/^(Re:|Fwd:|RV:|RE:|FW:)\s*/gi, '').trim().toLowerCase();
    return allMessages
      .filter(m => m.id !== msg.id && m.subject && m.subject.replace(/^(Re:|Fwd:|RV:|RE:|FW:)\s*/gi, '').trim().toLowerCase() === baseSubject)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const threadMessages = selectedMessage ? getThreadMessages(selectedMessage) : [];

  const handleReply = () => {
    if (!selectedMessage || !onCompose) return;
    const replyTo = selectedMessage.from_address;
    const originalDate = format(new Date(selectedMessage.date), "d MMM yyyy HH:mm", { locale: es });
    const originalFrom = selectedMessage.from_name || selectedMessage.from_address;
    
    onCompose({
      mode: 'reply',
      to: replyTo,
      subject: selectedMessage.subject?.startsWith('Re:') ? selectedMessage.subject : `Re: ${selectedMessage.subject || ''}`,
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 4px; color: #666;">
        <p>El ${originalDate}, ${originalFrom} escribió:</p>
        ${selectedMessage.body_html || `<pre>${selectedMessage.body_text || ''}</pre>`}
      </div>`,
      inReplyTo: selectedMessage.message_id_header || undefined,
      originalMessage: selectedMessage,
    });
  };

  const handleForward = () => {
    if (!selectedMessage || !onCompose) return;
    const originalDate = format(new Date(selectedMessage.date), "d MMM yyyy HH:mm", { locale: es });
    const originalFrom = selectedMessage.from_name || selectedMessage.from_address;

    onCompose({
      mode: 'forward',
      subject: selectedMessage.subject?.startsWith('Fwd:') ? selectedMessage.subject : `Fwd: ${selectedMessage.subject || ''}`,
      bodyHtml: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 4px; color: #666;">
        <p>---------- Mensaje reenviado ----------</p>
        <p>De: ${originalFrom} &lt;${selectedMessage.from_address}&gt;</p>
        <p>Fecha: ${originalDate}</p>
        <p>Asunto: ${selectedMessage.subject || '(Sin asunto)'}</p>
        <br>
        ${selectedMessage.body_html || `<pre>${selectedMessage.body_text || ''}</pre>`}
      </div>`,
      originalMessage: selectedMessage,
    });
  };

  const handleDeleteConfirm = () => {
    if (messageToDelete) {
      deleteMessage(messageToDelete);
      setDeleteConfirmOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleAddToProviders = async () => {
    if (!selectedMessage || !user || !newProviderName.trim()) return;
    setAddingProvider(true);
    try {
      await createProvider({
        nombre: newProviderName.trim(),
        email: selectedMessage.from_address,
        especialidad: [],
        activo: true,
      } as any);
      toast.success(`Proveedor "${newProviderName}" creado con email ${selectedMessage.from_address}`);
      setAddProviderOpen(false);
      setNewProviderName('');
    } catch (err: any) {
      toast.error('Error al crear proveedor: ' + err.message);
    } finally {
      setAddingProvider(false);
    }
  };

  const formatToAddresses = (toAddresses: any) => {
    if (!toAddresses) return '';
    if (typeof toAddresses === 'string') return toAddresses;
    if (Array.isArray(toAddresses)) return toAddresses.join(', ');
    return JSON.stringify(toAddresses);
  };

  // ========== DETAIL VIEW ==========
  if (selectedMessage) {
    const profileName = profiles.find(p => p.id === selectedMessage.profile_id)?.profile_name;

    return (
      <div className="h-full flex flex-col">
        {/* Header with actions */}
        <div className="flex items-center gap-2 p-4 border-b flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div className="flex-1" />

          {/* Primary actions */}
          <Button variant="outline" size="sm" onClick={handleReply} className="gap-1.5">
            <Reply className="h-4 w-4" /> Responder
          </Button>
          <Button variant="outline" size="sm" onClick={handleForward} className="gap-1.5">
            <Forward className="h-4 w-4" /> Reenviar
          </Button>

          <Button variant="ghost" size="icon" onClick={() => toggleStar(selectedMessage.id)}>
            {selectedMessage.is_starred ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => markAsUnread(selectedMessage.id)}>
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setMessageToDelete(selectedMessage.id); setDeleteConfirmOpen(true); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {matchedProvider ? (
                <DropdownMenuItem onClick={() => linkToProvider(selectedMessage.id, matchedProvider.id)}>
                  <Building2 className="h-4 w-4 mr-2" />Vincular a {matchedProvider.nombre}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => { setNewProviderName(selectedMessage.from_name || ''); setAddProviderOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-2" />Añadir remitente a proveedores
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled>
                <Calculator className="h-4 w-4 mr-2" />Vincular a presupuesto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Message content */}
        <ScrollArea className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Subject */}
            <h1 className="text-xl font-semibold">{selectedMessage.subject || '(Sin asunto)'}</h1>

            {/* Detailed info card */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <AtSign className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{selectedMessage.from_name || selectedMessage.from_address}</span>
                  <span className="text-muted-foreground ml-1">&lt;{selectedMessage.from_address}&gt;</span>
                </div>
                {matchedProvider && (
                  <Badge variant="outline" className="flex-shrink-0">
                    <Building2 className="h-3 w-3 mr-1" />{matchedProvider.nombre}
                  </Badge>
                )}
                {!matchedProvider && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { setNewProviderName(selectedMessage.from_name || ''); setAddProviderOpen(true); }}>
                    <UserPlus className="h-3 w-3" /> Añadir
                  </Button>
                )}
              </div>

              {selectedMessage.to_addresses && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">Para: </span>
                    <span>{formatToAddresses(selectedMessage.to_addresses)}</span>
                  </div>
                </div>
              )}

              {selectedMessage.cc_addresses && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="text-muted-foreground">CC: </span>
                    <span>{formatToAddresses(selectedMessage.cc_addresses)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{format(new Date(selectedMessage.date), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
              </div>

              {profileName && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Perfil: </span>
                  <span>{profileName}</span>
                </div>
              )}

              {threadMessages.length > 0 && (
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Conversación: </span>
                  <Badge variant="secondary" className="text-xs">{threadMessages.length + 1} mensajes</Badge>
                </div>
              )}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1"><Paperclip className="h-4 w-4" /> {attachments.length} adjunto{attachments.length > 1 ? 's' : ''}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map(att => <AttachmentPreview key={att.id} attachment={att} />)}
                </div>
              </div>
            )}

            {/* Body */}
            <div className="border-t pt-4">
              {selectedMessage.body_html ? (
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.body_html) }} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{selectedMessage.body_text || '(Sin contenido)'}</pre>
              )}
            </div>

            {/* Thread / conversation history */}
            {threadMessages.length > 0 && (
              <div className="space-y-3 pt-4">
                <Separator />
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Conversación ({threadMessages.length} mensaje{threadMessages.length > 1 ? 's' : ''} anterior{threadMessages.length > 1 ? 'es' : ''})
                </h3>
                {threadMessages.map(tm => (
                  <button
                    key={tm.id}
                    onClick={() => selectMessage(tm)}
                    className="w-full text-left p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{tm.from_name || tm.from_address}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(tm.date), "d MMM HH:mm", { locale: es })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tm.body_text?.slice(0, 150)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={setDeleteConfirmOpen}
          title="Eliminar correo"
          description="¿Estás seguro de que quieres eliminar este correo? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          variant="destructive"
          onConfirm={handleDeleteConfirm}
        />

        {/* Add to providers dialog */}
        <Dialog open={addProviderOpen} onOpenChange={setAddProviderOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Añadir remitente a proveedores</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={selectedMessage?.from_address || ''} disabled className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre del proveedor</Label>
                <Input value={newProviderName} onChange={e => setNewProviderName(e.target.value)} placeholder="Nombre de la empresa" className="h-9" />
              </div>
              <Button onClick={handleAddToProviders} disabled={addingProvider || !newProviderName.trim()} className="w-full">
                {addingProvider ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Crear proveedor
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b flex-wrap">
        <Button variant="outline" size="sm" onClick={() => syncInbox()} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
        <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos los perfiles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los perfiles</SelectItem>
            {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.profile_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar correos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="unread">No leídos {unreadCount > 0 && `(${unreadCount})`}</TabsTrigger>
            <TabsTrigger value="starred">Destacados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Message list */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mb-4 opacity-50" />
            <p className="font-medium">No hay correos</p>
            <p className="text-sm">Sincroniza tu bandeja para ver los correos</p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map(msg => {
              const providerMatch = providers.find(p => p.email.toLowerCase() === msg.from_address.toLowerCase());
              // Check if part of a thread
              const baseSubject = msg.subject?.replace(/^(Re:|Fwd:|RV:|RE:|FW:)\s*/gi, '').trim().toLowerCase();
              const isThread = baseSubject && allMessages.filter(m => m.id !== msg.id && m.subject?.replace(/^(Re:|Fwd:|RV:|RE:|FW:)\s*/gi, '').trim().toLowerCase() === baseSubject).length > 0;

              return (
                <div key={msg.id} className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors ${!msg.is_read ? 'bg-primary/5' : ''}`}>
                  <button onClick={e => { e.stopPropagation(); toggleStar(msg.id); }} className="flex-shrink-0">
                    {msg.is_starred ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4 text-muted-foreground hover:text-yellow-400" />}
                  </button>
                  <button onClick={() => selectMessage(msg)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold' : ''}`}>
                        {msg.from_name || msg.from_address}
                      </span>
                      {providerMatch && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Building2 className="h-2.5 w-2.5 mr-0.5" />{providerMatch.nombre}</Badge>}
                      {isThread && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><MessageSquare className="h-2.5 w-2.5 mr-0.5" />Hilo</Badge>}
                      {msg.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <p className="text-sm truncate text-foreground">{msg.subject || '(Sin asunto)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{msg.body_text?.slice(0, 100)}</p>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(msg.date), 'd MMM', { locale: es })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setMessageToDelete(msg.id); setDeleteConfirmOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar correo"
        description="¿Estás seguro de que quieres eliminar este correo? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
