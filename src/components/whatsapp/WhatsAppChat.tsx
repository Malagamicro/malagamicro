import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Send, RefreshCw, Image, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  hasMedia: boolean;
  mediaUrl?: string;
}

interface WhatsAppChatProps {
  chatId: string;
  chatName: string;
  phone: string;
  onBack: () => void;
}

export function WhatsAppChat({ chatId, chatName, phone, onBack }: WhatsAppChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch(
        `http://localhost:3000/api/default/chats/${chatId}/messages?limit=100&downloadMedia=true`,
        {
          headers: {
            'X-Api-Key': '123456',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Error al obtener los mensajes');
      }
      
      const data = await response.json();
      console.log('Mensajes recibidos:', data);
      
      const transformedMessages: Message[] = data.map((msg: any) => ({
        id: msg.id || msg._id || Math.random().toString(),
        body: msg.body || msg.text || '',
        timestamp: msg.timestamp || Date.now() / 1000,
        fromMe: msg.fromMe || false,
        hasMedia: msg.hasMedia || false,
        mediaUrl: msg.media?.url || msg.mediaUrl || null,
      })).sort((a: Message, b: Message) => a.timestamp - b.timestamp);
      
      setMessages(transformedMessages);
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Error fetching messages:', err);
      toast.error('Error al cargar los mensajes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [chatId]);

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
    
    setIsSending(true);
    
    try {
      let endpoint = 'http://localhost:3000/api/sendText';
      let payload: any = {
        chatId,
        text: newMessage,
        session: 'default',
      };
      
      if (selectedImage && imagePreview) {
        endpoint = 'http://localhost:3000/api/sendImage';
        const base64Data = imagePreview.split(',')[1];
        const mimetype = selectedImage.type;
        
        payload = {
          chatId,
          file: {
            mimetype,
            filename: selectedImage.name,
            data: base64Data,
          },
          caption: newMessage,
          session: 'default',
        };
      }
      
      console.log('Enviando mensaje:', { endpoint, payload });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': '123456',
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar el mensaje');
      }
      
      // Clear input and refresh messages
      setNewMessage('');
      removeImage();
      toast.success('Mensaje enviado');
      
      // Add message optimistically
      const newMsg: Message = {
        id: Date.now().toString(),
        body: newMessage,
        timestamp: Date.now() / 1000,
        fromMe: true,
        hasMedia: !!selectedImage,
        mediaUrl: imagePreview || undefined,
      };
      setMessages(prev => [...prev, newMsg]);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // Refresh to get server confirmation
      setTimeout(fetchMessages, 1000);
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

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'HH:mm');
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {chatName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-base">{chatName}</CardTitle>
            <p className="text-sm text-muted-foreground">+{phone}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMessages}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col">
        {/* Messages area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && !isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                No hay mensajes en esta conversación
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
                    }`}
                  >
                    {message.hasMedia && message.mediaUrl && (
                      <img
                        src={message.mediaUrl}
                        alt="Media"
                        className="max-w-full rounded mb-2"
                      />
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.body}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        message.fromMe
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
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
          <div className="flex items-center gap-2">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Image className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSending}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={isSending || (!newMessage.trim() && !selectedImage)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
