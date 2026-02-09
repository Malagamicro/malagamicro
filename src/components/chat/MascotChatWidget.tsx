import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import mascotImage from '@/assets/mascot.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function MascotChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const scrollToBottom = useCallback(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const requestMessages = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('mascot-chat', {
        body: { messages: requestMessages },
      });

      if (error) throw error;

      const content = data?.response || data?.error || 'Sin respuesta';
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    } catch (error) {
      console.error('Mascot chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '¡Ups! Parece que tuve un pequeño cortocircuito 🤖⚡ Intenta de nuevo.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  // Floating mascot button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50 group',
          'w-16 h-16 rounded-full shadow-2xl',
          'bg-card border border-primary/20',
          'flex items-center justify-center',
          'hover:scale-105 transition-transform'
        )}
        aria-label="Abrir chat con Micro"
      >
        <img src={mascotImage} alt="Micro" className="w-14 h-14 object-contain" />
        <span className="absolute -top-2 -right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium shadow">
          ¡Hola!
        </span>
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'w-14 h-14 rounded-full shadow-xl',
          'bg-primary text-primary-foreground',
          'flex items-center justify-center',
          'hover:scale-105 transition-transform'
        )}
      >
        <img src={mascotImage} alt="Micro" className="w-12 h-12 object-contain" />
      </button>
    );
  }

  // Full chat widget
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50',
        'w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)]',
        'bg-background rounded-2xl shadow-2xl border',
        'flex flex-col overflow-hidden'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center border shadow-sm">
          <img src={mascotImage} alt="Micro" className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Micro</h3>
          <p className="text-xs text-muted-foreground">Asistente virtual 🤖</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(true)}>
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            setIsOpen(false);
            setMessages([]);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages with proper scroll */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={scrollViewportRef} className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 mx-auto">
                  <img src={mascotImage} alt="Micro" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">¡Hola! Soy Micro 🤖</h4>
                  <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                    Tu asistente de MalagaMicro. Puedo enviar mensajes internos y ver archivos compartidos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {['Ver archivos', 'Ver usuarios', 'Ayuda'].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => {
                        setInput(tip === 'Ayuda' ? '¿Qué puedes hacer?' : tip);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      {tip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex gap-2',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
                        <img src={mascotImage} alt="Micro" className="w-6 h-6 object-contain" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        message.content
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
                      <img src={mascotImage} alt="Micro" className="w-6 h-6 object-contain" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            disabled={isLoading}
            className="flex-1 rounded-full bg-background"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="rounded-full"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
