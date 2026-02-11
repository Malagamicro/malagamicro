import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Sparkles, X, Bot, User } from 'lucide-react';
import { useEmailProfiles, EmailProfile } from '@/hooks/useEmailProfiles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export function EmailCompose() {
  const { profiles, defaultProfile } = useEmailProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>(defaultProfile?.id || '');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // AI chat state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIChatMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || defaultProfile;

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('Completa destinatario, asunto y mensaje');
      return;
    }
    if (!selectedProfile) {
      toast.error('Selecciona un perfil de envío');
      return;
    }

    setIsSending(true);
    try {
      const htmlBody = body.replace(/\n/g, '<br>');
      const { error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: to.trim(),
          subject: subject.trim(),
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
          text: body,
          profileId: selectedProfile.id,
        },
      });
      if (error) throw error;
      toast.success(`Email enviado a ${to}`);
      setTo(''); setCc(''); setSubject(''); setBody('');
    } catch (err: any) {
      toast.error('Error al enviar: ' + (err.message || 'Desconocido'));
    } finally {
      setIsSending(false);
    }
  };

  const streamAI = async (userMsg: string) => {
    const newMessages: AIChatMsg[] = [...aiMessages, { role: 'user', content: userMsg }];
    setAiMessages(newMessages);
    setAiInput('');
    setAiLoading(true);

    let assistantSoFar = '';
    const COMPOSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compose-email-ai`;

    try {
      const resp = await fetch(COMPOSE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          context: `Perfil de envío: ${selectedProfile?.from_name || ''} <${selectedProfile?.from_email || ''}>`,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Error de IA');
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setAiMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { buf = line + '\n' + buf; break; }
        }
      }

      // Extract subject and body from AI response
      if (assistantSoFar) {
        const subjectMatch = assistantSoFar.match(/\*\*ASUNTO:\*\*\s*(.+)/i);
        const bodyMatch = assistantSoFar.match(/\*\*CUERPO:\*\*\s*([\s\S]+)/i);
        if (subjectMatch) setSubject(subjectMatch[1].trim());
        if (bodyMatch) setBody(bodyMatch[1].trim());
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de IA');
    } finally {
      setAiLoading(false);
      setTimeout(() => aiScrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Compose form */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Redactar correo</h2>
          <Button
            variant={aiOpen ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => setAiOpen(!aiOpen)}
          >
            <Sparkles className="h-4 w-4" />
            Escribir con IA
          </Button>
        </div>

        {/* Profile selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Enviar desde</Label>
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecciona un perfil" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.profile_name}</span>
                    <span className="text-xs text-muted-foreground">{p.from_email}</span>
                    {p.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Para *</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@ejemplo.com" disabled={isSending} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CC</Label>
            <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@ejemplo.com" disabled={isSending} className="h-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Asunto *</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del correo" disabled={isSending} className="h-9" />
        </div>

        <div className="space-y-1.5 flex-1 flex flex-col">
          <Label className="text-xs">Mensaje *</Label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={isSending}
            className="flex-1 min-h-[200px] resize-none"
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={isSending || !to.trim() || !subject.trim() || !body.trim()}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </div>
      </div>

      {/* AI Chat Panel */}
      {aiOpen && (
        <Card className="w-80 lg:w-96 flex flex-col border-primary/20">
          <div className="flex items-center justify-between p-3 border-b bg-primary/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Asistente de redacción</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiOpen(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-3">
            {aiMessages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-8 space-y-2">
                <Bot className="h-8 w-8 mx-auto opacity-40" />
                <p>Dime qué email quieres escribir y lo redactaré por ti.</p>
                <p className="text-[10px]">Ejemplo: "Escribe un email de presentación para una empresa de software"</p>
              </div>
            )}
            <div className="space-y-3">
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary' : 'bg-muted'}`}>
                    {msg.role === 'user' ? <User className="h-3 w-3 text-primary-foreground" /> : <Bot className="h-3 w-3" />}
                  </div>
                  <div className={`rounded-xl px-3 py-2 max-w-[85%] text-xs whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2 text-xs">Escribiendo...</div>
                </div>
              )}
              <div ref={aiScrollRef} />
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && aiInput.trim() && !aiLoading) streamAI(aiInput.trim()); }}
                placeholder="Describe el email..."
                className="h-8 text-xs"
                disabled={aiLoading}
              />
              <Button size="icon" className="h-8 w-8 shrink-0" disabled={!aiInput.trim() || aiLoading}
                onClick={() => { if (aiInput.trim()) streamAI(aiInput.trim()); }}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
