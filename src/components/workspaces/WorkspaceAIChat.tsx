import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Send, Loader2, Sparkles, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface WorkspaceAIChatProps {
  workspaceId: string;
  pages: Array<{ id: string; title: string; content: string; page_type: string }>;
  open: boolean;
  onClose: () => void;
}

const AI_MODELS = [
  { value: 'openrouter/hunter-alpha', label: 'Hunter Alpha (default)' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export function WorkspaceAIChat({ workspaceId, pages, open, onClose }: WorkspaceAIChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('openrouter/hunter-alpha');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildContext = () => {
    const pagesContext = pages
      .filter(p => p.content && !p.content.startsWith('data:image'))
      .map(p => `## ${p.title} (${p.page_type})\n${p.content}`)
      .join('\n\n---\n\n');
    return `Eres un asistente IA integrado en un espacio de trabajo colaborativo. Tienes acceso al contenido de todas las páginas del espacio. Usa esta información para responder preguntas del usuario de forma precisa y útil.\n\n### Contenido del espacio de trabajo:\n\n${pagesContext || '(Sin contenido aún)'}`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('workspace-ai-chat', {
        body: {
          messages: newMessages,
          model,
          systemPrompt: buildContext(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.content || 'Sin respuesta' }]);
    } catch (err: any) {
      console.error('AI Chat error:', err);
      toast.error('Error al consultar la IA');
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error al procesar tu mensaje. Inténtalo de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="w-80 border-l border-border/50 flex flex-col bg-card animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground flex-1">Chat IA</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Model selector */}
      <div className="px-3 py-2 border-b border-border/30">
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_MODELS.map(m => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <Sparkles className="h-8 w-8 text-primary/40" />
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Pregúntame sobre el contenido de tus páginas, ideas, o pide ayuda para organizar tu espacio
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/50">
        <div className="flex gap-1.5">
          <Input
            placeholder="Pregunta algo..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            className="h-8 text-xs flex-1"
            disabled={loading}
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
