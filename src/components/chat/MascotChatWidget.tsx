import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import mascotImage from '@/assets/mascot.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mascot-chat`;

export function MascotChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const scrollToBottom = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;

    viewport.scrollTop = viewport.scrollHeight;
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

    let assistantContent = '';

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: requestMessages }),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        let friendly = 'Error al conectar con Micro';
        try {
          const parsed = JSON.parse(errorText);
          if (typeof parsed?.error === 'string') friendly = parsed.error;
          else if (typeof parsed?.message === 'string') friendly = parsed.message;
        } catch {
          // ignore
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: friendly }]);
        setIsLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add assistant message placeholder
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const updated = [...prev];
                // Update the last assistant message
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                }
                return [...updated, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {
            // Partial JSON; ignore until next chunk
          }
        }
      }
    } catch (error) {
      console.error('Mascot chat error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        const fallback =
          '¡Ups! Parece que tuve un pequeño cortocircuito 🤖⚡ Intenta de nuevo en un momento.';

        if (updated[updated.length - 1]?.role === 'assistant') {
          updated[updated.length - 1] = { role: 'assistant', content: fallback };
          return updated;
        }

        return [...updated, { role: 'assistant', content: fallback }];
      });
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
          'flex items-center justify-center'
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
          'flex items-center justify-center'
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsMinimized(true)}
        >
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

      {/* Messages */}
      <div ref={scrollRootRef} className="flex-1">
        <ScrollArea className="h-full p-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-20 h-20 mx-auto">
                <img src={mascotImage} alt="Micro" className="w-full h-full object-contain" />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">¡Hola! Soy Micro 🤖</h4>
                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                  Tu asistente de MalagaMicro. ¿En qué puedo ayudarte hoy?
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {['Tips de ventas', 'Productividad', 'Motivación'].map((tip) => (
                  <button
                    key={tip}
                    onClick={() => {
                      setInput(`Dame consejos de ${tip.toLowerCase()}`);
                      inputRef.current?.focus();
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20"
                  >
                    {tip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
                        <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-card border flex items-center justify-center">
                    <img src={mascotImage} alt="Micro" className="w-6 h-6 object-contain" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                    <Loader2 className="h-4 w-4" />
                  </div>
                </div>
              )}
            </div>
          )}
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
            {isLoading ? (
              <Loader2 className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
