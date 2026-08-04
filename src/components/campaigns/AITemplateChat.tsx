import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Copy, Check, Eye, Code, Monitor, Smartphone } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [liveHtml, setLiveHtml] = useState(initialHtml || '');
  const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
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
      setLiveHtml(initialHtml);
      setMessages([
        { role: 'user', content: `Aquí tienes la plantilla actual que quiero editar:\n\n\`\`\`html\n${initialHtml}\n\`\`\`` },
        { role: 'assistant', content: 'He recibido tu plantilla actual. ¿Qué cambios quieres hacer? Puedo modificar colores, textos, estructura, añadir secciones, etc.' },
      ]);
    }
  }, [initialHtml, initialized]);

  // Extract and update live HTML whenever assistant messages change
  const updateLivePreview = useCallback((fullContent: string) => {
    const html = extractHtmlFromResponse(fullContent);
    if (html) {
      setLiveHtml(html);
    }
  }, []);

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
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
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
              const currentContent = assistantSoFar;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: currentContent } : m));
                }
                return [...prev, { role: 'assistant', content: currentContent }];
              });
              // Update live preview as HTML streams in
              updateLivePreview(currentContent);
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
              updateLivePreview(assistantSoFar);
            }
          } catch { /* ignore */ }
        }
      }

      // Final: apply to parent automatically
      if (assistantSoFar) {
        const finalHtml = extractHtmlFromResponse(assistantSoFar);
        if (finalHtml) {
          onApplyTemplate(finalHtml);
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al generar plantilla');
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

  const handleCopy = (idx: number, content: string) => {
    const html = extractHtmlFromResponse(content);
    navigator.clipboard.writeText(html || content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-0 overflow-hidden">
      {/* Left: Chat panel */}
      <div className="flex flex-col w-full lg:w-[400px] xl:w-[440px] border-r border-border shrink-0 h-full">
        {/* Chat header */}
        <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Asistente IA</span>
          <span className="text-xs text-muted-foreground ml-auto">Edición en tiempo real</span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1">Editor de Email con IA</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mb-4">
                Describe qué quieres y verás los cambios en tiempo real en la vista previa.
              </p>
              <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
                {[
                  'Email de bienvenida profesional',
                  'Newsletter con ofertas especiales',
                  'Email de seguimiento post-venta',
                  'Invitación a evento corporativo',
                ].map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs justify-start h-8"
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                  >
                    <Sparkles className="w-3 h-3 mr-1.5 text-primary shrink-0" />
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-lg p-2.5 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_pre]:hidden [&_code]:hidden">
                          <ReactMarkdown>
                            {msg.content.replace(/```html[\s\S]*?```/g, '✅ *HTML generado — visible en la vista previa →*')}
                          </ReactMarkdown>
                        </div>
                        {extractHtmlFromResponse(msg.content) && (
                          <div className="flex gap-1.5 mt-2 pt-2 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-[10px] h-6 px-2"
                              onClick={() => handleCopy(idx, msg.content)}
                            >
                              {copiedIdx === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copiedIdx === idx ? 'Copiado' : 'Copiar HTML'}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && !messages[messages.length - 1]?.content && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-2.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-2.5 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe los cambios que quieres..."
            rows={2}
            className="resize-none text-xs min-h-[60px]"
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-auto w-10"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-muted/10">
        {/* Preview toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-border bg-muted/30 gap-2">
          <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as any)}>
            <TabsList className="h-7">
              <TabsTrigger value="preview" className="text-[11px] h-6 px-2.5 gap-1">
                <Eye className="w-3 h-3" />
                Vista previa
              </TabsTrigger>
              <TabsTrigger value="code" className="text-[11px] h-6 px-2.5 gap-1">
                <Code className="w-3 h-3" />
                HTML
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-1">
            <Button
              variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewDevice('desktop')}
            >
              <Monitor className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewDevice('mobile')}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Preview content */}
        <ScrollArea className="flex-1">
          {previewMode === 'preview' ? (
            <div className="p-4 flex justify-center">
              {liveHtml ? (
                <div 
                  className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300 ${
                    previewDevice === 'mobile' ? 'w-[375px]' : 'w-full max-w-[600px]'
                  }`}
                  style={previewDevice === 'mobile' ? { 
                    border: '8px solid #1f2937', 
                    borderRadius: '24px',
                    padding: '0',
                  } : undefined}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(liveHtml) }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Eye className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">La vista previa aparecerá aquí</p>
                  <p className="text-xs mt-1">Escribe un mensaje para empezar</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <pre className="text-[11px] bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                {liveHtml || '<!-- El HTML aparecerá aquí cuando la IA genere la plantilla -->'}
              </pre>
            </div>
          )}
        </ScrollArea>

        {/* Status bar */}
        {isLoading && (
          <div className="border-t border-border px-3 py-1.5 flex items-center gap-2 bg-primary/5">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="text-[11px] text-primary font-medium">Generando cambios...</span>
          </div>
        )}
      </div>
    </div>
  );
}
