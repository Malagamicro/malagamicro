import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  Zap,
  Brain,
  RotateCcw,
  Users,
  BarChart3,
  Plus,
  Search,
  Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MODELS = [
  { 
    id: 'sonar', 
    name: 'Sonar', 
    description: 'Rápido y eficiente',
    icon: Zap,
    color: 'text-amber-500',
  },
  { 
    id: 'sonar-pro', 
    name: 'Sonar Pro', 
    description: 'Más citas y detalle',
    icon: Sparkles,
    color: 'text-purple-500',
  },
  { 
    id: 'sonar-reasoning-pro', 
    name: 'Reasoning Pro', 
    description: 'Razonamiento avanzado',
    icon: Brain,
    color: 'text-blue-500',
  },
];

const QUICK_ACTIONS = [
  { icon: BarChart3, label: 'Ver estadísticas', prompt: '¿Cuáles son mis estadísticas de leads?' },
  { icon: Search, label: 'Buscar leads', prompt: 'Busca mis leads más recientes' },
  { icon: Plus, label: 'Crear lead', prompt: 'Quiero crear un nuevo lead' },
  { icon: Bell, label: 'Recordatorios', prompt: '¿Qué recordatorios tengo pendientes?' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-chat`;

export function PerplexityChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('sonar-pro');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const streamChat = async (userMessages: { role: string; content: string }[]) => {
    const token = await getAuthToken();
    
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages: userMessages,
        model: selectedModel,
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Error: ${resp.status}`);
    }

    if (!resp.body) throw new Error('No response body');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantContent = '';
    const assistantId = crypto.randomUUID();

    // Add empty assistant message
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    while (true) {
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
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: assistantContent } : m
            ));
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Invalidate queries if lead was created/updated
    if (assistantContent.toLowerCase().includes('creado') || 
        assistantContent.toLowerCase().includes('actualizado')) {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const messageText = customPrompt || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = { 
      id: crypto.randomUUID(),
      role: 'user', 
      content: messageText,
      timestamp: new Date(),
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      await streamChat(newMessages.map(m => ({ role: m.role, content: m.content })));
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al enviar mensaje');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel)!;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-gradient-to-b from-background to-muted/20 rounded-2xl border shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Asistente CRM</h2>
            <p className="text-xs text-muted-foreground">Conectado con tus datos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] h-9 bg-muted/50 border-0">
              <div className="flex items-center gap-2">
                <selectedModelInfo.icon className={`h-4 w-4 ${selectedModelInfo.color}`} />
                <span className="text-sm">{selectedModelInfo.name}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {MODELS.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-3">
                    <model.icon className={`h-4 w-4 ${model.color}`} />
                    <div>
                      <p className="font-medium">{model.name}</p>
                      <p className="text-xs text-muted-foreground">{model.description}</p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="h-9 w-9"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-semibold text-xl mb-2">¿En qué puedo ayudarte?</h3>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Puedo buscar leads, crear nuevos, ver estadísticas, recordatorios y más. 
              Estoy conectado con todos tus datos del CRM.
            </p>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSend(action.prompt)}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <Avatar className={`h-9 w-9 ${message.role === 'user' ? 'bg-primary' : 'bg-gradient-to-br from-primary to-primary/60'}`}>
                  <AvatarFallback className="bg-transparent">
                    {message.role === 'user' ? (
                      <User className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    )}
                  </AvatarFallback>
                </Avatar>
                
                <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-md'
                        : 'bg-muted rounded-tl-md'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      message.content ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Pensando...</span>
                        </div>
                      )
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">
                    {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={isLoading}
              className="pr-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>
          <Button 
            onClick={() => handleSend()} 
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Powered by Perplexity • Modelo: {selectedModelInfo.name}
        </p>
      </div>
    </div>
  );
}
