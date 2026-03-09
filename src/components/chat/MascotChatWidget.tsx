import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { X, Send, Loader2, Minimize2, Mic, MicOff, Plus, Paperclip, Image as ImageIcon, Palette } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FluiditosAvatar, FluiditosConfig, FluiditosAnimState, loadFluiditosConfig } from './FluiditosAvatar';
import { FluiditosCustomizer } from './FluiditosCustomizer';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface PendingImage {
  name: string;
  dataUrl: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

const STORAGE_KEY = 'microssages';

export function MascotChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [fluiditosConfig, setFluiditosConfig] = useState<FluiditosConfig>(loadFluiditosConfig);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  // Ultra-simple drag: direct DOM, mousemove for max speed
  const elRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef({ x: Math.max(0, window.innerWidth - 80), y: Math.max(0, window.innerHeight - 80) });
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  const clampToViewport = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const ew = el.offsetWidth;
    const eh = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nx = Math.max(0, Math.min(vw - ew, posRef.current.x));
    const ny = Math.max(0, Math.min(vh - eh, posRef.current.y));
    posRef.current = { x: nx, y: ny };
    el.style.transform = `translate(${nx}px, ${ny}px)`;
  }, []);

  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);

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

  useEffect(() => {
    const onResize = () => clampToViewport();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampToViewport]);

  useEffect(() => {
    const t = setTimeout(() => clampToViewport(), 50);
    return () => clearTimeout(t);
  }, [isOpen, isMinimized, clampToViewport]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || !elRef.current) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      d.moved = true;
      const ew = elRef.current.offsetWidth;
      const eh = elRef.current.offsetHeight;
      const nx = Math.max(0, Math.min(window.innerWidth - ew, d.ox + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - eh, d.oy + dy));
      posRef.current = { x: nx, y: ny };
      elRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    };
    const onUp = () => {
      if (dragRef.current) {
        setTimeout(() => { dragRef.current = null; }, 0);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    const onTouchMove = (e: TouchEvent) => {
      const d = dragRef.current;
      if (!d || !elRef.current) return;
      const t = e.touches[0];
      const dx = t.clientX - d.sx;
      const dy = t.clientY - d.sy;
      if (!d.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      d.moved = true;
      e.preventDefault();
      const ew = elRef.current.offsetWidth;
      const eh = elRef.current.offsetHeight;
      const nx = Math.max(0, Math.min(window.innerWidth - ew, d.ox + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - eh, d.oy + dy));
      posRef.current = { x: nx, y: ny };
      elRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    };
    const onTouchEnd = () => {
      setTimeout(() => { dragRef.current = null; }, 0);
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { sx: clientX, sy: clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
  };

  const wasDragged = () => !!dragRef.current?.moved;

  const handleNewConversation = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} excede 10MB`); continue; }
      if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)) { toast.error(`${file.name}: solo imágenes`); continue; }
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      setPendingImages(prev => [...prev, { name: file.name, dataUrl }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingImages.length === 0) || isLoading) return;
    const currentImages = [...pendingImages];
    const userMessage: Message = { 
      role: 'user', 
      content: input.trim() || `📎 ${currentImages.map(i => i.name).join(', ')}`,
      images: currentImages.length > 0 ? currentImages.map(i => i.dataUrl) : undefined,
    };
    
    const apiMessages = [...messages, userMessage].map(m => {
      if (m.images && m.images.length > 0) {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const img of m.images) {
          content.push({ type: 'image_url', image_url: { url: img } });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: m.content };
    });
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mascot-chat', { body: { messages: apiMessages } });
      if (error) throw error;
      setMessages(prev => [...prev, { role: 'assistant', content: data?.response || data?.error || 'Sin respuesta' }]);
    } catch (error) {
      console.error('FluiMicrMicro', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '¡Ups! Parece que tuve un pequeño cortocircuito 💧⚡ Intenta de nuevo.' }]);
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
      <div
        ref={el => { elRef.current = el; if (el) { el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`; } }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onClick={() => { if (!wasDragged()) setIsOpen(true); }}
        style={{ position: 'fixed', left: 0, top: 0, willChange: 'transform' }}
        className="z-50 touch-none w-16 h-16 rounded-full shadow-2xl bg-card/80 backdrop-blur-sm border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing"
        role="button"
        aria-label="Abrir chat con Micro"
      >
        <FluiditosAvatar config={fluiditosConfig} size={56} animated animState="idle" />
        <span className="absolute -top-2 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow pointer-events-none">
          {messages.length > 0 ? `${messages.length}` : '¡Hola!'}
        </span>
      </div>
    );
  }

  // Minimized
  if (isMinimized) {
    return (
      <div
        ref={el => { elRef.current = el; if (el) { el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`; } }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onClick={() => { if (!wasDragged()) setIsMinimized(false); }}
        style={{ position: 'fixed', left: 0, top: 0, willChange: 'transform' }}
        className="z-50 touch-none w-14 h-14 rounded-full shadow-xl bg-card/80 backdrop-blur-sm border border-primary/20 flex items-center justify-center cursor-grab active:cursor-grabbing"
        role="button"
      >
        <FluiditosAvatar config={fluiditosConfig} size={48} animated animState="idle" />
      </div>
    );
  }

  // Open chat
  return (
    <div
      ref={el => { elRef.current = el; if (el && !isMobile) { el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`; } }}
      style={isMobile ? { position: 'fixed', inset: 0 } : { position: 'fixed', left: 0, top: 0, willChange: 'transform' }}
      className={cn(
        'z-50 flex flex-col bg-background shadow-2xl border relative',
        isMobile
          ? 'w-full h-[100dvh] rounded-none'
          : 'overflow-auto min-w-[280px] min-h-[300px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] w-[340px] h-[460px] rounded-2xl resize'
      )}
    >
      {/* Header - always draggable */}
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <div className="w-10 h-10 rounded-full bg-card/60 flex items-center justify-center border shadow-sm pointer-events-none">
          <FluiditosAvatar config={fluiditosConfig} size={36} animated animState={isLoading ? 'responding' : 'idle'} />
        </div>
        <div className="flex-1 pointer-events-none">
          <h3 className="font-semibold text-sm">Micro</h3>
          <p className="text-xs text-muted-foreground">Asistente virtual 💧</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={e => e.stopPropagation()} onClick={() => setShowCustomizer(true)} title="Personalizar">
          <Palette className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={e => e.stopPropagation()} onClick={handleNewConversation} title="Nueva conversación">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={e => e.stopPropagation()} onClick={() => setIsMinimized(true)}>
          <Minimize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={e => e.stopPropagation()} onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Customizer overlay - rendered after header so header is still accessible for drag */}
      {showCustomizer && (
        <FluiditosCustomizer
          config={fluiditosConfig}
          onChange={setFluiditosConfig}
          onClose={() => setShowCustomizer(false)}
        />
      )}

      {/* Messages */}
      {!showCustomizer && (
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollViewportRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-24 h-24 mx-auto">
                <FluiditosAvatar config={fluiditosConfig} size={96} animState="idle" />
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">¡Hola! Soy Fluiditos 💧</h4>
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
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                      <FluiditosAvatar config={fluiditosConfig} size={28} animated={false} animState="idle" />
                    </div>
                  )}
                  <div className={cn('max-w-[80%] rounded-2xl px-4 py-2 text-sm', message.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md')}>
                    {message.images && message.images.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {message.images.map((img, idx) => (
                          <img key={idx} src={img} alt="Adjunto" className="max-w-[120px] max-h-[120px] rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
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
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                    <FluiditosAvatar config={fluiditosConfig} size={28} animated animState="responding" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 text-xs text-muted-foreground">
                    Escribiendo...
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Input */}
      {!showCustomizer && (
      <div className="p-3 border-t bg-muted/30">
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative">
                <img src={img.dataUrl} alt={img.name} className="w-12 h-12 rounded-lg object-cover border" />
                <button
                  onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px]"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="rounded-full shrink-0"
            title="Adjuntar imagen"
          >
            <ImageIcon className="h-4 w-4" />
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
          <Button size="icon" onClick={handleSend} disabled={(!input.trim() && pendingImages.length === 0) || isLoading} className="rounded-full">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      )}
    </div>
  );
}
