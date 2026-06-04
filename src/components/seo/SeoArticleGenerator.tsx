import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2, Send, Bot, User, FlaskConical, ImageIcon, Video } from 'lucide-react';
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
  onGenerate: (
    topic: string,
    imageCount: number,
    generateVideo: boolean,
    videoDuration: number,
    webhookUrl?: string
  ) => Promise<unknown>;
  generating: boolean;
}

export const SeoArticleGenerator = ({ onGenerate, generating }: SeoArticleGeneratorProps) => {
  const [input, setInput] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [imageCount, setImageCount] = useState(3);
  const [generateVideo, setGenerateVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(6);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! 👋 Soy tu asistente de generación SEO. Dime sobre qué tema quieres que genere un artículo optimizado y me pondré a trabajar.\n\nPuedo crear artículos con:\n- 🔍 Investigación web en vivo (Gemini 3.5 Flash)\n- 🖼️ Imágenes generadas por IA (Gemini 3.1)\n- 📹 Video descriptivo por IA (Veo 3.1 Fast)',
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
      content: `${topic} (${imageCount} imágenes${generateVideo ? `, video de ${videoDuration}s` : ''})`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add processing message
    const processingMsg: ChatMessage = {
      id: `processing-${Date.now()}`,
      role: 'assistant',
      content: `⏳ Iniciando la generación del artículo sobre **"${topic}"** con ${imageCount} imágenes${generateVideo ? ` y video de ${videoDuration}s con google/veo-3.1-fast` : ''}...\n\nEl sistema lo procesará en segundo plano. Podrás seguir el avance desde el listado de resultados.`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, processingMsg]);

    const url = testMode ? TEST_URL : PRODUCTION_URL;
    const result = await onGenerate(topic, imageCount, generateVideo, videoDuration, url);

    if (result) {
      const successMsg: ChatMessage = {
        id: `success-${Date.now()}`,
        role: 'assistant',
        content: `✅ ¡Procesando artículo sobre **"${topic}"**!\n\nGemini 3.5 Flash está investigando la web en tiempo real para redactar el artículo. Las imágenes y el video se generarán de manera consecutiva.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, successMsg]);
    } else {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Hubo un error al intentar iniciar la generación para **"${topic}"**. Inténtalo de nuevo.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    inputRef.current?.focus();
  };

  return (
    <Card className="border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 flex flex-col h-[70vh] min-h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Asistente SEO Directo</p>
            <p className="text-[10px] text-muted-foreground">Genera artículos con Gemini y Veo</p>
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
                  Procesando generación en el servidor...
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Configuration Options */}
      <div className="px-4 py-3 border-t bg-muted/20 space-y-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-primary" />
              Imágenes del artículo (Gemini 3.1)
            </span>
            <span className="text-primary font-bold font-mono">{imageCount}</span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            value={imageCount}
            onChange={(e) => setImageCount(parseInt(e.target.value))}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            disabled={generating}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-2 mt-1">
          <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-primary" />
            Generar Video (Veo 3.1 Fast)
          </span>
          <Switch
            checked={generateVideo}
            onCheckedChange={setGenerateVideo}
            disabled={generating}
            className="scale-90"
          />
        </div>

        {generateVideo && (
          <div className="flex flex-col gap-2 pl-4 border-l border-primary/30 animate-fade-in">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Duración del video</span>
              <span className="text-primary font-bold font-mono">{videoDuration} segundos</span>
            </div>
            <div className="flex gap-1.5">
              {[4, 6, 8].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setVideoDuration(duration)}
                  disabled={generating}
                  className={`flex-1 py-1 px-2 text-xs font-medium rounded border transition-all ${
                    videoDuration === duration
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-secondary text-muted-foreground border-muted'
                  }`}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Ej: Tendencias de IA en Málaga en 2026..."
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
