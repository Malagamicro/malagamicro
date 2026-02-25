import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Loader2, Minimize2, Mic, MicOff, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import mascotImage from '@/assets/mascot.png';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useIsMobile } from '@/hooks/use-mobile';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'micro_chat_messages';

export function MascotChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  // Ultra-simple drag: ref-based, no React state during drag
  const elRef = useRef<HTMLElement | null>(null);
  const posRef = useRef({ x: Math.max(0, window.innerWidth - 80), y: Math.max(0, window.innerHeight - 80) });
  const dragData = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const { isRecording, isTranscribing, startRecording, stopRecording } = useAudioRecorder({
    onTranscription: (text) => {
      setInput(prev => prev ? prev + ' ' + text : text);
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (isOpen && !isMinimized) inputRef.current?.focus(); }, [isOpen, isMinimized]);

  // Attach native listeners for drag — no React overhead
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragData.current;
      if (!d || !elRef.current) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      d.moved = true;
      const nx = Math.max(0, Math.min(window.innerWidth - 60, d.ox + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, d.oy + dy));
      posRef.current = { x: nx, y: ny };
      elRef.current.style.left = nx + 'px';
      elRef.current.style.top = ny + 'px';
    };
    const onUp = () => {
      // Keep moved flag accessible for onClick — clear data after a tick
      setTimeout(() => { dragData.current = null; }, 0);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    dragData.current = { sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const wasDragged = () => !!dragData.current?.moved;

  const handleNewConversation = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: 'user', content: input.trim() };
    const requestMessages = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mascot-chat', { body: { messages: requestMessages } });
      if (error) throw error;
      setMessages(prev => [...prev, { role: 'assistant', content: data?.response || data?.error || 'Sin respuesta' }]);
    } catch (error) {
      console.error('Mascot chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '¡Ups! Parece que tuve un pequeño cortocircuito 🤖⚡ Intenta de nuevo.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); setInput(prev => prev + '\n'); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!user) return null;

  // Closed — floating button
  if (!isOpen) {
    return (
      <button
        ref={el => { elRef.current = el; if (el) { el.style.left = posRef.current.x + 'px'; el.style.top = posRef.current.y + 'px'; } }}
        onPointerDown={startDrag}
        onClick={() => { if (!wasDragged()) setIsOpen(true); }}
        style={{ position: 'fixed' }}
        className="z-50 touch-none w-14 h-14 rounded-full shadow-2xl bg-card border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing"
        aria-label="Abrir chat con Micro"
      >
        <img src={mascotImage} alt="Micro" className="w-12 h-12 object-contain pointer-events-none" />
        <span className="absolute -top-2 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow pointer-events-none">
          {messages.length > 0 ? `${messages.length}` : '¡Hola!'}
        </span>
      </button>
    );
  }

  // Minimized
  if (isMinimized) {
    return (
      <button
        ref={el => { elRef.current = el; if (el) { el.style.left = posRef.current.x + 'px'; el.style.top = posRef.current.y + 'px'; } }}
        onPointerDown={startDrag}
        onClick={() => { if (!wasDragged()) setIsMinimized(false); }}
        style={{ position: 'fixed' }}
        className="z-50 touch-none w-12 h-12 rounded-full shadow-xl bg-primary text-primary-foreground flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <img src={mascotImage} alt="Micro" className="w-10 h-10 object-contain pointer-events-none" />
      </button>
    );
  }

  // Open chat
  return (
    <div
      ref={el => { elRef.current = el; if (el && !isMobile) { el.style.left = posRef.current.x + 'px'; el.style.top = posRef.current.y + 'px'; } }}
      style={isMobile ? { position: 'fixed', inset: 0 } : { position: 'fixed' }}
      className={cn(
        'z-50 flex flex-col bg-background shadow-2xl border',
        isMobile
          ? 'w-full h-[100dvh] rounded-none'
          : 'overflow-auto min-w-[280px] min-h-[300px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] w-[340px] h-[460px] rounded-2xl resize'
      )}
    >
      {/* Header — drag handle */}
      <div
        onPointerDown={startDrag}
        className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center border shadow-sm pointer-events-none">
          <img src={mascotImage} alt="Micro" className="w-9 h-9 object-contain" />
        </div>
        <div className="flex-1 pointer-events-none">
          <h3 className="font-semibold text-sm">Micro</h3>
          <p className="text-xs text-muted-foreground">Asistente virtual 🤖</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation} title="Nueva conversación">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(true)}>
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div ref={scrollViewportRef} className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 mx-auto">
                  <img src={mascotImage} alt="Micro" className="w-full h-full object-contain" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">¡Hola! Soy Micro 🤖</h4>
                  <p className="text-sm text-muted-foreground max-w-[250px] mx-auto">
                    Tu asistente de MalagaMicro. Puedo enviar mensajes, emails, WhatsApp, buscar leads y más.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {['Ver leads', 'Ver correos', 'Recordatorios', 'Ayuda'].map((tip) => (
                    <button
                      key={tip}
                      onClick={() => {
                        const prompts: Record<string, string> = {
                          'Ver leads': 'Muéstrame mis leads recientes',
                          'Ver correos': 'Revisa mi bandeja de entrada',
                          'Recordatorios': 'Muéstrame mis recordatorios pendientes',
                          'Ayuda': '¿Qué puedes hacer?',
                        };
                        setInput(prompts[tip] || tip);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      {tip}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, i) => (
                  <div key={i} className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {message.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
                        <img src={mascotImage} alt="Micro" className="w-6 h-6 object-contain" />
                      </div>
                    )}
                    <div className={cn('max-w-[80%] rounded-2xl px-4 py-2 text-sm', message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md')}>
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-card border flex items-center justify-center flex-shrink-0">
                      <img src={mascotImage} alt="Micro" className="w-6 h-6 object-contain" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Button
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}
            className="rounded-full shrink-0"
            title={isRecording ? "Detener" : "Grabar audio"}
          >
            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "🎙️ Grabando..." : isTranscribing ? "Transcribiendo..." : "Escribe un mensaje..."}
            disabled={isLoading || isRecording}
            className="flex-1 rounded-full bg-background"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoading} className="rounded-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
