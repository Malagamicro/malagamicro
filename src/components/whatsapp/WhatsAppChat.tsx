import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  X, 
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWhatsAppChats, WahaMessage } from '@/hooks/useWhatsAppChats';
import { EditContactModal } from './EditContactModal';
import { sendTextMessage, sendImageMessage } from '@/services/wahaService';
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
  const { useMessagesForChat, updateChat, uploadAvatar, getOrCreateChat, updateChatLastMessage } = useWhatsAppChats();
  const { data: messages = [], isLoading, refetch } = useMessagesForChat(chatId);
  
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [currentName, setCurrentName] = useState(chatName);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('La imagen no puede superar 5MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
    if (!user?.id) return;

    const messageContent = newMessage.trim();
    setIsSending(true);
    
    // Optimistic update - add message immediately
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: WahaMessage = {
      id: optimisticId,
      chatId,
      content: messageContent,
      fromMe: true,
      timestamp: new Date(),
      leadId: null,
      userId: user.id,
      messageId: null,
      mediaUrl: imagePreview,
      messageType: selectedImage ? 'image' : 'text',
      ackStatus: 'pending',
      reaction: null,
      isRevoked: false,
      isEdited: false,
      replyToId: null,
      createdAt: new Date(),
    };

    // Clear input immediately for better UX
    setNewMessage('');
    const savedImage = selectedImage;
    const savedPreview = imagePreview;
    removeImage();

    try {
      let wahaResponse;
      
      if (savedImage && savedPreview) {
        const base64Data = savedPreview.split(',')[1];
        wahaResponse = await sendImageMessage(chatId, base64Data, savedImage.type, savedImage.name, messageContent);
      } else {
        wahaResponse = await sendTextMessage(chatId, messageContent);
      }

      // Save to database
      await supabase.from('waha_messages').insert({
        chat_id: chatId,
        content: messageContent,
        from_me: true,
        user_id: user.id,
        timestamp: new Date().toISOString(),
        message_id: wahaResponse?.id || null,
        media_url: savedPreview || null,
        message_type: savedImage ? 'image' : 'text',
        ack_status: 'sent',
      });

      // Update chat last message
      await updateChatLastMessage({ chatId });

      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // Refetch to get server confirmation
      setTimeout(() => refetch(), 500);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Error al enviar el mensaje');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const getAckIcon = (ackStatus: string | null) => {
    switch (ackStatus) {
      case 'pending':
        return <Clock className="h-3 w-3 opacity-70" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-sky-400" />;
      case 'played':
        return <CheckCheck className="h-3 w-3 text-sky-400" />;
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
        
        <CardContent className="flex-1 p-0 flex flex-col">
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.length === 0 && !isLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No hay mensajes en esta conversación</p>
                  <p className="text-sm mt-2">Envía un mensaje para empezar</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
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
                ))
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
          
          {/* Image preview */}
          {imagePreview && (
            <div className="px-4 py-2 border-t">
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 rounded-lg object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Input area */}
          <div className="p-4 border-t">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
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
                placeholder="Escribe un mensaje..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isSending}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                rows={1}
              />
              <Button
                className="shrink-0"
                onClick={sendMessage}
                disabled={isSending || (!newMessage.trim() && !selectedImage)}
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