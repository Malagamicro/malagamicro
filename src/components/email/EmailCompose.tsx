import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Send, Loader2, Sparkles, X, Bot, User, Bold, Italic, Underline,
  Link2, List, ListOrdered, Paperclip, FolderOpen, Trash2, FileText,
  Image, Type, Palette, PenLine, Import, Eye
} from 'lucide-react';
import { useEmailProfiles } from '@/hooks/useEmailProfiles';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sanitizeHtml } from '@/lib/sanitize';

interface AIChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  source: 'local' | 'shared';
  url?: string; // for shared files
  file?: File; // for local uploads
}

interface EmailSignature {
  id: string;
  name: string;
  html: string;
}

const SIGNATURES_KEY = 'crm_email_signatures';

function loadSignatures(): EmailSignature[] {
  try {
    return JSON.parse(localStorage.getItem(SIGNATURES_KEY) || '[]');
  } catch { return []; }
}

function saveSignatures(sigs: EmailSignature[]) {
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(sigs));
}

import type { ComposeData } from './EmailModule';

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
  const [editingSig, setEditingSig] = useState<EmailSignature | null>(null);
  const [sigName, setSigName] = useState('');
  const [sigHtml, setSigHtml] = useState('');
  const [activeSignatureId, setActiveSignatureId] = useState<string>('');
  const [importHtml, setImportHtml] = useState('');
  const [sigTab, setSigTab] = useState('edit');
  const sigImageInputRef = useRef<HTMLInputElement>(null);

  // AI chat state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIChatMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || defaultProfile;

  useEffect(() => {
    if (!selectedProfileId && defaultProfile) {
      setSelectedProfileId(defaultProfile.id);
    }
  }, [defaultProfile, selectedProfileId]);

  // Populate fields from initialData (reply/forward)
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      initializedRef.current = true;
      if (initialData.to) setTo(initialData.to);
      if (initialData.cc) setCc(initialData.cc);
      if (initialData.subject) setSubject(initialData.subject);
      if (initialData.bodyHtml && editorRef.current) {
        editorRef.current.innerHTML = initialData.bodyHtml;
      }
    }
  }, [initialData]);

  // Rich text commands
  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('URL del enlace:');
    if (url) execCommand('createLink', url);
  };

  const getEditorHtml = () => editorRef.current?.innerHTML || '';

  // File attachments
  const handleLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: AttachedFile[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      source: 'local' as const,
      file: f,
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const fetchSharedFiles = async () => {
    setLoadingShared(true);
    try {
      const { data, error } = await supabase
        .from('shared_files')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setSharedFiles(data || []);
    } catch { toast.error('Error cargando archivos'); }
    finally { setLoadingShared(false); }
  };

  const attachSharedFile = async (file: any) => {
    const { data } = supabase.storage.from('shared-files').getPublicUrl(file.file_path);
    setAttachedFiles(prev => [...prev, {
      id: crypto.randomUUID(),
      name: file.file_name,
      size: file.file_size,
      type: file.file_type || 'application/octet-stream',
      source: 'shared',
      url: data.publicUrl,
    }]);
    setSharedFilesOpen(false);
    toast.success(`${file.file_name} adjuntado`);
  };

  // Signatures
  const saveSig = () => {
    if (!sigName.trim() || !sigHtml.trim()) return toast.error('Nombre y contenido requeridos');
    const updated = editingSig
      ? signatures.map(s => s.id === editingSig.id ? { ...s, name: sigName, html: sigHtml } : s)
      : [...signatures, { id: crypto.randomUUID(), name: sigName, html: sigHtml }];
    setSignatures(updated);
    saveSignatures(updated);
    setSigName(''); setSigHtml(''); setEditingSig(null);
    toast.success(editingSig ? 'Firma actualizada' : 'Firma creada');
  };

  const deleteSig = (id: string) => {
    const updated = signatures.filter(s => s.id !== id);
    setSignatures(updated);
    saveSignatures(updated);
    if (activeSignatureId === id) setActiveSignatureId('');
  };

  const importSignature = () => {
    if (!importHtml.trim()) return toast.error('Pega el HTML de la firma');
    setSigHtml(importHtml);
    setImportHtml('');
    setSigTab('edit');
    toast.success('Firma importada - dale un nombre y guárdala');
  };

  const handleSigImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Convert to base64 for inline embedding
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSigHtml(prev => prev + `<img src="${base64}" alt="firma" style="max-width:200px;height:auto;" />`);
    };
    reader.readAsDataURL(file);
  };

  // Send email
  const handleSend = async () => {
    const bodyHtml = getEditorHtml();
    if (!to.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error('Completa destinatario, asunto y mensaje');
      return;
    }
    if (!selectedProfile) {
      toast.error('Selecciona un perfil de envío');
      return;
    }

    setIsSending(true);
    try {
      // Build signature
      const activeSig = signatures.find(s => s.id === activeSignatureId);
      const fullHtml = activeSig
        ? `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${bodyHtml}<br><br>${activeSig.html}</div>`
        : `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${bodyHtml}</div>`;

      // Convert local files to base64 attachments
      const attachmentsPayload: { filename: string; content: string; contentType: string }[] = [];
      for (const att of attachedFiles) {
        if (att.source === 'local' && att.file) {
          const base64 = await fileToBase64(att.file);
          attachmentsPayload.push({
            filename: att.name,
            content: base64,
            contentType: att.type,
          });
        } else if (att.source === 'shared' && att.url) {
          // Download shared file and convert
          try {
            const resp = await fetch(att.url);
            const blob = await resp.blob();
            const base64 = await blobToBase64(blob);
            attachmentsPayload.push({
              filename: att.name,
              content: base64,
              contentType: att.type,
            });
          } catch { console.error('Could not attach shared file:', att.name); }
        }
      }

      const { error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: to.trim(),
          cc: cc.trim() || undefined,
          subject: subject.trim(),
          html: fullHtml,
          text: editorRef.current?.innerText || '',
          profileId: selectedProfile.id,
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
    } finally {
      setIsSending(false);
    }
  };

  // AI streaming
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

      if (assistantSoFar) {
        const subjectMatch = assistantSoFar.match(/\*\*ASUNTO:\*\*\s*(.+)/i);
        const bodyMatch = assistantSoFar.match(/\*\*CUERPO:\*\*\s*([\s\S]+)/i);
        if (subjectMatch) setSubject(subjectMatch[1].trim());
        if (bodyMatch && editorRef.current) {
          editorRef.current.innerHTML = bodyMatch[1].trim().replace(/\n/g, '<br>');
        }
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
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Redactar correo</h2>
          <Button variant={aiOpen ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setAiOpen(!aiOpen)}>
            <Sparkles className="h-4 w-4" /> Escribir con IA
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

        {/* Rich text toolbar */}
        <div className="flex items-center gap-1 p-1.5 border rounded-md bg-muted/30 flex-wrap">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('bold')} title="Negrita">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('italic')} title="Cursiva">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('underline')} title="Subrayado">
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertUnorderedList')} title="Lista">
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => execCommand('insertOrderedList')} title="Lista numerada">
            <ListOrdered className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={insertLink} title="Insertar enlace">
            <Link2 className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
          <select
            className="h-7 text-xs bg-transparent border rounded px-1"
            onChange={e => { if (e.target.value) execCommand('fontSize', e.target.value); }}
            defaultValue=""
          >
            <option value="" disabled>Tamaño</option>
            <option value="1">Pequeño</option>
            <option value="3">Normal</option>
            <option value="5">Grande</option>
            <option value="7">Muy grande</option>
          </select>
          <input
            type="color"
            className="h-7 w-7 border rounded cursor-pointer"
            title="Color de texto"
            onChange={e => execCommand('foreColor', e.target.value)}
          />
          <div className="flex-1" />
          {/* Attachment buttons */}
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleLocalFiles} />
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" /> Adjuntar
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setSharedFilesOpen(true); fetchSharedFiles(); }}>
            <FolderOpen className="h-3.5 w-3.5" /> Archivos
          </Button>
          {/* Signature */}
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setSignatureModalOpen(true)}>
            <PenLine className="h-3.5 w-3.5" /> Firma
          </Button>
        </div>

        {/* ContentEditable editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            ref={editorRef}
            contentEditable
            className="flex-1 min-h-[200px] p-3 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring overflow-auto prose prose-sm dark:prose-invert max-w-none"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            data-placeholder="Escribe tu mensaje..."
            onFocus={e => { if (e.currentTarget.textContent === '') e.currentTarget.classList.remove('empty'); }}
          />
        </div>

        {/* Attached files list */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map(f => (
              <Badge key={f.id} variant="secondary" className="gap-1.5 py-1 px-2">
                <Paperclip className="h-3 w-3" />
                <span className="text-xs truncate max-w-[150px]">{f.name}</span>
                <span className="text-[10px] text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
                <button onClick={() => removeAttachment(f.id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Active signature indicator */}
        {activeSignatureId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PenLine className="h-3 w-3" />
            Firma: {signatures.find(s => s.id === activeSignatureId)?.name}
            <button onClick={() => setActiveSignatureId('')} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar
          </Button>
        </div>
      </div>

      {/* Shared Files Dialog */}
      <Dialog open={sharedFilesOpen} onOpenChange={setSharedFilesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjuntar desde Archivos compartidos</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            {loadingShared ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : sharedFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay archivos compartidos</p>
            ) : (
              <div className="space-y-1">
                {sharedFiles.map(f => (
                  <button
                    key={f.id}
                    onClick={() => attachSharedFile(f)}
                    className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted text-left text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{f.file_name}</span>
                    <span className="text-xs text-muted-foreground">{(f.file_size / 1024).toFixed(0)}KB</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Signature Manager Dialog */}
      <Dialog open={signatureModalOpen} onOpenChange={setSignatureModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Firmas de correo</DialogTitle>
          </DialogHeader>
          <Tabs value={sigTab} onValueChange={setSigTab}>
            <TabsList className="w-full">
              <TabsTrigger value="list" className="flex-1">Mis firmas</TabsTrigger>
              <TabsTrigger value="edit" className="flex-1">{editingSig ? 'Editar' : 'Crear'}</TabsTrigger>
              <TabsTrigger value="import" className="flex-1">Importar</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-2 mt-3">
              {signatures.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay firmas creadas</p>
              ) : signatures.map(sig => (
                <div key={sig.id} className={`p-3 border rounded-lg flex items-start gap-3 ${activeSignatureId === sig.id ? 'border-primary bg-primary/5' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sig.name}</p>
                    <div className="text-xs text-muted-foreground mt-1 max-h-16 overflow-hidden" dangerouslySetInnerHTML={{ __html: sanitizeHtml(sig.html) }} />
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant={activeSignatureId === sig.id ? 'default' : 'outline'} className="h-7 text-xs"
                      onClick={() => setActiveSignatureId(activeSignatureId === sig.id ? '' : sig.id)}>
                      {activeSignatureId === sig.id ? 'Activa' : 'Usar'}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setEditingSig(sig); setSigName(sig.name); setSigHtml(sig.html); setSigTab('edit');
                    }}><PenLine className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSig(sig.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="edit" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de la firma</Label>
                <Input value={sigName} onChange={e => setSigName(e.target.value)} placeholder="Ej: Firma principal" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Contenido HTML</Label>
                  <div className="flex gap-1">
                    <input ref={sigImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleSigImage} />
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => sigImageInputRef.current?.click()}>
                      <Image className="h-3 w-3" /> Imagen
                    </Button>
                  </div>
                </div>
                <Textarea value={sigHtml} onChange={e => setSigHtml(e.target.value)} placeholder="<p>Tu firma aquí</p>" className="min-h-[120px] font-mono text-xs" />
              </div>
              {sigHtml && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3" /> Vista previa</Label>
                  <div className="p-3 border rounded-md bg-background text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(sigHtml) }} />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveSig} size="sm">{editingSig ? 'Actualizar' : 'Guardar firma'}</Button>
                {editingSig && <Button variant="ghost" size="sm" onClick={() => { setEditingSig(null); setSigName(''); setSigHtml(''); }}>Cancelar</Button>}
              </div>
            </TabsContent>

            <TabsContent value="import" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pega el HTML de tu firma existente</Label>
                <Textarea value={importHtml} onChange={e => setImportHtml(e.target.value)} placeholder="<table><tr><td>...</td></tr></table>" className="min-h-[150px] font-mono text-xs" />
              </div>
              {importHtml && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Eye className="h-3 w-3" /> Vista previa</Label>
                  <div className="p-3 border rounded-md bg-background text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHtml(importHtml) }} />
                </div>
              )}
              <Button onClick={importSignature} size="sm"><Import className="h-4 w-4 mr-1" /> Importar firma</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

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
                  <div className={`rounded-xl px-3 py-2 max-w-[85%] text-xs whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
