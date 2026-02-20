import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  X, 
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWhatsAppChats, WahaMessage } from '@/hooks/useWhatsAppChats';
import { EditContactModal } from './EditContactModal';
import { sendTextMessage, sendImageMessage } from '@/services/evolutionService';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WhatsAppChatProps {
  chatId: string;
  chatName: string;
  phone: string;
  onBack: () => void;
  avatarUrl?: string | null;
}

export function WhatsAppChat({ chatId, chatName, phone, onBack, avatarUrl }: WhatsAppChatProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { useMessagesForChat, updateChat, uploadAvatar, updateChatLastMessage } = useWhatsAppChats();
  const { data: messages = [], isLoading, refetch } = useMessagesForChat(chatId);
  
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [currentName, setCurrentName] = useState(chatName);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(messages.length);

  // Check if user is at bottom of scroll
  const checkIfAtBottom = useCallback(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const threshold = 100; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      setShowScrollButton(false);
    }, 50);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    isAtBottomRef.current = checkIfAtBottom();
    setShowScrollButton(!isAtBottomRef.current);
  }, [checkIfAtBottom]);

  // Setup scroll listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Smart scroll on new messages
  useEffect(() => {
    const hasNewMessages = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (hasNewMessages) {
      // Auto-scroll only if user was already at bottom
      if (isAtBottomRef.current) {
        scrollToBottom();
      } else {
        // Show notification button for new messages
        setShowScrollButton(true);
      }
    }
  }, [messages.length, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      scrollToBottom(false);
    }
  }, [chatId]); // Only on chat change

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const addImagesToQueue = (files: File[]) => {
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: máx. 10MB`); return; }
      setSelectedImages(prev => [...prev, file]);
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreviews(prev => [...prev, reader.result as string]); };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addImagesToQueue(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      addImagesToQueue(files);
    }
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() && selectedImages.length === 0) return;
    if (!user?.id) return;

    const messageContent = newMessage.trim();
    setIsSending(true);

    // Clear input immediately
    setNewMessage('');
    const savedImages = [...selectedImages];
    const savedPreviews = [...imagePreviews];
    setSelectedImages([]);
    setImagePreviews([]);

    try {
      if (savedImages.length > 0) {
        // Send each image
        for (let i = 0; i < savedImages.length; i++) {
          const base64Data = savedPreviews[i].split(',')[1];
          const wahaResponse = await sendImageMessage(chatId, base64Data, savedImages[i].type, savedImages[i].name, i === 0 ? messageContent : '');
          await supabase.from('waha_messages').insert({
            chat_id: chatId,
            content: i === 0 ? messageContent : '',
            from_me: true,
            user_id: user.id,
            timestamp: new Date().toISOString(),
            message_id: wahaResponse?.id || null,
            media_url: savedPreviews[i] || null,
            message_type: 'image',
            ack_status: 'sent',
          });
        }
      } else {
        const wahaResponse = await sendTextMessage(chatId, messageContent);
        await supabase.from('waha_messages').insert({
          chat_id: chatId,
          content: messageContent,
          from_me: true,
          user_id: user.id,
          timestamp: new Date().toISOString(),
          message_id: wahaResponse?.id || null,
          media_url: null,
          message_type: 'text',
          ack_status: 'sent',
        });
      }

      if (messageContent && savedImages.length > 0) {
        // If there were images AND text, the text was attached to first image
        // No extra text-only message needed
      }

      await updateChatLastMessage({ chatId });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Error al enviar el mensaje');
    } finally {
      setIsSending(false);
      setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      setNewMessage(prev => prev.slice(0, start) + '\n' + prev.slice(end));
      setTimeout(() => { target.selectionStart = target.selectionEnd = start + 1; }, 0);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSaveContact = async (name: string, avatarFile?: File) => {
    try {
      let newAvatarUrl = currentAvatarUrl;
      
      if (avatarFile) {
        newAvatarUrl = await uploadAvatar(chatId, avatarFile);
      }
      
      await updateChat({ 
        chatId, 
        customName: name, 
        avatarUrl: newAvatarUrl || undefined,
      });
      
      setCurrentName(name);
      if (newAvatarUrl) setCurrentAvatarUrl(newAvatarUrl);
    } catch (err) {
      throw err;
    }
  };

  const formatTime = (timestamp: Date) => {
    return format(timestamp, 'HH:mm');
  };

  const formatDateSeparator = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    return format(date, 'EEEE, d MMMM yyyy', { locale: es });
  };

  const getMessageDateKey = (date: Date) => {
    return format(date, 'yyyy-MM-dd');
  };

  const getAckIcon = (ackStatus: string | null) => {
    switch (ackStatus) {
      case 'pending':
        return <Clock className="h-3 w-3 opacity-70" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
      case 'played':
        return <CheckCheck className="h-3 w-3 text-primary/70" />;
      default:
        return null;
    }
  };

  const initials = (currentName || phone).slice(0, 2).toUpperCase();

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              {currentAvatarUrl ? (
                <AvatarImage src={currentAvatarUrl} alt={currentName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold text-base">{currentName}</h3>
              <p className="text-sm text-muted-foreground">+{phone}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar contacto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 flex flex-col relative">
          {/* Messages area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && !isLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No hay mensajes en esta conversación</p>
                  <p className="text-sm mt-2">Envía un mensaje para empezar</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const showDateSeparator = index === 0 || 
                    getMessageDateKey(message.timestamp) !== getMessageDateKey(messages[index - 1].timestamp);
                  
                  return (
                    <div key={message.id}>
                      {showDateSeparator && (
                        <div className="flex items-center justify-center my-4">
                          <span className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full shadow-sm">
                            {formatDateSeparator(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.fromMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          } ${message.isRevoked ? 'opacity-60 italic' : ''}`}
                        >
                          {message.mediaUrl && !message.isRevoked && (
                            <img
                              src={message.mediaUrl}
                              alt="Media"
                              className="max-w-full rounded mb-2"
                            />
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                            {message.isEdited && (
                              <span className="text-xs opacity-70 ml-1">(editado)</span>
                            )}
                          </p>
                          {message.reaction && (
                            <span className="text-lg">{message.reaction}</span>
                          )}
                          <div
                            className={`flex items-center justify-end gap-1 mt-1 ${
                              message.fromMe
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span className="text-xs">{formatTime(message.timestamp)}</span>
                            {message.fromMe && getAckIcon(message.ackStatus)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-24 right-6 rounded-full shadow-lg z-10"
              onClick={() => scrollToBottom()}
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Nuevos mensajes
            </Button>
          )}
          
          
          {/* Images preview */}
          {imagePreviews.length > 0 && (
            <div className="px-4 py-2 border-t flex flex-wrap gap-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={preview}
                    alt={`Preview ${idx + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border"
                  />
                  <button
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(idx)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Input area */}
          <div className="p-4 border-t">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Textarea
                ref={textareaRef}
                placeholder="Escribe un mensaje... (pega con Ctrl+V)"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                disabled={isSending}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                rows={1}
              />
              <Button
                className="shrink-0"
                onClick={sendMessage}
                disabled={isSending || (!newMessage.trim() && selectedImages.length === 0)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        chatId={chatId}
        phone={phone}
        currentName={currentName}
        currentAvatar={currentAvatarUrl || null}
        onSave={handleSaveContact}
      />
    </>
  );
}