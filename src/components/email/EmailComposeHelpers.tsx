import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Send, Loader2, Sparkles, X, Bot, User, PenLine, Image, Import, Eye, Trash2, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';

// ── Types ──
export interface AIChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  source: 'local' | 'shared';
  url?: string;
  file?: File;
}

export interface EmailSignature {
  id: string;
  name: string;
  html: string;
}

// ── Signature persistence ──
const SIGNATURES_KEY = 'crm_email_signatures';

export function loadSignatures(): EmailSignature[] {
  try {
    return JSON.parse(localStorage.getItem(SIGNATURES_KEY) || '[]');
  } catch { return []; }
}

export function saveSignatures(sigs: EmailSignature[]) {
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(sigs));
}

// ── File helpers ──
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
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

// ── Signature Manager Dialog ──
interface SignatureManagerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signatures: EmailSignature[];
  setSignatures: React.Dispatch<React.SetStateAction<EmailSignature[]>>;
  activeSignatureId: string;
  setActiveSignatureId: (id: string) => void;
}

export function SignatureManagerDialog({
  open, onOpenChange, signatures, setSignatures, activeSignatureId, setActiveSignatureId
}: SignatureManagerProps) {
  const [sigTab, setSigTab] = useState('list');
  const [editingSig, setEditingSig] = useState<EmailSignature | null>(null);
  const [sigName, setSigName] = useState('');
  const [sigHtml, setSigHtml] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const sigImageInputRef = useRef<HTMLInputElement>(null);

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
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSigHtml(prev => prev + `<img src="${base64}" alt="firma" style="max-width:200px;height:auto;" />`);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}

// ── AI Chat Panel ──
interface AIChatPanelProps {
  aiMessages: AIChatMsg[];
  aiInput: string;
  setAiInput: (v: string) => void;
  aiLoading: boolean;
  onClose: () => void;
  onSend: (msg: string) => void;
}

export function AIChatPanel({ aiMessages, aiInput, setAiInput, aiLoading, onClose, onSend }: AIChatPanelProps) {
  const aiScrollRef = useRef<HTMLDivElement>(null);

  return (
    <Card className="w-80 lg:w-96 flex flex-col border-primary/20">
      <div className="flex items-center justify-between p-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Asistente de redacción</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
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
            onKeyDown={e => { if (e.key === 'Enter' && aiInput.trim() && !aiLoading) onSend(aiInput.trim()); }}
            placeholder="Describe el email..."
            className="h-8 text-xs"
            disabled={aiLoading}
          />
          <Button size="icon" className="h-8 w-8 shrink-0" disabled={!aiInput.trim() || aiLoading}
            onClick={() => { if (aiInput.trim()) onSend(aiInput.trim()); }}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Shared Files Dialog ──
interface SharedFilesDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sharedFiles: any[];
  loading: boolean;
  onAttach: (file: any) => void;
}

export function SharedFilesDialog({ open, onOpenChange, sharedFiles, loading, onAttach }: SharedFilesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjuntar desde Archivos compartidos</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sharedFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay archivos compartidos</p>
          ) : (
            <div className="space-y-1">
              {sharedFiles.map(f => (
                <button
                  key={f.id}
                  onClick={() => onAttach(f)}
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
  );
}
