import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Send, Loader2, Sparkles, X, Bold, Italic, Underline,
  Link2, List, ListOrdered, Paperclip, FolderOpen, PenLine
} from 'lucide-react';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { ComposeData } from './EmailModule';
import {
  AIChatMsg, AttachedFile, EmailSignature,
  loadSignatures, saveSignatures, fileToBase64, blobToBase64,
  SignatureManagerDialog, AIChatPanel, SharedFilesDialog,
} from './EmailComposeHelpers';

interface EmailComposeProps {
  initialData?: ComposeData | null;
}

export function EmailCompose({ initialData }: EmailComposeProps) {
  const { user } = useAuth();
  const { profiles, defaultProfile } = useEmailProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string>(defaultProfile?.id || '');
  const [to, setTo] = useState(initialData?.to || '');
  const [cc, setCc] = useState(initialData?.cc || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [isSending, setIsSending] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sharedFilesOpen, setSharedFilesOpen] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<any[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);

  // Signatures
  const [signatures, setSignatures] = useState<EmailSignature[]>(loadSignatures());
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeSignatureId, setActiveSignatureId] = useState<string>('');

  // AI chat state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIChatMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || defaultProfile;

  useEffect(() => {
    if (!selectedProfileId && defaultProfile) setSelectedProfileId(defaultProfile.id);
  }, [defaultProfile, selectedProfileId]);

  useEffect(() => {
    if (initialData && !initializedRef.current) {
      initializedRef.current = true;
      if (initialData.to) setTo(initialData.to);
      if (initialData.cc) setCc(initialData.cc);
      if (initialData.subject) setSubject(initialData.subject);
      if (initialData.bodyHtml && editorRef.current) editorRef.current.innerHTML = initialData.bodyHtml;
    }
  }, [initialData]);

  const execCommand = (cmd: string, value?: string) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); };
  const insertLink = () => { const url = prompt('URL del enlace:'); if (url) execCommand('createLink', url); };
  const getEditorHtml = () => editorRef.current?.innerHTML || '';

  const handleLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(), name: f.name, size: f.size, type: f.type, source: 'local' as const, file: f,
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  const fetchSharedFiles = async () => {
    setLoadingShared(true);
    try {
      const { data, error } = await supabase.from('shared_files').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setSharedFiles(data || []);
    } catch { toast.error('Error cargando archivos'); }
    finally { setLoadingShared(false); }
  };

  const attachSharedFile = async (file: any) => {
    const { data } = supabase.storage.from('shared-files').getPublicUrl(file.file_path);
    setAttachedFiles(prev => [...prev, {
      id: crypto.randomUUID(), name: file.file_name, size: file.file_size,
      type: file.file_type || 'application/octet-stream', source: 'shared', url: data.publicUrl,
    }]);
    setSharedFilesOpen(false);
    toast.success(`${file.file_name} adjuntado`);
  };

  const handleSend = async () => {
    const bodyHtml = getEditorHtml();
    if (!to.trim() || !subject.trim() || !bodyHtml.trim()) { toast.error('Completa destinatario, asunto y mensaje'); return; }
    if (!selectedProfile) { toast.error('Selecciona un perfil de envío'); return; }

    setIsSending(true);
    try {
      const activeSig = signatures.find(s => s.id === activeSignatureId);
      const fullHtml = activeSig
        ? `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${bodyHtml}<br><br>${activeSig.html}</div>`
        : `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${bodyHtml}</div>`;

      const attachmentsPayload: { filename: string; content: string; contentType: string }[] = [];
      for (const att of attachedFiles) {
        if (att.source === 'local' && att.file) {
          attachmentsPayload.push({ filename: att.name, content: await fileToBase64(att.file), contentType: att.type });
        } else if (att.source === 'shared' && att.url) {
          try {
            const resp = await fetch(att.url);
            const blob = await resp.blob();
            attachmentsPayload.push({ filename: att.name, content: await blobToBase64(blob), contentType: att.type });
          } catch { console.error('Could not attach shared file:', att.name); }
        }
      }

      const { error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: to.trim(), cc: cc.trim() || undefined, subject: subject.trim(),
          html: fullHtml, text: editorRef.current?.innerText || '', profileId: selectedProfile.id,
          attachments: attachmentsPayload.length > 0 ? attachmentsPayload : undefined,
        },
      });
      if (error) throw error;
      toast.success(`Email enviado a ${to}`);
      setTo(''); setCc(''); setSubject('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setAttachedFiles([]);
    } catch (err: any) {
      toast.error('Error al enviar: ' + (err.message || 'Desconocido'));
    } finally { setIsSending(false); }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: newMessages, context: `Perfil de envío: ${selectedProfile?.from_name || ''} <${selectedProfile?.from_email || ''}>` }),
      });
      if (!resp.ok) { const errData = await resp.json().catch(() => ({})); throw new Error(errData.error || 'Error de IA'); }

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
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch { buf = line + '\n' + buf; break; }
        }
      }

      if (assistantSoFar) {
        const subjectMatch = assistantSoFar.match(/\*\*ASUNTO:\*\*\s*(.+)/i);
        const bodyMatch = assistantSoFar.match(/\*\*CUERPO:\*\*\s*([\s\S]+)/i);
        if (subjectMatch) setSubject(subjectMatch[1].trim());
        if (bodyMatch && editorRef.current) editorRef.current.innerHTML = bodyMatch[1].trim().replace(/\n/g, '<br>');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de IA');
    } finally { setAiLoading(false); }
  };

  return (
    <div className="h-full flex gap-4 p-4">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Redactar correo</h2>
          <Button variant={aiOpen ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setAiOpen(!aiOpen)}>
            <Sparkles className="h-4 w-4" /> Escribir con IA
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Enviar desde</Label>
          <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona un perfil" /></SelectTrigger>
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

        <div className="flex items-center gap-1 p-1.5 border rounded-md bg-muted/30 flex-wrap">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('bold')}><Bold className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('italic')}><Italic className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('underline')}><Underline className="h-3.5 w-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertUnorderedList')}><List className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={insertLink}><Link2 className="h-3.5 w-3.5" /></Button>
          <div className="w-px h-5 bg-border mx-1" />
          <select className="h-7 text-xs bg-transparent border rounded px-1" onChange={e => { if (e.target.value) execCommand('fontSize', e.target.value); }} defaultValue="">
            <option value="" disabled>Tamaño</option>
            <option value="1">Pequeño</option><option value="3">Normal</option><option value="5">Grande</option><option value="7">Muy grande</option>
          </select>
          <input type="color" className="h-7 w-7 border rounded cursor-pointer" title="Color de texto" onChange={e => execCommand('foreColor', e.target.value)} />
          <div className="flex-1" />
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleLocalFiles} />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-3.5 w-3.5" /> Adjuntar</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSharedFilesOpen(true); fetchSharedFiles(); }}><FolderOpen className="h-3.5 w-3.5" /> Archivos</Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSignatureModalOpen(true)}><PenLine className="h-3.5 w-3.5" /> Firma</Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div ref={editorRef} contentEditable
            className="flex-1 min-h-[200px] p-3 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring overflow-auto prose prose-sm dark:prose-invert max-w-none"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} data-placeholder="Escribe tu mensaje..." />
        </div>

        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map(f => (
              <Badge key={f.id} variant="secondary" className="gap-1.5 py-1 px-2">
                <Paperclip className="h-3 w-3" />
                <span className="text-xs truncate max-w-[150px]">{f.name}</span>
                <span className="text-[10px] text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
                <button onClick={() => removeAttachment(f.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}

        {activeSignatureId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-3 w-3" />Firma: {signatures.find(s => s.id === activeSignatureId)?.name}
            <button onClick={() => setActiveSignatureId('')} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Enviar
          </Button>
        </div>
      </div>

      <SharedFilesDialog open={sharedFilesOpen} onOpenChange={setSharedFilesOpen} sharedFiles={sharedFiles} loading={loadingShared} onAttach={attachSharedFile} />
      <SignatureManagerDialog open={signatureModalOpen} onOpenChange={setSignatureModalOpen}
        signatures={signatures} setSignatures={setSignatures} activeSignatureId={activeSignatureId} setActiveSignatureId={setActiveSignatureId} />
      {aiOpen && <AIChatPanel aiMessages={aiMessages} aiInput={aiInput} setAiInput={setAiInput} aiLoading={aiLoading} onClose={() => setAiOpen(false)} onSend={streamAI} />}
    </div>
  );
}
