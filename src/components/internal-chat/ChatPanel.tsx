import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Send, Paperclip, Loader2, FileText, Download, MoreVertical,
  Users, Mic, Square, Phone, Video, Pencil, Trash2, LogOut, X, Check,
  Settings,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Conversation, InternalMessage } from '@/hooks/useInternalChat';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { BudgetApprovalMessage } from './BudgetApprovalMessage';
import { EmojiStickerPicker } from './EmojiStickerPicker';
import { VideoCallModal } from './VideoCallModal';
import { useActiveCalls } from '@/hooks/useActiveCalls';

interface ChatPanelProps {
  conversation: Conversation | null;
  messages: InternalMessage[];
  isLoading: boolean;
  onSendMessage: (content?: string, file?: { url: string; name: string; size: number }) => void;
  onUploadFile: (file: File) => Promise<{ url: string; name: string; size: number }>;
  isSending: boolean;
  hideHeader?: boolean;
  onLeaveConversation?: (conversationId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onUpdateGroup?: (conversationId: string, name: string) => void;
  onRemoveParticipant?: (conversationId: string, userId: string) => void;
}

export function ChatPanel({
  conversation, messages, isLoading, onSendMessage, onUploadFile,
  isSending, hideHeader = false,
  onLeaveConversation, onEditMessage, onDeleteMessage, onUpdateGroup, onRemoveParticipant,
}: ChatPanelProps) {
  const { user } = useAuth();
  const { initiateCall } = useActiveCalls();
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callStream, setCallStream] = useState<MediaStream | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const isAdmin = conversation?.participants?.find(p => p.user_id === user?.id)?.is_admin || 
                  conversation?.created_by === user?.id;

