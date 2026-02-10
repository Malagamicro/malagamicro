import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AITemplateChatProps {
  onApplyTemplate: (html: string, subject?: string) => void;
  initialHtml?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-email-template`;

function extractHtmlFromResponse(text: string): string | null {
  const match = text.match(/```html\s*([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

export function AITemplateChat({ onApplyTemplate, initialHtml }: AITemplateChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load initial HTML as context when editing existing template
  useEffect(() => {
    if (initialHtml && !initialized) {
      setInitialized(true);
      setMessages([
        { role: 'user', content: `Aquí tienes la plantilla actual que quiero editar:\n\n\`\`\`html\n${initialHtml}\n\`\`\`` },
        { role: 'assistant', content: 'He recibido tu plantilla actual. ¿Qué cambios quieres hacer? Puedo modificar colores, textos, estructura, añadir secciones, etc.' },
      ]);
    }
  }, [initialHtml, initialized]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al conectar con IA');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al generar plantilla');
      // Remove user message if no response
      if (!assistantSoFar) {
        setMessages(prev => prev.slice(0, -1));
      }
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

  const handleApplyHtml = (messageContent: string) => {
    const html = extractHtmlFromResponse(messageContent);
    if (html) {
      onApplyTemplate(html);
      toast.success('Plantilla HTML aplicada');
    } else {
      toast.error('No se encontró HTML en esta respuesta');
    }
  };

  const handleCopy = (idx: number, content: string) => {
    const html = extractHtmlFromResponse(content);
    navigator.clipboard.writeText(html || content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Sparkles className="w-10 h-10 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-1">Asistente de Plantillas</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Descríbeme qué tipo de email quieres crear y te generaré una plantilla HTML profesional.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                'Email de bienvenida para nuevos clientes',
                'Newsletter mensual con ofertas',
                'Email de seguimiento post-venta',
              ].map(suggestion => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setInput(suggestion);
                    textareaRef.current?.focus();
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {extractHtmlFromResponse(msg.content) && (
                        <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5 text-xs"
                            onClick={() => handleApplyHtml(msg.content)}
                          >
                            <Sparkles className="w-3 h-3" />
                            Usar esta plantilla
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 text-xs"
                            onClick={() => handleCopy(idx, msg.content)}
                          >
                            {copiedIdx === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedIdx === idx ? 'Copiado' : 'Copiar HTML'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && !messages[messages.length - 1]?.content && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe el email que quieres crear..."
          rows={2}
          className="resize-none text-sm"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-auto"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
