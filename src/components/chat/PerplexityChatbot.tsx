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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Sparkles,
  Zap,
  Brain,
  RotateCcw,
  BarChart3,
  Plus,
  Search,
  Bell,
  MessageSquare,
  Trash2,
  MoreVertical,
  PanelLeftClose,
  PanelLeft,
  Pencil,
  FileIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAIChatHistory, AIChatSession, AIChatMessage } from '@/hooks/useAIChatHistory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const MODELS = [
  { 
    id: 'gpt-oss-120b', 
    name: 'GPT-OSS 120B', 
    description: 'IA avanzada con acceso total',
    icon: Brain,
    color: 'text-emerald-500',
  },
];

const QUICK_ACTIONS = [
  { icon: BarChart3, label: 'Estadísticas', prompt: '¿Cuáles son mis estadísticas de leads?' },
  { icon: Search, label: 'Buscar leads', prompt: 'Busca mis leads más recientes' },
  { icon: Plus, label: 'Crear lead', prompt: 'Quiero crear un nuevo lead' },
  { icon: Bell, label: 'Recordatorios', prompt: '¿Qué recordatorios tengo pendientes?' },
  { icon: MessageSquare, label: 'WhatsApp', prompt: 'Muéstrame mis chats de WhatsApp recientes' },
  { icon: FileIcon, label: 'Archivos', prompt: '¿Qué archivos tengo guardados?' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-chat`;

export function PerplexityChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-oss-120b');
  // Hide sidebar by default on mobile
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth >= 768);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const {
    sessions,
    isLoadingSessions,
    useSessionMessages,
    createSession,
    updateSessionTitle,
    deleteSession,
    addMessage,
    generateTitle,
  } = useAIChatHistory();

  // Load messages when session changes
  const { data: sessionMessages } = useSessionMessages(activeSessionId);

  // Sync messages from DB to local state when session changes
  useEffect(() => {
    if (sessionMessages) {
      setMessages(sessionMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
      })));
    } else if (!activeSessionId) {
      setMessages([]);
    }
  }, [sessionMessages, activeSessionId]);

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

  const streamChat = async (userMessages: { role: string; content: string }[], sessionId: string) => {
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

    // Save assistant message to DB
    if (assistantContent) {
      await addMessage.mutateAsync({
        sessionId,
        role: 'assistant',
        content: assistantContent,
      });
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

    let sessionId = activeSessionId;

    // Create new session if none active
    if (!sessionId) {
      const newSession = await createSession.mutateAsync({ 
        title: generateTitle(messageText),
        model: selectedModel,
      });
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

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

    // Save user message to DB
    await addMessage.mutateAsync({
      sessionId,
      role: 'user',
      content: messageText,
    });

    try {
      await streamChat(newMessages.map(m => ({ role: m.role, content: m.content })), sessionId);
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

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  const handleSelectSession = (session: AIChatSession) => {
    setActiveSessionId(session.id);
    setSelectedModel(session.model);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession.mutateAsync(sessionId);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  const handleStartEditTitle = (session: AIChatSession) => {
    setEditingTitle(session.id);
    setEditTitleValue(session.title);
  };

  const handleSaveTitle = async () => {
    if (editingTitle && editTitleValue.trim()) {
      await updateSessionTitle.mutateAsync({
        sessionId: editingTitle,
        title: editTitleValue.trim(),
      });
    }
    setEditingTitle(null);
  };

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel)!;

  const formatSessionDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return format(date, 'EEEE', { locale: es });
    return format(date, 'dd/MM/yyyy');
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] bg-gradient-to-b from-background to-muted/20 rounded-2xl border shadow-xl overflow-hidden relative">
      {/* Sessions Sidebar - overlay on mobile */}
      {showSidebar && (
        <div className="absolute md:relative z-20 w-64 h-full border-r bg-background md:bg-muted/30 flex flex-col shadow-xl md:shadow-none">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversaciones
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNewChat}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            {isLoadingSessions ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Cargando...
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No hay conversaciones
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative rounded-lg p-2 cursor-pointer transition-colors ${
                      activeSessionId === session.id 
                        ? 'bg-accent' 
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleSelectSession(session)}
                  >
                    {editingTitle === session.id ? (
                      <Input
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitle();
                          if (e.key === 'Escape') setEditingTitle(null);
                        }}
                        className="h-6 text-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate pr-8">
                          {session.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatSessionDate(session.updatedAt)}
                        </p>
                      </>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEditTitle(session)}>
                          <Pencil className="h-3 w-3 mr-2" />
                          Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteSession(session.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Overlay backdrop on mobile when sidebar is open */}
      {showSidebar && (
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <div className="relative hidden md:block">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                <Bot className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
            </div>
            <div>
              <h2 className="font-semibold text-base md:text-lg">Asistente CRM</h2>
              <p className="text-xs text-muted-foreground hidden md:block">Conectado con tus datos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[100px] md:w-[140px] h-8 md:h-9 bg-muted/50 border-0">
                <div className="flex items-center gap-1 md:gap-2">
                  <selectedModelInfo.icon className={`h-3 w-3 md:h-4 md:w-4 ${selectedModelInfo.color}`} />
                  <span className="text-xs md:text-sm truncate">{selectedModelInfo.name}</span>
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
                onClick={handleNewChat}
                className="h-9 w-9"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <ScrollArea className="flex-1 px-3 md:px-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-8 md:py-12">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 md:mb-6">
                <Sparkles className="h-7 w-7 md:h-10 md:w-10 text-primary" />
              </div>
              <h3 className="font-semibold text-lg md:text-xl mb-2 text-center">¿En qué puedo ayudarte?</h3>
              <p className="text-muted-foreground text-center text-sm md:text-base max-w-md mb-6 md:mb-8 px-4">
                Puedo buscar leads, crear nuevos, ver estadísticas, recordatorios y más. 
              </p>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2 md:gap-3 w-full max-w-md px-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="flex items-center gap-2 md:gap-3 p-3 md:p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left group"
                  >
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                      <action.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <span className="text-xs md:text-sm font-medium">{action.label}</span>
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
    </div>
  );
}
