import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Send, Bot, User, Loader2, Sparkles, Brain, RotateCcw, Plus,
  MessageSquare, Trash2, MoreVertical, PanelLeftClose, Mic,
  MicOff, PanelLeft, Pencil, X, Paperclip, Image, FileText,
  Settings2, Zap, ImageIcon, AudioLines, Users, GripVertical,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAIChatHistory, AIChatSession, AIChatMessage } from '@/hooks/useAIChatHistory';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAISubagents, AISubagent } from '@/hooks/useAISubagents';
import { SubagentManager } from './SubagentManager';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ImperativePanelHandle } from 'react-resizable-panels';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
  subagent?: string; // which subagent responded
  subagentEmoji?: string;
  subagentColor?: string;
  isImage?: boolean; // if this is an image response
  imageUrls?: string[];
  isAudio?: boolean;
  audioUrl?: string;
  isDelegationNotice?: boolean; // delegation notice message
}

interface FileAttachment {
  name: string;
  type: string;
  size: number;
  content?: string;
  url?: string;
}

const MODELS = [
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', icon: Brain, color: 'text-emerald-500' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', icon: Sparkles, color: 'text-blue-500' },
  { id: 'openai/gpt-5', name: 'GPT-5', icon: Sparkles, color: 'text-violet-500' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini Flash', icon: Zap, color: 'text-amber-500' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini Pro', icon: Brain, color: 'text-indigo-500' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet', icon: Brain, color: 'text-orange-500' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', icon: Sparkles, color: 'text-cyan-500' },
  { id: 'custom', name: 'Personalizado', icon: Pencil, color: 'text-muted-foreground' },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perplexity-chat`;

export function PerplexityChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-5-nano');
  const [customModelId, setCustomModelId] = useState('');
  const [activeSubagent, setActiveSubagent] = useState<string | null>(null);
  const [showSubagentPanel, setShowSubagentPanel] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(() => window.innerWidth >= 768);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);
  const { subagents, teams } = useAISubagents();
  
  // Filter active subagents by selected team
  const activeSubagents = activeTeamId 
    ? subagents.filter(s => s.is_active && s.team_id === activeTeamId)
    : subagents.filter(s => s.is_active);

  // When team changes, update orchestrator model
  const activeTeam = teams.find(t => t.id === activeTeamId);
  useEffect(() => {
    if (activeTeam?.orchestrator_model) {
      const isBuiltIn = MODELS.some(m => m.id === activeTeam.orchestrator_model);
      if (isBuiltIn) {
        setSelectedModel(activeTeam.orchestrator_model);
        setCustomModelId('');
      } else {
        setSelectedModel('custom');
        setCustomModelId(activeTeam.orchestrator_model);
      }
    }
  }, [activeTeamId, activeTeam?.orchestrator_model]);
  
  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder({
    onTranscription: (text) => {
      setInput(prev => prev ? prev + ' ' + text : text);
      inputRef.current?.focus();
    },
  });
  
  const {
    sessions, isLoadingSessions, useSessionMessages,
    createSession, updateSessionTitle, deleteSession, addMessage, generateTitle,
  } = useAIChatHistory();

  const { data: sessionMessages } = useSessionMessages(activeSessionId);

  useEffect(() => {
    if (sessionMessages) {
      setMessages(sessionMessages.map(m => ({
        id: m.id, role: m.role, content: m.content, timestamp: m.createdAt,
      })));
    } else if (!activeSessionId) {
      setMessages([]);
    }
  }, [sessionMessages, activeSessionId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isMobile) setShowSidebar(false); }, [isMobile]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const streamChat = async (userMessages: { role: string; content: string | any[] }[], sessionId: string) => {
    const token = await getAuthToken();
    const effectiveModel = selectedModel === 'custom' ? customModelId : selectedModel;
    
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ 
        messages: userMessages,
        model: effectiveModel,
        subagents: activeSubagents.map(s => ({
          name: s.name,
          description: s.description,
          model: s.model,
          role_prompt: s.role_prompt,
          agent_type: s.agent_type,
          tools: (s as any).tools || [],
        })),
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

    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', timestamp: new Date(),
    }]);

    let delegationDetected: { agent_name: string; task: string } | null = null;

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

          // Check for tool calls that indicate delegation
          const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
          if (toolCalls) {
            for (const tc of toolCalls) {
              if (tc.function?.name === 'delegate_to_subagent') {
                try {
                  const args = JSON.parse(tc.function.arguments || '{}');
                  if (args.agent_name) {
                    delegationDetected = { agent_name: args.agent_name, task: args.task_description || '' };
                  }
                } catch {}
              }
            }
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Save assistant message to DB
    if (assistantContent) {
      await addMessage.mutateAsync({ sessionId, role: 'assistant', content: assistantContent });
    }

    // If delegation was detected, show notice and execute subagent
    if (delegationDetected) {
      const agent = activeSubagents.find(s => s.name.toLowerCase() === delegationDetected!.agent_name.toLowerCase());
      if (agent) {
        // Insert delegation notice message
        const noticeId = crypto.randomUUID();
        setMessages(prev => [...prev, {
          id: noticeId, role: 'assistant', 
          content: `🔄 Delegando tarea a **${agent.name}** ${agent.avatar_emoji || '🤖'}`,
          timestamp: new Date(),
          isDelegationNotice: true,
          subagent: agent.name,
          subagentEmoji: agent.avatar_emoji,
          subagentColor: agent.avatar_color,
        }]);
        await executeSubagentCall(agent, delegationDetected.task, sessionId, userMessages);
      }
    }

    // Check if content mentions delegation pattern
    if (!delegationDetected && (assistantContent.includes('🔄 Delegando') || assistantContent.includes('delegation_requested'))) {
      const match = assistantContent.match(/Delegando a \*\*(.+?)\*\*/);
      if (match) {
        const agentName = match[1];
        const agent = activeSubagents.find(s => s.name.toLowerCase() === agentName.toLowerCase());
        if (agent) {
          const noticeId = crypto.randomUUID();
          setMessages(prev => [...prev, {
            id: noticeId, role: 'assistant',
            content: `🔄 Delegando tarea a **${agent.name}** ${agent.avatar_emoji || '🤖'}`,
            timestamp: new Date(),
            isDelegationNotice: true,
            subagent: agent.name,
            subagentEmoji: agent.avatar_emoji,
            subagentColor: agent.avatar_color,
          }]);
          const lastUserMsg = userMessages[userMessages.length - 1];
          const task = typeof lastUserMsg.content === 'string' ? lastUserMsg.content : '';
          await executeSubagentCall(agent, task, sessionId, userMessages);
        }
      }
    }

    if (assistantContent.toLowerCase().includes('creado') || assistantContent.toLowerCase().includes('actualizado')) {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    }
  };

  const executeSubagentCall = async (agent: AISubagent, task: string, sessionId: string, contextMessages: any[]) => {
    setActiveSubagent(agent.name);
    const subagentMsgId = crypto.randomUUID();

    setMessages(prev => [...prev, {
      id: subagentMsgId, role: 'assistant', content: '',
      timestamp: new Date(), subagent: agent.name,
      subagentEmoji: agent.avatar_emoji, subagentColor: agent.avatar_color,
    }]);

    try {
      const token = await getAuthToken();
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: contextMessages,
          delegateToSubagent: {
            agentName: agent.name,
            agentModel: agent.model,
            agentPrompt: agent.role_prompt,
            agentType: agent.agent_type,
            agentTools: (agent as any).tools || [],
            userMessage: task,
          },
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Error del subagente');
      }

      if (agent.agent_type === 'image') {
        const data = await resp.json();
        const imageContent = data.response?.choices?.[0]?.message?.content || 'Imagen generada';
        // Extract image URLs from various model response formats
        let imageUrls: string[] = [];
        // OpenRouter image models may return images in different formats
        const messageData = data.response?.choices?.[0]?.message;
        if (messageData?.images) {
          imageUrls = messageData.images.map((img: any) => img.image_url?.url || img.url || img).filter(Boolean);
        }
        // Some models return base64 inline in content parts
        if (Array.isArray(messageData?.content)) {
          for (const part of messageData.content) {
            if (part.type === 'image_url') imageUrls.push(part.image_url?.url);
            if (part.type === 'image' && part.source?.data) imageUrls.push(`data:${part.source.media_type || 'image/png'};base64,${part.source.data}`);
          }
        }
        // Check for markdown image URLs in text content
        if (typeof imageContent === 'string') {
          const mdImages = imageContent.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g);
          if (mdImages) {
            for (const mdImg of mdImages) {
              const urlMatch = mdImg.match(/\((https?:\/\/[^\)]+)\)/);
              if (urlMatch) imageUrls.push(urlMatch[1]);
            }
          }
        }
        
        setMessages(prev => prev.map(m => 
          m.id === subagentMsgId ? { ...m, content: typeof imageContent === 'string' ? imageContent : 'Imagen generada', isImage: true, imageUrls } : m
        ));
        
        await addMessage.mutateAsync({ sessionId, role: 'assistant', content: `[${agent.name}] ${typeof imageContent === 'string' ? imageContent : 'Imagen generada'}` });
      } else if (agent.agent_type === 'audio') {
        // Audio subagent - handle TTS or audio generation
        const data = await resp.json();
        const audioContent = data.response?.choices?.[0]?.message?.content || 'Audio generado';
        const audioUrl = data.response?.choices?.[0]?.message?.audio?.url || null;
        
        setMessages(prev => prev.map(m => 
          m.id === subagentMsgId ? { ...m, content: audioContent, isAudio: !!audioUrl, audioUrl } : m
        ));
        
        await addMessage.mutateAsync({ sessionId, role: 'assistant', content: `[${agent.name}] ${audioContent}` });
      } else {
        // Stream text response
        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();
        let subContent = '';
        let textBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = textBuffer.indexOf('\n')) !== -1) {
            let line = textBuffer.slice(0, idx);
            textBuffer = textBuffer.slice(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                subContent += content;
                setMessages(prev => prev.map(m =>
                  m.id === subagentMsgId ? { ...m, content: subContent } : m
                ));
              }
            } catch {
              textBuffer = line + '\n' + textBuffer;
              break;
            }
          }
        }

        if (subContent) {
          await addMessage.mutateAsync({ sessionId, role: 'assistant', content: `[${agent.name}] ${subContent}` });
        }
      }
    } catch (error) {
      console.error('Subagent error:', error);
      setMessages(prev => prev.map(m =>
        m.id === subagentMsgId ? { ...m, content: `❌ Error del subagente ${agent.name}: ${error instanceof Error ? error.message : 'Error desconocido'}` } : m
      ));
    } finally {
      setActiveSubagent(null);
    }
  };

  const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.yaml', '.yml', '.log', '.sql'];
  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const ALLOWED_EXTENSIONS = [...TEXT_EXTENSIONS, ...IMAGE_EXTENSIONS, '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx'];

  const isTextFile = (fileName: string) => TEXT_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
  const isImageFile = (fileName: string) => IMAGE_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: FileAttachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} excede 10MB`); continue; }
      const isValid = ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
      if (!isValid) { toast.error(`${file.name}: tipo no soportado`); continue; }
      const attachment: FileAttachment = { name: file.name, type: file.type, size: file.size };
      if (isTextFile(file.name)) {
        const text = await file.text();
        attachment.content = text.substring(0, 50000);
      } else if (isImageFile(file.name)) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        attachment.url = dataUrl;
        attachment.content = `[Imagen adjunta: ${file.name}]`;
      } else {
        const filePath = `chat-uploads/${crypto.randomUUID()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('shared-files').upload(filePath, file);
        if (uploadError) { toast.error(`Error al subir ${file.name}`); continue; }
        const { data: urlData } = supabase.storage.from('shared-files').getPublicUrl(filePath);
        attachment.url = urlData.publicUrl;
        attachment.content = `[Archivo adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - URL: ${urlData.publicUrl}]`;
      }
      newAttachments.push(attachment);
    }
    setPendingFiles(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => setPendingFiles(prev => prev.filter((_, i) => i !== index));

  const handleSend = async (customPrompt?: string) => {
    const messageText = customPrompt || input.trim();
    if (!messageText && pendingFiles.length === 0) return;
    if (isLoading) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSession = await createSession.mutateAsync({ 
        title: generateTitle(messageText || pendingFiles[0]?.name || 'Archivo'),
        model: selectedModel,
      });
      sessionId = newSession.id;
      setActiveSessionId(sessionId);
    }

    let fullContent = messageText || '';
    const currentFiles = [...pendingFiles];
    if (currentFiles.length > 0) {
      const fileContextParts = currentFiles.map(f => {
        if (f.content && !f.content.startsWith('[')) return `\n\n--- Archivo: ${f.name} ---\n${f.content}\n--- Fin de ${f.name} ---`;
        return f.content || `[Archivo: ${f.name}]`;
      });
      fullContent += fileContextParts.join('\n');
    }

    const userMessage: Message = { 
      id: crypto.randomUUID(), role: 'user', 
      content: messageText || `📎 ${currentFiles.map(f => f.name).join(', ')}`,
      timestamp: new Date(),
      attachments: currentFiles.length > 0 ? currentFiles : undefined,
    };
    
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setPendingFiles([]);
    setIsLoading(true);

    await addMessage.mutateAsync({ sessionId, role: 'user', content: userMessage.content });

    try {
      const aiMessages = newMessages.map((m, i) => {
        if (i === newMessages.length - 1 && m.role === 'user') {
          const imageAttachments = currentFiles.filter(f => isImageFile(f.name) && f.url);
          if (imageAttachments.length > 0) {
            const content: any[] = [];
            if (fullContent) content.push({ type: 'text', text: fullContent });
            for (const img of imageAttachments) content.push({ type: 'image_url', image_url: { url: img.url! } });
            return { role: m.role, content };
          }
          return { role: m.role, content: fullContent };
        }
        if (m.attachments?.some(a => isImageFile(a.name) && a.url)) {
          const content: any[] = [];
          if (m.content) content.push({ type: 'text', text: m.content });
          for (const a of m.attachments!.filter(a => isImageFile(a.name) && a.url)) {
            content.push({ type: 'image_url', image_url: { url: a.url! } });
          }
          return { role: m.role, content };
        }
        return { role: m.role, content: m.content };
      });
      await streamChat(aiMessages, sessionId);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al enviar mensaje');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); setInput(prev => prev + '\n'); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleNewChat = () => { setActiveSessionId(null); setMessages([]); };

  const handleSelectSession = (session: AIChatSession) => {
    setActiveSessionId(session.id);
    setSelectedModel(session.model);
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession.mutateAsync(sessionId);
    if (activeSessionId === sessionId) { setActiveSessionId(null); setMessages([]); }
  };

  const handleStartEditTitle = (session: AIChatSession) => {
    setEditingTitle(session.id);
    setEditTitleValue(session.title);
  };

  const handleSaveTitle = async () => {
    if (editingTitle && editTitleValue.trim()) {
      await updateSessionTitle.mutateAsync({ sessionId: editingTitle, title: editTitleValue.trim() });
    }
    setEditingTitle(null);
  };

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  const formatSessionDate = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return format(date, 'EEEE', { locale: es });
    return format(date, 'dd/MM/yyyy');
  };

  return (
    <div className="relative flex w-full h-full overflow-hidden">
      {/* Sessions Sidebar */}
      {showSidebar && (
        <div className="absolute md:relative z-20 w-[min(18rem,85vw)] md:w-56 h-full border-r bg-background md:bg-muted/30 flex flex-col shadow-xl md:shadow-none">
          <div className="p-3 border-b flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm flex items-center gap-2 min-w-0">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">Conversaciones</span>
            </h3>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setShowSidebar(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            {isLoadingSessions ? (
              <div className="p-4 text-center text-muted-foreground text-sm">Cargando...</div>
            ) : sessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">No hay conversaciones</div>
            ) : (
              <div className="p-2 space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn('group relative rounded-lg p-2 cursor-pointer transition-colors',
                      activeSessionId === session.id ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    onClick={() => handleSelectSession(session)}
                  >
                    {editingTitle === session.id ? (
                      <Input value={editTitleValue} onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={handleSaveTitle}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(null); }}
                        className="h-6 text-sm" autoFocus onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate pr-8">{session.title}</p>
                        <p className="text-xs text-muted-foreground">{formatSessionDate(session.updatedAt)}</p>
                      </>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"
                          className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEditTitle(session)}>
                          <Pencil className="h-3 w-3 mr-2" /> Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteSession(session.id)} className="text-destructive">
                          <Trash2 className="h-3 w-3 mr-2" /> Eliminar
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

      {/* Subagent Panel - separate from conversations */}
      {showSubagentPanel && (
        <div className="absolute md:relative z-20 w-[min(24rem,90vw)] md:w-96 h-full border-r bg-background md:bg-muted/30 flex flex-col shadow-xl md:shadow-none">
          <div className="p-3 border-b flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm flex items-center gap-2 min-w-0">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="truncate">Subagentes IA</span>
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSubagentPanel(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3">
            <SubagentManager />
          </ScrollArea>
        </div>
      )}

      {showSidebar && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-sm z-10 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSidebar(!showSidebar)}>
              {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            {/* Fluiditos avatars - one per subagent in active team */}
            <div className="relative hidden md:flex items-center">
              {activeSubagents.length === 0 ? (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                  <Bot className="h-6 w-6 text-primary-foreground" />
                </div>
              ) : (
                <div className="flex items-center -space-x-2">
                  {activeSubagents.slice(0, 5).map((agent, i) => (
                    <div
                      key={agent.id}
                      className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-md border-2 border-background transition-all hover:scale-110 hover:z-10',
                        activeSubagent === agent.name && 'ring-2 ring-primary animate-pulse'
                      )}
                      style={{ backgroundColor: agent.avatar_color + '30', zIndex: activeSubagents.length - i }}
                      title={agent.name}
                    >
                      {agent.avatar_emoji}
                    </div>
                  ))}
                  {activeSubagents.length > 5 && (
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xs font-bold border-2 border-background shadow-md">
                      +{activeSubagents.length - 5}
                    </div>
                  )}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-[2.5px] border-background z-20" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
            </div>
            <div>
              <h2 className="font-semibold text-base md:text-lg">
                {activeTeam ? activeTeam.name : 'Asistente CRM'}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground hidden md:block">
                  {activeSubagent ? `🔄 ${activeSubagent} trabajando...` : `${activeSubagents.length} subagente(s) activo(s)`}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {/* Team selector */}
            {teams.length > 0 && (
              <Select value={activeTeamId || 'all'} onValueChange={v => setActiveTeamId(v === 'all' ? null : v)}>
                <SelectTrigger className="w-[100px] md:w-[130px] h-8 md:h-9 bg-muted/50 border-0">
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 shrink-0" />
                    <span className="text-xs truncate">{activeTeam?.name || 'Todos'}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  {teams.map(t => {
                    const count = subagents.filter(s => s.is_active && s.team_id === t.id).length;
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3" />
                          <span>{t.name}</span>
                          <span className="text-muted-foreground text-xs">({count})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}

            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[110px] md:w-[150px] h-8 md:h-9 bg-muted/50 border-0">
                <div className="flex items-center gap-1 md:gap-2">
                  <selectedModelInfo.icon className={`h-3 w-3 md:h-4 md:w-4 ${selectedModelInfo.color}`} />
                  <span className="text-xs md:text-sm truncate">
                    {selectedModel === 'custom' ? (customModelId || 'Custom') : selectedModelInfo.name}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-3">
                      <model.icon className={`h-4 w-4 ${model.color}`} />
                      <p className="font-medium">{model.name}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom model input */}
            {selectedModel === 'custom' && (
              <Input
                value={customModelId}
                onChange={e => setCustomModelId(e.target.value)}
                placeholder="provider/model"
                className="w-[140px] h-8 text-xs bg-muted/50 border-0"
              />
            )}
            
            <Button variant="ghost" size="icon" onClick={() => setShowSubagentPanel(!showSubagentPanel)} className="h-9 w-9" title="Subagentes IA">
              <Settings2 className={cn("h-4 w-4", showSubagentPanel && "text-primary")} />
            </Button>

            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-9 w-9">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Messages */}
        <ScrollArea className="flex-1 px-3 md:px-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-8 md:py-12">
              {/* Fluiditos group display */}
              <div className="flex items-center -space-x-3 mb-4 md:mb-6">
                {activeSubagents.length === 0 ? (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                  </div>
                ) : (
                  activeSubagents.slice(0, 6).map((agent, i) => (
                    <div
                      key={agent.id}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-2xl md:text-3xl shadow-lg border-2 border-background transition-transform hover:scale-110 hover:z-10"
                      style={{ backgroundColor: agent.avatar_color + '25', zIndex: activeSubagents.length - i }}
                      title={agent.name}
                    >
                      {agent.avatar_emoji}
                    </div>
                  ))
                )}
                {activeSubagents.length > 6 && (
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-muted flex items-center justify-center text-sm font-bold border-2 border-background shadow-lg">
                    +{activeSubagents.length - 6}
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-lg md:text-xl mb-2 text-center">¿En qué puedo ayudarte?</h3>
              <p className="text-muted-foreground text-center text-sm md:text-base max-w-md mb-4 px-4">
                {activeTeam 
                  ? `Equipo "${activeTeam.name}" con ${activeSubagents.length} subagente(s)`
                  : `Orquestador central con ${activeSubagents.length} subagente(s) especializado(s)`}
              </p>

              {/* Subagent chips */}
              {activeSubagents.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {activeSubagents.map(agent => (
                    <div key={agent.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs"
                      style={{ borderColor: agent.avatar_color + '60', backgroundColor: agent.avatar_color + '10' }}
                    >
                      <span>{agent.avatar_emoji}</span>
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-muted-foreground">· {agent.agent_type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 space-y-6">
              {messages.map((message) => {
                // Delegation notice - special rendering
                if (message.isDelegationNotice) {
                  return (
                    <div key={message.id} className="flex justify-center animate-fade-in">
                      <div 
                        className="flex items-center gap-3 px-5 py-3 rounded-2xl border-2 shadow-lg animate-pulse"
                        style={{ 
                          borderColor: (message.subagentColor || '#6C63FF') + '60',
                          backgroundColor: (message.subagentColor || '#6C63FF') + '08',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
                            style={{ backgroundColor: (message.subagentColor || '#6C63FF') + '25' }}>
                            {message.subagentEmoji || '🤖'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: message.subagentColor || 'hsl(var(--primary))' }}>
                              Orquestador → {message.subagent}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Delegando tarea al subagente...</p>
                          </div>
                        </div>
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: message.subagentColor || 'hsl(var(--primary))' }} />
                      </div>
                    </div>
                  );
                }

                return (
                <div key={message.id} className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <Avatar className={cn('h-9 w-9', 
                    message.role === 'user' ? 'bg-primary' :
                    message.subagent ? '' : 'bg-gradient-to-br from-primary to-primary/60'
                  )}
                    style={message.subagentColor ? { backgroundColor: message.subagentColor + '30', border: `2px solid ${message.subagentColor}` } : undefined}
                  >
                    <AvatarFallback className="bg-transparent text-base">
                      {message.role === 'user' ? (
                        <User className="h-4 w-4 text-primary-foreground" />
                      ) : message.subagentEmoji ? (
                        message.subagentEmoji
                      ) : (
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                    {message.subagent && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: (message.subagentColor || '#6C63FF') + '20', color: message.subagentColor || '#6C63FF' }}>
                          {message.subagentEmoji} {message.subagent}
                        </span>
                      </div>
                    )}
                    <div className={cn('inline-block rounded-2xl px-4 py-3',
                      message.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-md' : 'bg-muted rounded-tl-md',
                      message.subagent ? 'border-l-2' : ''
                    )}
                      style={message.subagentColor ? { borderLeftColor: message.subagentColor } : undefined}
                    >
                      {message.role === 'assistant' ? (
                        message.content ? (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                            {message.imageUrls && message.imageUrls.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {message.imageUrls.map((url, idx) => (
                                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt="Imagen generada" className="max-w-full rounded-lg hover:opacity-90 transition-opacity cursor-pointer" />
                                  </a>
                                ))}
                              </div>
                            )}
                            {message.isAudio && message.audioUrl && (
                              <div className="mt-3">
                                <audio controls src={message.audioUrl} className="max-w-full" preload="metadata" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">{message.subagent ? `${message.subagent} pensando...` : 'Pensando...'}</span>
                          </div>
                        )
                      ) : (
                        <div>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {message.attachments.map((att, idx) => (
                                <div key={idx} className="flex items-center gap-1 text-xs bg-primary-foreground/20 rounded px-2 py-1">
                                  {isImageFile(att.name) ? <Image className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                  <span className="truncate max-w-[120px]">{att.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-sm">{message.content}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 px-1">
                      {message.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Active subagent indicator */}
        {activeSubagent && (
          <div className="px-4 py-2 bg-primary/5 border-t flex items-center gap-2 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="font-medium">🔄 {activeSubagent} está procesando...</span>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5 text-xs">
                  {isImageFile(file.name) ? <Image className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <button onClick={() => removePendingFile(idx)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-3 items-center">
            <input ref={fileInputRef} type="file" multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.csv,.md,.txt,.json,.xml,.html,.css,.js,.ts,.tsx,.jpg,.jpeg,.png,.gif,.webp,.svg"
              onChange={handleFileSelect} className="hidden" />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}
              disabled={isLoading} className="h-12 w-12 rounded-xl shrink-0" title="Adjuntar archivo">
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button variant={isRecording ? "destructive" : "ghost"} size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading || isTranscribing}
              className="h-12 w-12 rounded-xl shrink-0" title={isRecording ? "Detener" : "Grabar audio"}>
              {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <div className="flex-1 relative">
              <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "🎙️ Grabando..." : isTranscribing ? "Transcribiendo..." : "Escribe tu mensaje..."}
                disabled={isLoading || isRecording}
                className="pr-12 h-12 rounded-xl bg-muted/50 border-0 focus-visible:ring-1" />
            </div>
            <Button onClick={() => handleSend()} disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
              size="icon" className="h-12 w-12 rounded-xl">
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Orquestador: {selectedModel === 'custom' ? (customModelId || 'Custom') : selectedModelInfo.name}
            {activeTeam ? ` • Equipo: ${activeTeam.name}` : ''} • {activeSubagents.length} subagente(s) • 📎 PDF, DOCX, CSV, imágenes
          </p>
        </div>
      </div>
    </div>
  );
}
