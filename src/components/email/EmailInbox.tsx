import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RefreshCw, Search, Star, StarOff, Trash2, Mail, MailOpen, Paperclip,
  ChevronLeft, ExternalLink, Building2, Calculator, Loader2, FileText,
  Image, File, Download, Reply, Forward, MoreHorizontal
} from 'lucide-react';
import { useEmailMessages, EmailMessage, EmailAttachment } from '@/hooks/useEmailMessages';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { useProviders } from '@/hooks/useProviders';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
  const isImage = attachment.file_type?.startsWith('image/');
  const isPdf = attachment.file_type?.includes('pdf');

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

export function EmailInbox() {
  const { profiles } = useEmailProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
  const {
    messages, loading, syncing, selectedMessage, attachments,
    filter, searchQuery, setFilter, setSearchQuery,
    selectMessage, setSelectedMessage, syncInbox,
    markAsUnread, toggleStar, deleteMessage, linkToProvider, linkToBudget,
    unreadCount,
  } = useEmailMessages(selectedProfileId === 'all' ? undefined : selectedProfileId);
  const { providers } = useProviders();

  const matchedProvider = selectedMessage
    ? providers.find(p => p.email.toLowerCase() === selectedMessage.from_address.toLowerCase())
    : null;

  if (selectedMessage) {
    return (
      <div className="h-full flex flex-col">
        {/* Message detail header */}
        <div className="flex items-center gap-2 p-4 border-b">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={() => toggleStar(selectedMessage.id)}>
            {selectedMessage.is_starred ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => markAsUnread(selectedMessage.id)}>
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { deleteMessage(selectedMessage.id); }}>
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
                <DropdownMenuItem disabled>
                  <Building2 className="h-4 w-4 mr-2" />Sin proveedor coincidente
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
            <div>
              <h1 className="text-xl font-semibold">{selectedMessage.subject || '(Sin asunto)'}</h1>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedMessage.from_name || selectedMessage.from_address}</span>
                <span>&lt;{selectedMessage.from_address}&gt;</span>
                <span className="ml-auto">{format(new Date(selectedMessage.date), "d MMM yyyy HH:mm", { locale: es })}</span>
              </div>
              {matchedProvider && (
                <Badge variant="outline" className="mt-2">
                  <Building2 className="h-3 w-3 mr-1" />{matchedProvider.nombre}
                </Badge>
              )}
              {!matchedProvider && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Remitente no encontrado en proveedores — ¿Crear ficha nueva?
                </p>
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
                <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: selectedMessage.body_html }} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{selectedMessage.body_text || '(Sin contenido)'}</pre>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

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
              return (
                <button
                  key={msg.id}
                  onClick={() => selectMessage(msg)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left ${!msg.is_read ? 'bg-primary/5 font-medium' : ''}`}
                >
                  <button onClick={e => { e.stopPropagation(); toggleStar(msg.id); }} className="flex-shrink-0">
                    {msg.is_starred ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4 text-muted-foreground hover:text-yellow-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold' : ''}`}>
                        {msg.from_name || msg.from_address}
                      </span>
                      {providerMatch && <Badge variant="outline" className="text-[10px] px-1.5 py-0"><Building2 className="h-2.5 w-2.5 mr-0.5" />{providerMatch.nombre}</Badge>}
                      {msg.has_attachments && <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    </div>
                    <p className="text-sm truncate text-foreground">{msg.subject || '(Sin asunto)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{msg.body_text?.slice(0, 100)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {format(new Date(msg.date), 'd MMM', { locale: es })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
