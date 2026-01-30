import { useState, useRef, useEffect } from 'react';
import { Send, FileText, Loader2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const N8N_WEBHOOK_URL = 'https://n8n.srv1304274.hstgr.cloud/webhook-test/crear-presupuesto';

export function BudgetChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de presupuestos. Cuéntame qué necesitas cotizar y me encargaré de enviar la solicitud al proveedor adecuado.\n\n**Ejemplo:** "Necesito 10 SSDs de 1TB Samsung para el cliente TechStore Málaga"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const callN8nWebhook = async (prompt: string) => {
    // n8n test webhook in your setup is currently registered for GET.
    // We try POST first (as per API spec), then fall back to GET if n8n returns the known 404 message.
    const trimmed = prompt.trim();

    const tryPost = async () => {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      });
      return res;
    };

    const tryGet = async () => {
      const url = `${N8N_WEBHOOK_URL}?prompt=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, { method: 'GET' });
      return res;
    };

    let res: Response;
    try {
      res = await tryPost();
    } catch {
      // Network/CORS/etc. — try GET as a fallback as well
      res = await tryGet();
    }

    if (!res.ok) {
      let bodyText = '';
      try {
        bodyText = await res.text();
      } catch {
        bodyText = '';
      }

      // Known n8n error when webhook is only registered for GET
      const looksLikeMethodMismatch =
        res.status === 404 &&
        bodyText.toLowerCase().includes('not registered for post') &&
        bodyText.toLowerCase().includes('get request');

      if (looksLikeMethodMismatch) {
        const getRes = await tryGet();
        if (!getRes.ok) {
          const t = await getRes.text().catch(() => '');
          throw new Error(`n8n error ${getRes.status}: ${t || 'No response body'}`);
        }
        return getRes;
      }

      throw new Error(`n8n error ${res.status}: ${bodyText || 'No response body'}`);
    }

    return res;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await callN8nWebhook(userMessage.content);

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      
      // Handle the response from n8n - support multiple response formats
      let assistantContent = '';
      
      if (data.output) {
        // If n8n sends an 'output' field
        assistantContent = data.output;
      } else if (data.response) {
        // If n8n sends a 'response' field
        assistantContent = data.response;
      } else if (data.message) {
        // If n8n sends a 'message' field
        assistantContent = data.message;
      } else if (data.mensaje) {
        // If n8n sends a 'mensaje' field (Spanish)
        assistantContent = data.mensaje;
      } else if (typeof data === 'string') {
        // If n8n sends a plain string
        assistantContent = data;
      } else {
        // Fallback: stringify the entire response
        assistantContent = JSON.stringify(data, null, 2);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      toast({
        title: 'Error de conexión',
        description: error instanceof Error ? error.message : 'No se pudo conectar con el servicio de presupuestos.',
        variant: 'destructive',
      });

      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Lo siento, hubo un problema al conectar con el servicio. Por favor, verifica que el flujo de n8n esté activo e inténtalo de nuevo.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Asistente de Presupuestos</h2>
          <p className="text-sm text-muted-foreground">Conectado a n8n para automatización</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-lg px-4 py-3 max-w-[80%]",
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <p className={cn(
                  "text-xs mt-2",
                  message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Procesando solicitud...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe qué necesitas cotizar..."
            disabled={isLoading}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
          <Button 
            onClick={sendMessage} 
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}
