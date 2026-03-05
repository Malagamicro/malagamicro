import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, Send, Bot, User, FlaskConical, ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const PRODUCTION_URL = 'https://n8n.malagamicro.com/webhook/generate-seo-article';
const TEST_URL = 'https://n8n.malagamicro.com/webhook-test/generate-seo-article';
const TEST_MODE_KEY = 'seo-generator-test-mode';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  articleData?: {
    title?: string;
    slug?: string;
    keywords?: string[];
    imageUrls?: string[];
  };
}

interface SeoArticleGeneratorProps {
  onGenerate: (topic: string, imageCount: number, webhookUrl?: string) => Promise<unknown>;
  generating: boolean;
}

export const SeoArticleGenerator = ({ onGenerate, generating }: SeoArticleGeneratorProps) => {
  const [input, setInput] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! 👋 Soy tu asistente de generación SEO. Dime sobre qué tema quieres que genere un artículo optimizado y me pondré a trabajar.\n\nPuedo crear artículos con:\n- 🔍 Investigación web automática\n- 🖼️ Imágenes generadas por IA\n- 📊 Optimización SEO completa',
      timestamp: new Date(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTestMode(localStorage.getItem(TEST_MODE_KEY) === 'true');
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggleTest = (checked: boolean) => {
    setTestMode(checked);
    localStorage.setItem(TEST_MODE_KEY, String(checked));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || generating) return;

    const topic = input.trim();
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: topic,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add processing message
    const processingMsg: ChatMessage = {
      id: `processing-${Date.now()}`,
      role: 'assistant',
      content: `⏳ Generando artículo sobre **"${topic}"**...\n\nEsto puede tardar 1-2 minutos. Recibirás el artículo automáticamente cuando esté listo.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, processingMsg]);

    const url = testMode ? TEST_URL : PRODUCTION_URL;
    const result = await onGenerate(topic, 1, url);

    if (result) {
      const successMsg: ChatMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: `✅ ¡Artículo sobre **"${topic}"** enviado a generar!\n\nCuando n8n termine el procesamiento, aparecerá automáticamente en la lista de artículos. Puedes seguir pidiendo más artículos mientras tanto.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMsg]);
    } else {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Hubo un error al intentar generar el artículo sobre **"${topic}"**. Por favor, inténtalo de nuevo.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    inputRef.current?.focus();
  };

  return (
    <Card className="border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 flex flex-col h-[60vh] min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Asistente SEO</p>
            <p className="text-[10px] text-muted-foreground">Genera artículos optimizados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="test-mode-chat" className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <FlaskConical className="h-3 w-3" />
            Test
          </Label>
          <Switch id="test-mode-chat" checked={testMode} onCheckedChange={handleToggleTest} className="scale-75" />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-4 py-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>p+p]:mt-2 [&>ul]:mt-1 [&>ul]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {generating && (
            <div className="flex gap-2.5">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Procesando...
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Info badge */}
      <div className="px-4 pb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5">
          <ImageIcon className="h-3 w-3 shrink-0" />
          1 imagen IA incluida por artículo
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ej: Mejores prácticas de IA en 2026..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={generating}
            className="h-10 text-sm"
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 shrink-0 shadow-md shadow-primary/20"
            disabled={!input.trim() || generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};