  const handleStopAndSendAudio = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingAudio(false);
  }, []);

  const handleStartAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsUploading(true);
        try {
          const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
          const uploaded = await onUploadFile(file);
          onSendMessage(undefined, { ...uploaded, messageType: 'audio' } as any);
        } catch (error) {
          toast.error('Error al enviar audio');
        } finally {
          setIsUploading(false);
        }
      };

      recorder.start(250);
      setIsRecordingAudio(true);
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') handleStopAndSendAudio();
      }, 60000);
    } catch {
      toast.error('No se pudo acceder al micrófono');
    }
  }, [onUploadFile, onSendMessage, handleStopAndSendAudio]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo es demasiado grande (máx. 10MB)'); return; }
    setIsUploading(true);
    try {
      const uploaded = await onUploadFile(file);
      const messageType = file.type.startsWith('image/') ? 'image' : 'file';
      onSendMessage(undefined, { ...uploaded, messageType } as any);
    } catch { toast.error('Error al subir archivo'); }
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const getConversationName = () => {
    if (!conversation) return '';
    if (conversation.name) return conversation.name;
    if (conversation.is_group) return 'Grupo';
    const other = conversation.participants?.find(p => p.user_id !== user?.id);
    return other?.profile?.full_name || 'Usuario';
  };

  const getAvatarUrl = () => {
    if (!conversation || conversation.is_group) return null;
    const other = conversation.participants?.find(p => p.user_id !== user?.id);
    return other?.profile?.avatar_url;
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const startCall = async (video: boolean) => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    } catch {
      toast.error(video ? 'No se pudo acceder a cámara y micrófono.' : 'No se pudo acceder al micrófono.');
      return;
    }
    setIsVideoCall(video);
    setCallStream(stream);
    setCallModalOpen(true);
    if (conversation) {
      const callerName = user?.email?.split('@')[0] || 'Usuario';
      await initiateCall(conversation.id, callerName, callRoomName, video);
    }
  };

  const handleLeave = () => {
    if (!conversation) return;
    if (onLeaveConversation) {
      onLeaveConversation(conversation.id);
    }
  };

  const startEditing = (msg: InternalMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content || '');
  };

  const confirmEdit = () => {
    if (editingMessageId && onEditMessage && editingContent.trim()) {
      onEditMessage(editingMessageId, editingContent.trim());
    }
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDeleteMsg = (msgId: string) => {
    if (onDeleteMessage) onDeleteMessage(msgId);
  };

  const handleSaveGroupSettings = () => {
    if (conversation && onUpdateGroup && groupName.trim()) {
      onUpdateGroup(conversation.id, groupName.trim());
      setGroupSettingsOpen(false);
    }
  };

  const callRoomName = conversation?.id?.replace(/-/g, '') || 'room';

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 text-muted-foreground">
        <Users className="h-16 w-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium mb-1">Selecciona una conversación</h3>
        <p className="text-sm">O inicia una nueva para empezar a chatear</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {getAvatarUrl() && <AvatarImage src={getAvatarUrl()!} />}
              <AvatarFallback className={conversation.is_group ? 'bg-primary/20' : ''}>
                {conversation.is_group ? <Users className="h-4 w-4 text-primary" /> : getInitials(getConversationName())}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium">{getConversationName()}</h3>
              {conversation.is_group && (
                <p className="text-xs text-muted-foreground">
                  {conversation.participants?.length || 0} participantes
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => startCall(false)} title="Llamada de voz">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => startCall(true)} title="Videollamada">
              <Video className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {conversation.is_group && isAdmin && (
                  <DropdownMenuItem onClick={() => { setGroupName(conversation.name || ''); setGroupSettingsOpen(true); }}>
                    <Settings className="h-4 w-4 mr-2" /> Configurar grupo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setParticipantsOpen(true)}>
                  <Users className="h-4 w-4 mr-2" /> Ver participantes
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLeave}>
                  <LogOut className="h-4 w-4 mr-2" /> Salir de la conversación
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 px-2 sm:px-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p className="text-sm">No hay mensajes aún</p>
            <p className="text-xs">Envía el primero 👋</p>
          </div>
        ) : (
          <div className="py-3 sm:py-4 space-y-3 sm:space-y-4">
            {messages.map((message, idx) => {
              const isMe = message.sender_id === user?.id;
              const showAvatar = !isMe && (idx === 0 || messages[idx - 1]?.sender_id !== message.sender_id);
              const isEditing = editingMessageId === message.id;

              return (
                <div key={message.id} className={cn('flex gap-2 group', isMe && 'flex-row-reverse')}>
                  {!isMe && (
                    <div className="w-6 sm:w-8 shrink-0">
                      {showAvatar && (
                        <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                          {message.sender?.avatar_url && <AvatarImage src={message.sender.avatar_url} />}
                          <AvatarFallback className="text-[10px] sm:text-xs">
                            {getInitials(message.sender?.full_name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )}

                  <div className={cn('max-w-[88%] sm:max-w-[70%] relative', isMe && 'text-right')}>
                    {showAvatar && !isMe && (
                      <p className="text-xs text-muted-foreground mb-1 ml-1">{message.sender?.full_name}</p>
                    )}

                    {/* Message actions (hover) */}
                    {isMe && !message.is_deleted && !isEditing && (
                      <div className={cn(
                        'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-0.5',
                        isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'
                      )}>
                        {message.message_type === 'text' && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditing(message)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteMsg(message.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {message.message_type === 'budget_approval' ? (
                      (() => {
                        try {
                          const approvalData = JSON.parse(message.content || '{}');
                          return <BudgetApprovalMessage data={approvalData} messageId={message.id} />;
                        } catch { return <p className="text-sm text-destructive">Error al cargar aprobación</p>; }
                      })()
                    ) : (
                      <div className={cn(
                        'inline-block rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2',
                        isMe ? 'bg-primary text-primary-foreground rounded-tr-md' : 'bg-muted rounded-tl-md'
                      )}>
                        {message.is_deleted ? (
                          <p className="text-sm italic opacity-70">Mensaje eliminado</p>
                        ) : isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingMessageId(null); }}
                              className="h-7 text-sm min-w-[150px] bg-background text-foreground"
                              autoFocus
                            />
                            <Button size="icon" className="h-6 w-6" onClick={confirmEdit}><Check className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMessageId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : message.message_type === 'image' ? (
                          <a href={message.file_url!} target="_blank" rel="noopener noreferrer" className="block">
                            <img src={message.file_url!} alt={message.file_name || 'Imagen'} className="max-w-full max-h-64 rounded-lg" />
                          </a>
                        ) : message.message_type === 'audio' ? (
                          <div className="flex items-center gap-2 py-1">
                            <audio controls src={message.file_url!} className="max-w-[200px] h-8" preload="metadata" />
                          </div>
                        ) : message.message_type === 'file' ? (
                          <button
                            onClick={() => window.open(message.file_url!, '_blank')}
                            className={cn('flex items-center gap-2 py-1 hover:opacity-80 transition-opacity', isMe ? 'text-primary-foreground' : 'text-foreground')}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-sm truncate max-w-[150px]">{message.file_name}</span>
                            <Download className="h-4 w-4" />
                          </button>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    )}
                    <p className={cn('text-[10px] text-muted-foreground mt-1', isMe ? 'mr-1' : 'ml-1')}>
                      {format(new Date(message.created_at), 'HH:mm', { locale: es })}
                      {message.is_edited && ' (editado)'}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 sm:p-4 border-t bg-card">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Button
            variant={isRecordingAudio ? "destructive" : "ghost"}
            size="icon" className="h-9 w-9 shrink-0 hidden sm:inline-flex"
            onClick={isRecordingAudio ? handleStopAndSendAudio : handleStartAudioRecording}
            disabled={isUploading}
          >
            {isRecordingAudio ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <div className="hidden sm:block">
            <EmojiStickerPicker onSelect={(emoji) => setInput(prev => prev + emoji)} />
          </div>
          <Input
            value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isRecordingAudio ? "🎙️ Grabando..." : "Mensaje..."}
            disabled={isSending || isRecordingAudio} className="flex-1 min-w-0 h-9 text-sm"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isSending || isRecordingAudio} size="icon" className="h-9 w-9 shrink-0">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Group Settings Dialog */}
      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar grupo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del grupo</label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nombre del grupo" />
            </div>
            {conversation?.participants && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Participantes ({conversation.participants.length})</label>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {conversation.participants.map(p => (
                    <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          {p.profile?.avatar_url && <AvatarImage src={p.profile.avatar_url} />}
                          <AvatarFallback className="text-[10px]">
                            {(p.profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{p.profile?.full_name || 'Usuario'}</span>
                        {p.is_admin && <Badge variant="secondary" className="text-[10px] h-4">Admin</Badge>}
                      </div>
                      {isAdmin && p.user_id !== user?.id && onRemoveParticipant && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                          onClick={() => onRemoveParticipant(conversation.id, p.user_id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupSettingsOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveGroupSettings}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participants Dialog */}
      <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Participantes ({conversation?.participants?.length || 0})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-auto">
            {conversation?.participants?.map(p => (
              <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {p.profile?.avatar_url && <AvatarImage src={p.profile.avatar_url} />}
                    <AvatarFallback className="text-xs">
                      {(p.profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm font-medium">{p.profile?.full_name || 'Usuario'}</span>
                    {p.user_id === conversation?.created_by && (
                      <Badge variant="secondary" className="ml-2 text-[10px] h-4">Creador</Badge>
                    )}
                    {p.is_admin && p.user_id !== conversation?.created_by && (
                      <Badge variant="outline" className="ml-2 text-[10px] h-4">Admin</Badge>
                    )}
                  </div>
                </div>
                {isAdmin && p.user_id !== user?.id && onRemoveParticipant && (
                  <Button
                    variant="ghost" size="sm" className="h-7 text-destructive text-xs"
                    onClick={() => { onRemoveParticipant(conversation!.id, p.user_id); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <VideoCallModal
        open={callModalOpen}
        onClose={() => { setCallModalOpen(false); setCallStream(null); }}
        roomName={callRoomName}
        displayName={user?.email?.split('@')[0] || 'Usuario'}
        isVideoCall={isVideoCall}
        isReceiver={false}
        initialStream={callStream}
      />
    </div>
  );
}
